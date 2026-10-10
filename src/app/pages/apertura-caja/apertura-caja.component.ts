import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CajasService } from 'src/app/services/cajas.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { finalize } from 'rxjs';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { CajaAbiertaGuard } from 'src/app/core/guards/caja-abierta.guard';
import { DecimalInputDirective } from 'src/app/shared/directives/decimal-input.directive';
import { CajaNavComponent, CajaTurnState } from 'src/app/shared/components/caja-nav/caja-nav.component';
import { cashNumber, cashOpeningName, currentSessionEmail, readCashBackendMessage } from 'src/app/core/utils/cash-register';

@Component({
  selector: 'app-apertura-caja',
  imports: [CommonModule, FormsModule, RouterModule, DecimalInputDirective, CajaNavComponent],
  templateUrl: './apertura-caja.component.html',
  styleUrls: ['./apertura-caja.component.css']
})
export class AperturaCajaComponent implements OnInit {
  apertura = {
    usuario: '',
    monto_apertura: 0,
    observacion: '',
    estado: 'Abierta'
  };

  cajaActiva = false;
  aperturaActual: any | null = null;
  loadingStatus = false;
  saving = false;
  cashMetrics: any | null = null;
  loadingMetrics = false;
  selectedTerminalId = '';
  /** Montos habituales de fondo de caja, para no tener que escribirlos. */
  readonly quickAmounts = [20, 50, 100, 200];
  private loadingCounter = 0;

  constructor(private cajasService: CajasService,
    private alertService: AlertService,
    private spinner: NgxSpinnerService,
    public capabilities: CompanyCapabilitiesService,
    private cajaAbiertaGuard: CajaAbiertaGuard
  ) { }

  ngOnInit(): void {
    this.apertura.usuario = currentSessionEmail();
    this.selectedTerminalId = this.capabilities.activePosTerminal?.name || '';

    this.verificarCajaAbierta();
  }

  /** El modelo de terminales solo aplica cuando el negocio los usa (`pos_terminal`). */
  get usesPosTerminalModel(): boolean {
    return this.capabilities.usesPosTerminalModel;
  }

  get availableTerminals(): any[] {
    return this.capabilities.activePosTerminals;
  }

  /** Ningún terminal configurado: hay que crear uno antes de poder operar caja. */
  get needsTerminalConfiguration(): boolean {
    return this.usesPosTerminalModel && this.availableTerminals.length === 0;
  }

  /** Varios terminales activos y ninguno elegido todavía: hace falta seleccionar uno. */
  get needsTerminalSelection(): boolean {
    return this.usesPosTerminalModel
      && this.availableTerminals.length > 1
      && !this.selectedTerminalId;
  }

  onTerminalChange(terminalId: string): void {
    this.selectedTerminalId = terminalId;
    const terminal = this.availableTerminals.find((item) => String(item?.name || '') === terminalId);
    if (terminal) this.capabilities.setActivePosTerminal(terminal);
  }

  get navState(): CajaTurnState {
    if (this.loadingStatus) return 'loading';
    return this.cajaActiva ? 'open' : 'closed';
  }

  get openingId(): string {
    return cashOpeningName(this.aperturaActual);
  }

  get openedAt(): string | null {
    return this.aperturaActual?.opened_at || this.aperturaActual?.posting_date || this.aperturaActual?.creation || null;
  }

  get activeTerminalLabel(): string {
    const terminal = this.availableTerminals.find((item) => String(item?.name || '') === this.selectedTerminalId)
      || this.capabilities.activePosTerminal;
    return terminal ? String(terminal.terminal_name || terminal.name) : '';
  }

  get amountValue(): number {
    return cashNumber(this.apertura.monto_apertura);
  }

  setAmount(amount: number): void {
    if (this.saving) return;
    this.apertura.monto_apertura = amount;
  }

  /** Primer valor numérico disponible en las métricas del turno. */
  metric(...keys: string[]): number {
    for (const key of keys) {
      const value = this.cashMetrics?.[key];
      if (value !== undefined && value !== null && value !== '') return cashNumber(value);
    }
    return 0;
  }

  private beginLoading(): void {
    this.loadingCounter += 1;
    if (this.loadingCounter === 1) {
      this.spinner.show();
    }
  }

  private endLoading(): void {
    this.loadingCounter = Math.max(0, this.loadingCounter - 1);
    if (this.loadingCounter === 0) {
      this.spinner.hide();
    }
  }

  verificarCajaAbierta(): void {
    if (!this.apertura.usuario) {
      this.cajaActiva = false;
      return;
    }

    this.loadingStatus = true;
    this.beginLoading();

    this.cajasService.verificarAperturaActiva(this.apertura.usuario).pipe(
      finalize(() => {
        this.loadingStatus = false;
        this.endLoading();
      })
    ).subscribe({
      next: (res: any) => {
        this.aperturaActual = res?.message?.apertura || (Array.isArray(res?.data) ? res.data[0] : null);
        // Igual que antes: sin estado se asume abierta; solo cerrada/closed la descarta.
        const status = String(this.aperturaActual?.status || this.aperturaActual?.estado || 'Abierta').toLowerCase();
        this.cajaActiva = !!this.aperturaActual && status !== 'cerrada' && status !== 'closed';
        this.loadMetrics();
      },
      error: (error) => {
        this.cajaActiva = false;
        this.aperturaActual = null;
        this.alertService.error(this.readBackendMessage(error) || 'No se pudo consultar la apertura de caja.');
      }
    });
  }

  loadMetrics(): void {
    if (!this.cajaActiva) {
      this.cashMetrics = null;
      return;
    }
    this.loadingMetrics = true;
    this.cajasService.getDashboardMetrics().pipe(
      finalize(() => this.loadingMetrics = false)
    ).subscribe({
      next: (response: any) => {
        const message = response?.message ?? response ?? {};
        const data = message?.data ?? {};
        this.cashMetrics = data?.cash ?? data ?? null;
      },
      error: () => { this.cashMetrics = null; }
    });
  }

  abrirCaja(): void {
    if (!this.canSubmit) {
      return;
    }

    const data = {
      opening_amount: Number(this.apertura.monto_apertura),
      notes: String(this.apertura.observacion || '').trim(),
      ...(this.selectedTerminalId ? { pos_terminal: this.selectedTerminalId } : {})
    };

    this.saving = true;
    this.beginLoading();

    this.cajasService.create_apertura_de_caja(data).pipe(
      finalize(() => {
        this.saving = false;
        this.endLoading();
      })
    ).subscribe({
      next: () => {
        this.alertService.success('Caja abierta correctamente');
        // Sin esto, `CajaAbiertaGuard` puede seguir devolviendo "sin apertura"
        // hasta 15s (si el usuario intentó entrar al POS antes de abrir),
        // rebotándolo del POS justo después de abrir caja.
        this.cajaAbiertaGuard.invalidateCache();
        this.verificarCajaAbierta();
      },
      error: (error) => {
        this.alertService.error(this.readBackendMessage(error) || 'No se pudo abrir la caja.');
      }
    });
  }

  /** 📆 Formato compatible con MySQL/Frappe desde zona horaria Ecuador */
  getFechaHoraEcuador(): string {
    const date = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' })
    );

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  get canSubmit(): boolean {
    return !this.cajaActiva
      && !this.needsTerminalConfiguration
      && !this.needsTerminalSelection
      && Number(this.apertura.monto_apertura) > 0
      && !this.loadingStatus
      && !this.saving;
  }

  private readBackendMessage(error: any): string {
    return readCashBackendMessage(error);
  }
}
