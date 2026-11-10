import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { PrintStationService, PrintStationSettings, QZ_DOWNLOAD_URL } from 'src/app/services/print-station.service';

/**
 * «Impresoras de este equipo»: elige la impresora de comandas (red o instalada) que usa
 * QZ Tray y si las comandas salen solas. Se guarda solo en este equipo.
 */
@Component({
  selector: 'app-print-station-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-3"
      role="dialog" aria-modal="true" aria-labelledby="print-station-title" (click)="station.closeSettings()">
      <div class="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl sm:rounded-2xl" (click)="$event.stopPropagation()">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 id="print-station-title" class="text-lg font-black text-foreground">Impresoras de este equipo</h3>
            <p class="text-xs text-muted-foreground">Cómo imprime las comandas este equipo. Se guarda solo aquí.</p>
          </div>
          <button type="button" class="h-9 w-9 shrink-0 rounded-lg border border-border text-muted-foreground hover:bg-muted" (click)="station.closeSettings()" aria-label="Cerrar">✕</button>
        </div>

        <fieldset class="mb-4 space-y-2">
          <legend class="mb-1 text-xs font-bold uppercase text-muted-foreground">Imprimir comandas en este equipo</legend>
          <label class="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition"
            [ngClass]="!form.enabled ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'">
            <input type="radio" name="station-enabled" class="mt-1" [value]="false" [(ngModel)]="form.enabled" />
            <span>
              <span class="block text-sm font-semibold text-foreground">Normal</span>
              <span class="block text-xs text-muted-foreground">Con la ventana de impresión del navegador, eligiendo la impresora cada vez.</span>
            </span>
          </label>
          <label class="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition"
            [ngClass]="form.enabled ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'">
            <input type="radio" name="station-enabled" class="mt-1" [value]="true" [(ngModel)]="form.enabled" (ngModelChange)="onEnabledChange()" />
            <span>
              <span class="block text-sm font-semibold text-foreground">Directo a cocina con QZ Tray</span>
              <span class="block text-xs text-muted-foreground">Sin ventana: la comanda va a la impresora de cocina. Necesita QZ Tray en este equipo.</span>
            </span>
          </label>
        </fieldset>

        <label class="mb-4 block">
          <span class="mb-1 block text-xs font-bold uppercase text-muted-foreground">Nombre de este equipo</span>
          <input class="input md:w-full" placeholder="Ej. PC Caja" maxlength="60" [(ngModel)]="form.deviceName" name="station-device-name" autocomplete="off" />
          <span class="mt-1 block text-xs text-muted-foreground">Para reconocerlo en el soporte. Opcional.</span>
        </label>

        <ng-container *ngIf="form.enabled">
        <!-- Estado de QZ Tray -->
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5"
          [ngClass]="station.status() === 'connected' ? 'border-success-300 tone-ok' : station.status() === 'missing' ? 'border-danger-300 tone-danger' : 'border-border bg-muted/40 text-foreground'">
          <div class="text-sm">
            <span class="font-semibold">QZ Tray: </span>
            <span>{{ statusLabel }}</span>
            <p *ngIf="station.status() === 'missing'" class="text-xs">Instálalo y ábrelo en este equipo (queda junto al reloj).</p>
          </div>
          <div class="flex gap-2">
            <a *ngIf="station.status() === 'missing'" class="btn btn-outline" [href]="downloadUrl" target="_blank" rel="noopener">Descargar QZ Tray</a>
            <button type="button" class="btn btn-outline" [disabled]="station.status() === 'connecting'" (click)="reconnect()">Reintentar</button>
          </div>
        </div>

        <fieldset class="space-y-2">
          <legend class="mb-1 text-xs font-bold uppercase text-muted-foreground">Impresora de comandas</legend>

          <label class="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition"
            [ngClass]="form.mode === 'network' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'">
            <input type="radio" name="station-mode" class="mt-1" value="network" [(ngModel)]="form.mode" />
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-foreground">Por red (cable o WiFi)</span>
              <span class="block text-xs text-muted-foreground">La IP sale en la hoja de autoprueba de la impresora.</span>
              <span *ngIf="form.mode === 'network'" class="mt-2 flex gap-2">
                <input class="input min-w-0 flex-1 md:w-auto" placeholder="192.168.1.50" [(ngModel)]="form.host" name="station-host" inputmode="decimal" autocomplete="off" aria-label="IP de la impresora" />
                <input class="input w-24 md:w-24" type="number" min="1" max="65535" [(ngModel)]="form.port" name="station-port" aria-label="Puerto" />
              </span>
            </span>
          </label>

          <label class="flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition"
            [ngClass]="form.mode === 'printer' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'">
            <input type="radio" name="station-mode" class="mt-1" value="printer" [(ngModel)]="form.mode" (ngModelChange)="onModeChange()" />
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-foreground">Instalada en este equipo (USB)</span>
              <span class="block text-xs text-muted-foreground">Con su driver instalado en Windows.</span>
              <span *ngIf="form.mode === 'printer'" class="mt-2 flex gap-2">
                <select class="select min-w-0 flex-1 md:w-auto" [(ngModel)]="form.printer" name="station-printer" aria-label="Impresora instalada">
                  <option value="" disabled>{{ loadingPrinters ? 'Buscando…' : 'Elige la impresora' }}</option>
                  <option *ngFor="let name of printers" [value]="name">{{ name }}</option>
                  <option *ngIf="form.printer && !printers.includes(form.printer)" [value]="form.printer">{{ form.printer }}</option>
                </select>
                <button type="button" class="btn btn-outline" [disabled]="loadingPrinters" (click)="loadPrinters()">Buscar</button>
              </span>
            </span>
          </label>
        </fieldset>

        <label class="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-2.5 hover:bg-muted/50">
          <input type="checkbox" class="mt-1" [(ngModel)]="form.autoPrint" name="station-auto" />
          <span>
            <span class="block text-sm font-semibold text-foreground">Imprimir comandas solas</span>
            <span class="block text-xs text-muted-foreground">Cada pedido nuevo y lo que se agrega sale en cocina sin tocar nada. Actívalo en un solo equipo.</span>
          </span>
        </label>

        <label class="mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-border px-3 py-2.5 hover:bg-muted/50">
          <input type="checkbox" class="mt-1" [(ngModel)]="form.plainText" name="station-plain" />
          <span>
            <span class="block text-sm font-semibold text-foreground">Imprimir sin tildes</span>
            <span class="block text-xs text-muted-foreground">Solo si en la prueba las tildes o la ñ salen como símbolos raros.</span>
          </span>
        </label>

        <p *ngIf="!targetValid" class="mt-3 text-xs text-warning-800">
          {{ form.mode === 'network' ? 'Escribe la IP de la impresora (ej. 192.168.1.50) y el puerto (9100).' : 'Elige la impresora instalada.' }}
        </p>

        <div class="mt-5 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          <p class="mb-1 font-semibold text-foreground">Primera vez en este equipo</p>
          <p>Descarga el certificado de FacturADA y cópialo en la carpeta de QZ Tray como <b>override.crt</b>. Así QZ no pregunta en cada impresión. Los pasos están en el manual de instalación.</p>
          <button type="button" class="btn btn-ghost mt-2" (click)="downloadCertificate()">Descargar certificado</button>
        </div>
        </ng-container>

        <div class="mt-4 flex flex-wrap justify-end gap-2">
          <button *ngIf="form.enabled" type="button" class="btn btn-outline" [disabled]="!targetValid || testing" (click)="test()">{{ testing ? 'Imprimiendo…' : 'Imprimir prueba' }}</button>
          <button type="button" class="btn btn-primary" [disabled]="form.enabled && !targetValid" (click)="save()">Guardar</button>
        </div>
      </div>
    </div>
  `,
})
export class PrintStationSettingsComponent implements OnInit {
  form: PrintStationSettings;
  printers: string[] = [];
  loadingPrinters = false;
  testing = false;
  readonly downloadUrl = QZ_DOWNLOAD_URL;

  constructor(public station: PrintStationService) {
    this.form = { ...station.settings() };
  }

  ngOnInit(): void {
    if (this.form.enabled) this.onEnabledChange();
  }

  /** Al pasar a «Directo a cocina»: conecta con QZ y, si es USB, trae las impresoras. */
  onEnabledChange(): void {
    if (!this.form.enabled) return;
    void this.reconnect().then(() => {
      if (this.form.mode === 'printer' && this.station.status() === 'connected' && !this.printers.length) void this.loadPrinters();
    });
  }

  get targetValid(): boolean {
    return this.station.isValidTarget({ ...this.form, port: Number(this.form.port) });
  }

  get statusLabel(): string {
    switch (this.station.status()) {
      case 'connected': return 'conectado';
      case 'connecting': return 'conectando…';
      case 'missing': return 'no se detecta en este equipo';
      default: return 'sin conectar';
    }
  }

  async reconnect(): Promise<void> {
    try { await this.station.connect(); } catch { /* el estado ya lo muestra */ }
  }

  onModeChange(): void {
    if (this.form.mode === 'printer' && !this.printers.length) void this.loadPrinters();
  }

  async loadPrinters(): Promise<void> {
    this.loadingPrinters = true;
    try {
      this.printers = await this.station.listPrinters();
      if (!this.printers.length) toast.info('QZ Tray no encontró impresoras instaladas en este equipo.');
    } catch (error: any) {
      toast.error('No se pudieron buscar las impresoras', { description: error?.message });
    } finally {
      this.loadingPrinters = false;
    }
  }

  async test(): Promise<void> {
    this.testing = true;
    try {
      await this.station.printTest({ ...this.form, port: Number(this.form.port) });
      toast.success('Prueba enviada. Revisa que las tildes y el corte salgan bien.');
    } catch (error: any) {
      toast.error('No salió la prueba', { description: error?.message, duration: 15000 });
    } finally {
      this.testing = false;
    }
  }

  save(): void {
    // En «Normal» se conservan la IP o la impresora para volver a «Directo» sin escribirlas de nuevo.
    this.station.saveSettings({ ...this.form, port: Number(this.form.port) || 9100 });
    toast.success(!this.form.enabled
      ? 'Listo: este equipo imprime las comandas de la forma normal.'
      : this.form.autoPrint ? 'Listo: este equipo imprimirá las comandas solas en cocina.' : 'Listo: las comandas irán directo a cocina al tocar imprimir.');
    this.station.closeSettings();
  }

  async downloadCertificate(): Promise<void> {
    try {
      await this.station.downloadCertificate();
    } catch (error: any) {
      toast.error('No se pudo descargar el certificado', { description: error?.message });
    }
  }
}
