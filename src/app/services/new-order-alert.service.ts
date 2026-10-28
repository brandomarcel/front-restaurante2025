import { Injectable } from '@angular/core';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { PrintService } from './print.service';
import { RestaurantRealtimeService } from './restaurant-realtime.service';

const ALERT_SOUND_KEY = 'facturada.caja.sound';
const AUTO_PRINT_KEY = 'facturada.caja.autoprint';
const ALERT_DURATION_MS = 30000;

/**
 * Avisa a Caja de cada pedido nuevo creado por otra persona (mesero), sin importar
 * en qué pantalla esté: sonido, aviso con «Imprimir comanda» a un toque y contador en
 * la pestaña del navegador mientras no se mire.
 *
 * Solo avisa a quien cobra (`billing.create`) y puede ver órdenes. El mesero y
 * Cocina no reciben este aviso; Cocina ya tiene su propia pantalla.
 */
@Injectable({ providedIn: 'root' })
export class NewOrderAlertService {
  private started = false;
  private readonly seen = new Set<string>();
  private unseen = 0;
  private baseTitle = '';
  private audioContext: AudioContext | null = null;

  constructor(
    private realtime: RestaurantRealtimeService,
    private capabilities: CompanyCapabilitiesService,
    private printService: PrintService
  ) {}

  /** Idempotente: el layout lo llama al entrar; solo se engancha una vez. */
  start(): void {
    if (this.started || !this.shouldAlert()) return;
    this.started = true;
    this.baseTitle = document.title;
    this.realtime.activate();
    this.realtime.events$.subscribe((event) => {
      if (event.event_type === 'order.created') this.onOrderCreated(event.data);
      else if (event.event_type === 'order.updated' && event.action === 'items_added') this.onItemsAdded(event.data);
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.clearTitleBadge(); });
    window.addEventListener('focus', () => this.clearTitleBadge());
    // El navegador solo permite audio tras un gesto: el primero habilita el sonido.
    const unlock = () => {
      this.ensureAudio();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
  }

  get soundEnabled(): boolean {
    try { return localStorage.getItem(ALERT_SOUND_KEY) !== '0'; } catch { return true; }
  }

  setSoundEnabled(enabled: boolean): void {
    try { localStorage.setItem(ALERT_SOUND_KEY, enabled ? '1' : '0'); } catch { /* solo esta sesión */ }
    if (enabled) this.playSound();
  }

  /** Imprimir la comanda sola al llegar el pedido. Es por equipo: solo la PC de la impresora debe activarlo. */
  get autoPrint(): boolean {
    try { return localStorage.getItem(AUTO_PRINT_KEY) === '1'; } catch { return false; }
  }

  setAutoPrint(enabled: boolean): void {
    try { localStorage.setItem(AUTO_PRINT_KEY, enabled ? '1' : '0'); } catch { /* solo esta sesión */ }
  }

  /** El usuario actual recibe avisos de pedidos (cobra y ve órdenes). */
  get available(): boolean {
    return this.shouldAlert();
  }

  private shouldAlert(): boolean {
    return this.capabilities.isEnabled('orders')
      && this.capabilities.hasPermission('restaurant.orders.read')
      && this.capabilities.hasPermission('billing.create');
  }

  private onOrderCreated(order: any): void {
    const name = String(order?.name || '').trim();
    if (!name || this.seen.has(name) || !this.shouldAlert()) return;
    this.seen.add(name);
    if (/cancel/i.test(String(order?.status || ''))) return;
    // Lo que crea el propio usuario (POS de Caja) no necesita aviso.
    const me = this.currentUserEmail();
    if (me && String(order?.waiter || '').toLowerCase() === me) return;

    const where = order?.table_name || order?.table ? `Mesa ${order.table_name || order.table}` : 'Sin mesa';
    const who = order?.waiter_name || order?.waiter || '';
    const count = (order?.items || []).reduce((sum: number, row: any) => sum + (Number(row?.qty) || 0), 0);
    const detail = [who, count ? `${count} ${count === 1 ? 'producto' : 'productos'}` : ''].filter(Boolean).join(' · ');

    this.playSound();
    this.addTitleBadge();
    const autoPrint = this.autoPrint;
    if (autoPrint) this.printService.printComandaHidden(name);
    toast.success(`Nuevo pedido · ${where}`, {
      description: [detail, autoPrint ? 'Comanda enviada a la impresora' : ''].filter(Boolean).join(' · ') || undefined,
      duration: ALERT_DURATION_MS,
      action: {
        label: autoPrint ? 'Reimprimir' : 'Imprimir comanda',
        onClick: () => {
          if (!this.printService.openComanda(name)) toast.error('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes.');
        },
      },
    });
  }

  /** «El cliente pidió algo más»: avisa y manda a imprimir solo la comanda adicional. */
  private onItemsAdded(order: any): void {
    const name = String(order?.name || '').trim();
    const batch = Number(order?.addition_batch) || 0;
    const key = `${name}#${batch}`;
    if (!name || !batch || this.seen.has(key) || !this.shouldAlert()) return;
    this.seen.add(key);
    const me = this.currentUserEmail();
    if (me && String(order?.added_by || '').toLowerCase() === me) return;

    const added = (order?.items || []).filter((row: any) => Number(row?.addition_batch) === batch);
    const count = added.reduce((sum: number, row: any) => sum + (Number(row?.qty) || 0), 0);
    const where = order?.table_name || order?.table ? `Mesa ${order.table_name || order.table}` : (order?.alias || 'Sin mesa');
    const detail = [count ? `+${count} ${count === 1 ? 'producto' : 'productos'}` : '', order?.added_by || ''].filter(Boolean).join(' · ');

    this.playSound();
    this.addTitleBadge();
    const autoPrint = this.autoPrint;
    if (autoPrint) this.printService.printComandaHidden(name, true);
    toast.success(`Pedido ampliado · ${where}`, {
      description: [detail, autoPrint ? 'Comanda adicional enviada a la impresora' : ''].filter(Boolean).join(' · ') || undefined,
      duration: ALERT_DURATION_MS,
      action: {
        label: autoPrint ? 'Reimprimir' : 'Imprimir comanda adicional',
        onClick: () => {
          if (!this.printService.openComanda(name, true)) toast.error('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes.');
        },
      },
    });
  }

  private currentUserEmail(): string {
    try { return String(JSON.parse(localStorage.getItem('user') || 'null')?.email || '').toLowerCase(); } catch { return ''; }
  }

  private addTitleBadge(): void {
    if (!document.hidden) return;
    this.unseen += 1;
    document.title = `(${this.unseen}) Nuevo pedido · ${this.baseTitle}`;
  }

  private clearTitleBadge(): void {
    if (!this.unseen) return;
    this.unseen = 0;
    document.title = this.baseTitle;
  }

  private ensureAudio(): AudioContext | null {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      this.audioContext ??= new Ctx();
      void this.audioContext.resume();
      return this.audioContext;
    } catch { return null; }
  }

  /** Tres tonos ascendentes (distintos de Cocina). Si el navegador bloquea el audio, queda el aviso visual. */
  private playSound(): void {
    if (!this.soundEnabled) return;
    const ctx = this.ensureAudio();
    if (!ctx) return;
    [0, 0.16, 0.32].forEach((offset, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = [660, 880, 1100][index];
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + offset + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.15);
    });
  }
}
