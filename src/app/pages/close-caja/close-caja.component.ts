import { Component, OnInit } from '@angular/core';
import { CajasService } from 'src/app/services/cajas.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AlertService } from 'src/app/core/services/alert.service';
import { finalize } from 'rxjs';
import { NgxSpinnerService } from 'ngx-spinner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { CajaAbiertaGuard } from 'src/app/core/guards/caja-abierta.guard';
import { DecimalInputDirective } from 'src/app/shared/directives/decimal-input.directive';
import { CajaNavComponent, CajaTurnState } from 'src/app/shared/components/caja-nav/caja-nav.component';
import {
  CASH_DENOMINATIONS, cashDifferenceKind, cashNumber, currentSessionEmail, isClosedCashStatus, isForbidden,
  readCashBackendMessage, sumDenominations
} from 'src/app/core/utils/cash-register';

@Component({
  selector: 'app-close-caja',
  imports: [CommonModule, FormsModule, RouterModule, DecimalInputDirective, CajaNavComponent],
  templateUrl: './close-caja.component.html',
  styleUrls: ['./close-caja.component.css']
})
export class CloseCajaComponent implements OnInit {
  cierre: any = {
    usuario: '',
    apertura: '',
    monto_apertura: 0,
    efectivo_sistema: 0,
    total_retiros: 0,
    efectivo_real: 0,
    diferencia: 0,
    observaciones: ''
  };

  paymentTotals: Array<{ payment_method: string; payment_code: string; amount: number }> = [];
  paymentMethodsForCount: Array<{ payment_method: string; payment_code: string; amount: number }> = [];
  paymentCounts: Record<string, number> = {};
  ventasEfectivo = 0;
  backendExpectedCash: number | null = null;
  lastClose: any | null = null;
  sinApertura = true;
  loadingData = false;
  saving = false;
  /** Conteo guiado por billetes y monedas: solo ayuda a llenar el efectivo contado. */
  readonly denominations = CASH_DENOMINATIONS;
  denominationCounts: number[] = CASH_DENOMINATIONS.map(() => 0);
  showDenominations = false;
  private loadingCounter = 0;

  constructor(
    private cajasService: CajasService,
    private alertService: AlertService,
    private spinner: NgxSpinnerService,
    public capabilities: CompanyCapabilitiesService,
    private cajaAbiertaGuard: CajaAbiertaGuard
  ) { }

  ngOnInit(): void {
    this.cierre.usuario = currentSessionEmail();
    // Evita consultas y spinners para Mesero u otros perfiles sin caja.
    if (!this.canOperateCash) return;
    this.getDatosCierre();
  }

  get navState(): CajaTurnState {
    if (this.loadingData) return 'loading';
    return this.sinApertura ? 'closed' : 'open';
  }

  get differenceKind(): 'short' | 'over' | 'even' {
    return cashDifferenceKind(Number(this.cierre.diferencia) || 0);
  }

  get denominationsTotal(): number {
    return sumDenominations(this.denominationCounts);
  }

  /** Formas de pago distintas al efectivo: se verifican, no se cuentan billetes. */
  get otherPaymentMethods() {
    return this.paymentMethodsForCount.filter((payment) => payment.payment_code !== '01');
  }

  get cashPaymentMethod() {
    return this.paymentMethodsForCount.find((payment) => payment.payment_code === '01') || null;
  }

  onDenominationChange(index: number, value: unknown): void {
    const quantity = Math.max(0, Math.floor(cashNumber(value)));
    this.denominationCounts = this.denominationCounts.map((current, i) => i === index ? quantity : current);
    this.onPaymentCountChange('01', this.denominationsTotal);
  }

  stepDenomination(index: number, delta: number): void {
    this.onDenominationChange(index, (this.denominationCounts[index] || 0) + delta);
  }

  clearDenominations(): void {
    this.denominationCounts = CASH_DENOMINATIONS.map(() => 0);
    this.onPaymentCountChange('01', 0);
  }

  denominationTrack = (index: number) => index;

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

  private resetCajaValores(): void {
    this.cierre.apertura = '';
    this.sinApertura = true;
    this.cierre.monto_apertura = 0;
    this.cierre.efectivo_sistema = 0;
    this.cierre.total_retiros = 0;
    this.cierre.efectivo_real = 0;
    this.cierre.diferencia = 0;
    this.cierre.observaciones = '';
    this.paymentTotals = [];
    this.paymentMethodsForCount = [];
    this.paymentCounts = {};
    this.ventasEfectivo = 0;
    this.backendExpectedCash = null;
    this.denominationCounts = CASH_DENOMINATIONS.map(() => 0);
    this.showDenominations = false;
  }

  getDatosCierre(): void {
    if (!this.cierre.usuario) {
      this.resetCajaValores();
      return;
    }

    this.loadingData = true;
    this.beginLoading();

    this.cajasService.getDatosCierre(this.cierre.usuario).pipe(
      finalize(() => {
        this.loadingData = false;
        this.endLoading();
      })
    ).subscribe({
      next: (response: any) => {
        const respuesta = response?.message ?? response ?? {};
        const datos = respuesta?.data && !Array.isArray(respuesta.data) ? respuesta.data : respuesta;
        const apertura = datos?.apertura
          ?? datos?.cash_opening
          ?? datos?.opening
          ?? datos?.last_cash_opening
          ?? null;
        this.sinApertura = !this.hasOpening(apertura)
          || isClosedCashStatus(apertura?.status ?? apertura?.estado ?? datos?.opening_status ?? datos?.status);
        if (this.sinApertura) {
          this.resetCajaValores();
          return;
        }

        this.cierre.apertura = typeof apertura === 'string'
          ? apertura
          : (apertura?.name || (typeof apertura?.cash_opening === 'string' ? apertura.cash_opening : ''));
        this.cierre.monto_apertura = this.toNumber(datos?.monto_apertura ?? datos?.opening_amount ?? apertura?.monto_apertura ?? apertura?.opening_amount);
        this.cierre.total_retiros = this.toNumber(datos?.total_retiros ?? datos?.total_withdrawals ?? apertura?.total_retiros);
        this.paymentTotals = this.normalizePaymentTotals(datos);
        this.paymentMethodsForCount = this.buildPaymentMethodsForCount();
        this.ventasEfectivo = this.paymentAmount('01');
        const expectedValue = datos?.efectivo_sistema
          ?? datos?.expected_cash
          ?? datos?.efectivo_esperado
          ?? apertura?.efectivo_sistema
          ?? apertura?.expected_cash;
        this.backendExpectedCash = datos?.expected_cash_available === true || expectedValue !== undefined
          ? this.toNumber(expectedValue)
          : null;
        this.cierre.efectivo_sistema = this.totalEsperado;
        this.paymentCounts = this.paymentMethodsForCount.reduce((result, payment) => {
          result[payment.payment_code] = payment.payment_code === '01' ? 0 : payment.amount;
          return result;
        }, {} as Record<string, number>);
        this.cierre.efectivo_real = this.paymentCounts['01'] || 0;
        this.calcularDiferencia();
        this.loadDashboardMetrics();
      },
      error: (error) => {
        this.resetCajaValores();
        this.alertService.error(this.errorMessage(error) || 'No se pudo consultar la apertura de caja.');
      }
    });
  }

  cleanCaja(): void {
    this.resetCajaValores();
  }

  onPaymentCountChange(code: string, value: number): void {
    const parsed = Number(value);
    this.paymentCounts[code] = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    if (code === '01') this.cierre.efectivo_real = this.paymentCounts[code];
    this.calcularDiferencia();
  }

  calcularDiferencia() {
    this.cierre.diferencia = Math.round(((Number(this.cierre.efectivo_real) || 0) - this.totalEsperado) * 100) / 100;
  }

  guardarCierre() {
    if (!this.canSave || this.saving) {
      return;
    }

    const counted = Number(this.cierre.efectivo_real || 0);
    const difference = Number(this.cierre.diferencia || 0);
    const kind = this.differenceKind;
    const differenceText = kind === 'even'
      ? 'La caja cuadra.'
      : `${kind === 'short' ? 'Faltan' : 'Sobran'} ${Math.abs(difference).toFixed(2)}.`;
    void this.alertService.confirm(
      `Contado ${counted.toFixed(2)} · Esperado ${this.totalEsperado.toFixed(2)}. ${differenceText}`,
      `¿Cerrar la caja ${this.cierre.apertura}?`
    ).then((result) => {
      if (result.isConfirmed) this.ejecutarCierre();
    });
  }

  /**
   * El resumen operativo debe venir del endpoint oficial de métricas.
   * Solo se usa para mostrar el turno actual; los valores contados siguen
   * siendo editables y son los únicos que se envían al cerrar.
   */
  private loadDashboardMetrics(): void {
    this.cajasService.getDashboardMetrics().subscribe({
      next: (response: any) => {
        const message = response?.message ?? response ?? {};
        const cash = message?.data?.cash ?? message?.cash ?? null;
        if (!cash) return;
        this.cierre.monto_apertura = this.toNumber(cash.monto_apertura ?? cash.opening_amount ?? this.cierre.monto_apertura);
        this.cierre.total_retiros = this.toNumber(cash.total_retiros ?? cash.total_withdrawals ?? this.cierre.total_retiros);
        const expected = cash.efectivo_sistema ?? cash.expected_cash ?? cash.efectivo_esperado;
        if (expected !== undefined && expected !== null) {
          this.backendExpectedCash = this.toNumber(expected);
          this.cierre.efectivo_sistema = this.backendExpectedCash;
        }
        const rows = Array.isArray(cash.payment_totals)
          ? cash.payment_totals
          : (Array.isArray(cash.payments) ? cash.payments : null);
        if (rows) {
          this.paymentTotals = this.normalizePaymentTotals({ payment_totals: rows });
          this.paymentMethodsForCount = this.buildPaymentMethodsForCount();
          this.ventasEfectivo = this.paymentAmount('01');
        }
        this.calcularDiferencia();
      },
      error: () => { /* La apertura sigue siendo cerrable sin métricas. */ }
    });
  }

  private ejecutarCierre(): void {
    if (!this.canSave || this.saving) return;

    const data = {
      cash_opening: this.cierre.apertura,
      cash_counted: Number(this.cierre.efectivo_real) || 0,
      payments: this.paymentMethodsForCount.map((payment) => ({
        payment_method: payment.payment_method,
        payment_code: payment.payment_code,
        counted_amount: this.toNumber(this.paymentCounts[payment.payment_code])
      })),
      notes: String(this.cierre.observaciones || '').trim()
    };

    this.saving = true;
    this.beginLoading();
    this.cajasService.create_cierre_de_caja(data).pipe(
      finalize(() => {
        this.saving = false;
        this.endLoading();
      })
    ).subscribe({
      next: (response: any) => {
        this.alertService.success('Cierre guardado correctamente');
        const body = response?.message ?? response ?? {};
        this.lastClose = body?.data ?? response?.data ?? body;
        // Igual que al abrir: sin esto el guard podría dejar entrar al POS
        // hasta 15s más con la caja ya cerrada.
        this.cajaAbiertaGuard.invalidateCache();
        this.cleanCaja();
      },
      error: (error) => {
        this.alertService.error(this.errorMessage(error) || 'No se pudo guardar el cierre de caja.');
      }
    });
  }

  get totalEsperado(): number {
    if (this.backendExpectedCash !== null) return this.backendExpectedCash;
    return (Number(this.cierre.monto_apertura) || 0)
      + this.ventasEfectivo
      - (Number(this.cierre.total_retiros) || 0);
  }

  paymentAmount(code: string): number {
    return this.paymentTotals
      .filter((payment) => payment.payment_code === code)
      .reduce((sum, payment) => sum + payment.amount, 0);
  }

  private buildPaymentMethodsForCount(): Array<{ payment_method: string; payment_code: string; amount: number }> {
    const defaults = [
      { payment_method: 'Efectivo', payment_code: '01', amount: 0 },
      { payment_method: 'Tarjeta de credito/debito', payment_code: '19', amount: 0 },
      { payment_method: 'Transferencia', payment_code: '20', amount: 0 }
    ];
    // Los reales del backend van primero: solo se completan con los valores
    // fijos en 0 los métodos (Efectivo/Tarjeta/Transferencia) que el backend
    // no haya devuelto para este turno, nunca al revés.
    const values = [...this.paymentTotals, ...defaults];
    const byCode = new Map<string, { payment_method: string; payment_code: string; amount: number }>();
    values.forEach((payment) => {
      if (!byCode.has(payment.payment_code)) byCode.set(payment.payment_code, payment);
    });
    return Array.from(byCode.values());
  }

  paymentCount(code: string): number {
    return this.toNumber(this.paymentCounts[code]);
  }

  /** Diferencia de ESTE método: lo contado menos lo que el sistema registró como vendido. */
  paymentDifference(code: string): number {
    return Math.round((this.paymentCount(code) - this.paymentAmount(code)) * 100) / 100;
  }

  paymentDifferenceClass(code: string): string {
    const diff = this.paymentDifference(code);
    if (Math.abs(diff) < 0.009) return 'text-muted-foreground';
    return diff > 0 ? 'text-emerald-600' : 'text-red-600';
  }

  trackPayment(_index: number, payment: { payment_code: string }): string {
    return payment.payment_code;
  }

  get canOperateCash(): boolean {
    return this.capabilities.isEnabled('cash_register')
      && (this.capabilities.hasPermission('*')
        || this.capabilities.hasPermission('restaurant.cash.manage')
        || this.capabilities.hasPermission('restaurant.manage')
        || this.capabilities.hasPermission('billing.manage')
        || this.capabilities.hasPermission('billing.create'));
  }

  get canSave(): boolean {
    return !this.sinApertura
      && !!this.cierre.apertura
      && (Number(this.cierre.efectivo_real) || 0) >= 0
      && !this.loadingData
      && !this.saving;
  }

  private hasOpening(value: any): boolean {
    if (typeof value === 'string') return value.trim().length > 0;
    return Boolean(String(value?.name || value?.cash_opening || value?.apertura || '').trim());
  }

  private toNumber(value: unknown): number {
    return cashNumber(value);
  }

  private normalizePaymentTotals(response: any): Array<{ payment_method: string; payment_code: string; amount: number }> {
    const rows = Array.isArray(response?.payment_totals)
      ? response.payment_totals
      : Array.isArray(response?.payments)
        ? response.payments
        : Object.entries(response?.payments || response?.detalle || {}).map(([payment_method, amount]) => ({ payment_method, amount }));
    const codes: Record<string, string> = {
      efectivo: '01', cash: '01',
      'tarjeta de credito/debito': '19', tarjeta: '19', card: '19',
      transferencia: '20', transfer: '20'
    };
    return rows.map((row: any) => {
      const rawMethod = String(row?.payment_method ?? row?.metodo_pago ?? row?.method ?? row?.name ?? 'Otros');
      const explicitCode = String(row?.payment_code ?? row?.codigo ?? '').trim();
      const paymentCode = /^\d{1,2}$/.test(explicitCode)
        ? explicitCode.padStart(2, '0')
        : (/^\d{1,2}$/.test(rawMethod) ? rawMethod.padStart(2, '0') : (codes[rawMethod.toLowerCase()] ?? '21'));
      return {
        payment_method: /^\d{1,2}$/.test(rawMethod) ? this.paymentLabel(paymentCode) : rawMethod,
        payment_code: paymentCode,
        amount: Number(row?.amount ?? row?.total ?? row?.monto ?? row?.system_amount ?? 0) || 0
      };
    }).filter((row: { payment_method: string; payment_code: string; amount: number }) => row.amount >= 0);
  }

  private paymentLabel(code: string): string {
    return ({ '01': 'Efectivo', '19': 'Tarjeta de credito/debito', '20': 'Transferencia' } as Record<string, string>)[code] || 'Otros';
  }

  private errorMessage(error: any): string {
    if (isForbidden(error)) return 'No tienes permiso para administrar la caja';
    return readCashBackendMessage(error);
  }
}
