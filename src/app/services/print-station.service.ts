import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { toast } from 'ngx-sonner';
import { firstValueFrom } from 'rxjs';
import { environment } from 'src/environments/environment';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { PrintService } from './print.service';

export type PrintStationMode = 'network' | 'printer';

export interface PrintStationSettings {
  /** false = «Normal»: este equipo imprime con la ventana del navegador aunque tenga impresora guardada. */
  enabled: boolean;
  mode: PrintStationMode;
  /** Impresora de red: IP o nombre y puerto RAW (casi siempre 9100). */
  host: string;
  port: number;
  /** Impresora instalada en este equipo (nombre que muestra el sistema). */
  printer: string;
  /** Imprimir cada pedido nuevo y lo agregado sin que nadie toque nada. */
  autoPrint: boolean;
  /** Quitar tildes y ñ si la impresora muestra símbolos raros. */
  plainText: boolean;
  /** Nombre para reconocer el equipo en el Desk («PC Caja»). */
  deviceName: string;
}

export type QzStatus = 'idle' | 'connecting' | 'connected' | 'missing';

const SETTINGS_KEY = 'facturada.printstation';
const PRINTED_KEY = 'facturada.printstation.printed';
const DEVICE_KEY = 'facturada.printstation.device';
const PRINTED_TTL_MS = 24 * 60 * 60 * 1000;
const API = `${environment.apiUrl}/method/facturada_restaurante.api`;
export const QZ_DOWNLOAD_URL = 'https://qz.io/download/';

const DEFAULT_SETTINGS: PrintStationSettings = { enabled: false, mode: 'network', host: '', port: 9100, printer: '', autoPrint: false, plainText: false, deviceName: '' };

/**
 * «Estación de impresión»: el equipo que tiene QZ Tray manda las comandas directo a la
 * térmica de cocina (red o USB), sin diálogo del navegador.
 *
 * QZ Tray corre en este mismo equipo; cada llamada va firmada por el backend
 * (`api.qz_tray`, certificado propio del sitio, sin licencia de QZ). La comanda llega en
 * ESC/POS (`api.printing.get_kitchen_ticket_escpos`), sin precios.
 *
 * La configuración es por equipo (localStorage): solo la PC con la impresora la activa.
 */
@Injectable({ providedIn: 'root' })
export class PrintStationService {
  readonly status = signal<QzStatus>('idle');
  readonly settings = signal<PrintStationSettings>(this.readSettings());
  /** La ventana «Impresoras de este equipo» (la pinta el layout). */
  readonly settingsOpen = signal(false);

  private qz: any = null;
  private startupReported = false;
  private loading: Promise<any> | null = null;
  private connecting: Promise<void> | null = null;

  constructor(
    private http: HttpClient,
    private capabilities: CompanyCapabilitiesService,
    private frappeError: FrappeErrorService,
    private printService: PrintService
  ) {}

  /** Quién puede ser estación: ve órdenes y cobra (Caja) o mueve la cocina (Cocina). El mesero no. */
  get available(): boolean {
    return this.capabilities.isEnabled('orders')
      && this.capabilities.hasPermission('restaurant.orders.read')
      && (this.capabilities.hasPermission('billing.create') || this.capabilities.hasPermission('restaurant.orders.update'));
  }

  /** Este equipo imprime las comandas directo a cocina (modo QZ con impresora elegida). */
  get configured(): boolean {
    const s = this.settings();
    return s.enabled && this.isValidTarget(s);
  }

  /** Este equipo imprime solo cada pedido. */
  get autoPrintActive(): boolean {
    return this.available && this.configured && this.settings().autoPrint;
  }

  isValidTarget(s: PrintStationSettings): boolean {
    if (s.mode === 'printer') return !!s.printer.trim();
    return /^[a-zA-Z0-9.-]+$/.test(s.host.trim()) && Number.isInteger(s.port) && s.port > 0 && s.port < 65536;
  }

  saveSettings(next: PrintStationSettings): void {
    const clean: PrintStationSettings = {
      ...next, host: next.host.trim(), printer: next.printer.trim(), port: Number(next.port) || 9100, deviceName: next.deviceName.trim().slice(0, 60),
    };
    this.settings.set(clean);
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(clean)); } catch { /* solo esta sesión */ }
    this.report('config');
  }

  /** Al abrir la app en un equipo que imprime directo: el Desk lo ve como activo. Una vez por sesión. */
  reportStartup(): void {
    if (this.startupReported || !this.available || !this.configured) return;
    this.startupReported = true;
    this.report('config');
  }

  openSettings(): void { this.settingsOpen.set(true); }
  closeSettings(): void { this.settingsOpen.set(false); }

  /** Conecta con QZ Tray en este equipo. Devuelve false si no está abierto o instalado. */
  async connect(): Promise<boolean> {
    const qz = await this.lib();
    if (qz.websocket.isActive()) {
      this.status.set('connected');
      return true;
    }
    this.status.set('connecting');
    this.connecting ??= qz.websocket.connect({ retries: 1, delay: 1 }).finally(() => (this.connecting = null));
    try {
      await this.connecting;
      this.status.set('connected');
      return true;
    } catch {
      // Si otra llamada ya conectó, la conexión sirve igual.
      const active = qz.websocket.isActive();
      this.status.set(active ? 'connected' : 'missing');
      return active;
    }
  }

  /** Impresoras instaladas en este equipo, según QZ Tray. */
  async listPrinters(): Promise<string[]> {
    await this.ensureConnected();
    const found = await this.qz.printers.find();
    return Array.isArray(found) ? found : [found].filter(Boolean);
  }

  /** Comanda (o comanda adicional) directo a la impresora de cocina. Lanza Error con un mensaje para mostrar. */
  async printKitchenTicket(orderName: string, additional = false): Promise<void> {
    const params = new HttpParams().set('order_name', orderName).set('additional', additional ? '1' : '0');
    try {
      const data = await this.fetchRaw('printing.get_kitchen_ticket_escpos', params);
      await this.sendRaw(this.settings(), data, `${additional ? 'Comanda adicional' : 'Comanda'} ${orderName}`);
    } catch (error: any) {
      this.report('error', { error: `${orderName}: ${error?.message || error}` });
      throw error;
    }
    this.report('printed', { order_name: orderName });
  }

  /** Página de prueba con la configuración indicada (aún sin guardar). */
  async printTest(target: PrintStationSettings): Promise<void> {
    const params = new HttpParams().set('business', this.business());
    const data = await this.fetchRaw('printing.get_test_ticket_escpos', params);
    await this.sendRaw(target, data, 'Prueba FacturADA');
  }

  /**
   * Botones «Imprimir comanda»: por QZ si este equipo tiene impresora de comandas; si no,
   * `fallback` (la ventana de impresión de siempre). Si QZ falla, ofrece el diálogo.
   */
  printComanda(orderName: string, additional: boolean, fallback: () => void): void {
    if (!this.available || !this.configured) {
      fallback();
      return;
    }
    this.printKitchenTicket(orderName, additional).then(
      () => toast.success(additional ? 'Comanda adicional enviada a cocina' : 'Comanda enviada a cocina'),
      (error: Error) => toast.error('No se pudo imprimir en cocina', {
        description: error.message,
        duration: 15000,
        action: { label: 'Imprimir con diálogo', onClick: fallback },
      })
    );
  }

  /**
   * Impresión automática al llegar un pedido. `key` identifica el pedido o el lote agregado:
   * con varias pestañas abiertas en este equipo solo una lo imprime.
   */
  async autoPrint(orderName: string, additional: boolean, key: string, where: string): Promise<boolean> {
    if (!this.autoPrintActive || !(await this.claim(key))) return false;
    try {
      await this.printKitchenTicket(orderName, additional);
      return true;
    } catch (error: any) {
      toast.error(`No salió la comanda · ${where}`, {
        description: error?.message,
        duration: 60000,
        action: { label: 'Reintentar', onClick: () => this.printComanda(orderName, additional, () => this.openWindow(orderName, additional)) },
      });
      return false;
    }
  }

  /** Certificado público del sitio, para instalarlo en QZ Tray como override.crt. */
  async downloadCertificate(): Promise<void> {
    const certificate = await this.fetchCertificate();
    const url = URL.createObjectURL(new Blob([certificate], { type: 'application/x-x509-ca-cert' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'override.crt';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Ventana de impresión de siempre (diálogo del navegador). */
  openWindow(orderName: string, additional = false): void {
    if (!this.printService.openComanda(orderName, additional)) {
      toast.error('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes.');
    }
  }

  // ---------------------------------------------------------------- internos

  /**
   * Informa al servidor el estado de este equipo para el Desk (System Manager ▸ negocio ▸ «Impresora de cocina»).
   * Solo informativo: si falla no afecta la impresión.
   */
  private report(event: 'config' | 'printed' | 'error', extra: { order_name?: string; error?: string } = {}): void {
    const business = this.business();
    if (!business || !this.available) return;
    const s = this.settings();
    const body = {
      business,
      device_id: this.deviceId(),
      event,
      device_label: s.deviceName || this.platformLabel(),
      enabled: s.enabled ? 1 : 0,
      mode: s.mode,
      target: s.mode === 'printer' ? s.printer : (s.host ? `${s.host}:${s.port}` : ''),
      auto_print: s.autoPrint ? 1 : 0,
      plain_text: s.plainText ? 1 : 0,
      ...extra,
    };
    this.http.post(`${API}.qz_tray.report_print_station`, body, this.httpOptions()).subscribe({ error: () => undefined });
  }

  private deviceId(): string {
    try {
      let id = localStorage.getItem(DEVICE_KEY);
      if (!id || !/^[A-Za-z0-9-]{8,64}$/.test(id)) {
        id = typeof crypto?.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
        localStorage.setItem(DEVICE_KEY, id);
      }
      return id;
    } catch {
      return 'sin-almacenamiento';
    }
  }

  /** «Windows · Chrome» cuando el equipo no tiene nombre. */
  private platformLabel(): string {
    const ua = navigator.userAgent || '';
    const os = /Windows/i.test(ua) ? 'Windows' : /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS'
      : /Mac OS X/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Equipo';
    const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : '';
    return [os, browser].filter(Boolean).join(' · ');
  }

  private async sendRaw(target: PrintStationSettings, data: string, jobName: string): Promise<void> {
    if (!this.isValidTarget(target)) throw new Error('Elige la impresora de comandas en «Impresoras de este equipo».');
    await this.ensureConnected();
    const printer = target.mode === 'printer' ? target.printer : { host: target.host, port: target.port };
    const text = target.plainText ? data.normalize('NFD').replace(/[̀-ͯ]/g, '') : data;
    const config = this.qz.configs.create(printer, { encoding: 'CP850', jobName });
    try {
      await this.qz.print(config, [{ type: 'raw', format: 'command', flavor: 'plain', data: text }]);
    } catch (error: any) {
      throw new Error(this.describeQzError(error, target));
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!(await this.connect())) throw new Error('QZ Tray no está abierto en este equipo.');
  }

  private async fetchRaw(method: string, params: HttpParams): Promise<string> {
    try {
      const res: any = await firstValueFrom(this.http.get(`${API}.${method}`, this.httpOptions(params)));
      const data = res?.message?.data;
      if (typeof data !== 'string' || !data) throw new Error('empty');
      return data;
    } catch (error: any) {
      throw new Error(error?.message === 'empty' ? 'El servidor no devolvió la comanda.' : this.frappeError.handle(error));
    }
  }

  private async fetchCertificate(): Promise<string> {
    try {
      const res: any = await firstValueFrom(this.http.get(`${API}.qz_tray.get_qz_certificate`, this.httpOptions()));
      return String(res?.message || '');
    } catch (error) {
      throw new Error(this.frappeError.handle(error));
    }
  }

  private async sign(request: string): Promise<string> {
    const params = new HttpParams().set('request', request).set('business', this.business());
    const res: any = await firstValueFrom(this.http.get(`${API}.qz_tray.sign_qz_request`, this.httpOptions(params)));
    return String(res?.message || '');
  }

  private httpOptions(params?: HttpParams) {
    return { params, withCredentials: true, context: new HttpContext().set(REQUIRE_AUTH, true) };
  }

  private business(): string {
    return String(this.capabilities.activeBusinessId || localStorage.getItem('active_business') || '');
  }

  /** Carga qz-tray solo cuando hace falta y le enseña a pedir certificado y firma al backend. */
  private lib(): Promise<any> {
    this.loading ??= import('qz-tray').then((mod: any) => {
      const qz = mod?.default ?? mod;
      qz.security.setCertificatePromise((resolve: (c: string) => void, reject: (e: unknown) => void) => {
        this.fetchCertificate().then(resolve, reject);
      });
      qz.security.setSignatureAlgorithm('SHA512');
      qz.security.setSignaturePromise((toSign: string) => (resolve: (s: string) => void, reject: (e: unknown) => void) => {
        this.sign(toSign).then(resolve, reject);
      });
      qz.websocket.setClosedCallbacks(() => this.status.set('idle'));
      this.qz = qz;
      return qz;
    });
    return this.loading;
  }

  private describeQzError(error: any, target: PrintStationSettings): string {
    const text = String(error?.message || error || '');
    if (/block|reject|denied|untrusted/i.test(text)) {
      return 'QZ Tray bloqueó la impresión. Acepta el aviso de QZ marcando «Remember this decision» o instala el certificado (override.crt).';
    }
    if (target.mode === 'network' && /refused|timed out|timeout|unreachable|no route|connect/i.test(text)) {
      return `La impresora ${target.host}:${target.port} no responde. Revisa que esté prendida y conectada a la red.`;
    }
    if (target.mode === 'printer' && /not found|cannot find|no printer/i.test(text)) {
      return `No se encontró la impresora «${target.printer}» en este equipo.`;
    }
    return text || 'Error desconocido de QZ Tray.';
  }

  /** Marca el pedido como impreso en este equipo; false si otra pestaña ya lo hizo. */
  private async claim(key: string): Promise<boolean> {
    const mark = (): boolean => {
      try {
        const now = Date.now();
        const printed: Record<string, number> = JSON.parse(localStorage.getItem(PRINTED_KEY) || '{}');
        if (printed[key]) return false;
        for (const k of Object.keys(printed)) if (now - printed[k] > PRINTED_TTL_MS) delete printed[k];
        printed[key] = now;
        localStorage.setItem(PRINTED_KEY, JSON.stringify(printed));
        return true;
      } catch {
        return true;
      }
    };
    const locks = (navigator as any).locks;
    return locks?.request ? locks.request('facturada-print-station', mark) : mark();
  }

  private readSettings(): PrintStationSettings {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
      if (!saved) return { ...DEFAULT_SETTINGS };
      const merged: PrintStationSettings = { ...DEFAULT_SETTINGS, ...saved };
      // Guardado antes de existir «Normal / Directo»: con impresora elegida, sigue en directo.
      if (typeof saved.enabled !== 'boolean') merged.enabled = this.isValidTarget(merged);
      return merged;
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }
}
