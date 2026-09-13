import { Component, OnInit } from '@angular/core';
import { CajasService } from 'src/app/services/cajas.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { AlertService } from 'src/app/core/services/alert.service';
import { finalize } from 'rxjs';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-close-caja',
  imports: [CommonModule, FormsModule, ButtonComponent],
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

  detallePorMetodo: any = {};
  paymentTotals: Array<{ payment_method: string; payment_code: string; amount: number }> = [];
  lastClose: any | null = null;
  sinApertura = true;
  loadingData = false;
  saving = false;
  private loadingCounter = 0;

  constructor(
    private cajasService: CajasService,
    private alertService: AlertService,
    private spinner: NgxSpinnerService
  ) { }

  ngOnInit(): void {
    const user = this.getCurrentUser();
    this.cierre.usuario = user?.email || '';
    this.getDatosCierre();
  }

  private getCurrentUser(): { email?: string } | null {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return null;
    }
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

  private resetCajaValores(): void {
    this.cierre.apertura = '';
    this.sinApertura = true;
    this.cierre.monto_apertura = 0;
    this.cierre.efectivo_sistema = 0;
    this.cierre.total_retiros = 0;
    this.cierre.efectivo_real = 0;
    this.cierre.diferencia = 0;
    this.cierre.observaciones = '';
    this.detallePorMetodo = {};
    this.paymentTotals = [];
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
        const respuesta = response?.message ?? {};
        const apertura = respuesta?.apertura ?? respuesta?.cash_opening ?? null;

        this.sinApertura = !apertura;
        if (this.sinApertura) {
          this.resetCajaValores();
          return;
        }

        this.cierre.apertura = typeof apertura === 'string'
          ? apertura
          : (apertura?.name || (typeof apertura?.cash_opening === 'string' ? apertura.cash_opening : ''));
        this.cierre.monto_apertura = Number(respuesta?.monto_apertura ?? respuesta?.opening_amount) || 0;
        this.cierre.efectivo_sistema = this.getPaymentAmount(respuesta, '01');
        this.cierre.total_retiros = Number(respuesta?.total_retiros) || 0;
        this.paymentTotals = this.normalizePaymentTotals(respuesta);
        this.detallePorMetodo = this.paymentTotals.reduce((result, payment) => {
          result[payment.payment_code] = payment.amount;
          return result;
        }, {} as Record<string, number>);
        this.calcularDiferencia();
      },
      error: (error) => {
        console.warn('No hay apertura activa o no se pudo cargar datos de cierre:', error);
        this.resetCajaValores();
        this.alertService.error(this.readBackendMessage(error) || 'No se pudo consultar la apertura de caja.');
      }
    });
  }

  cleanCaja(): void {
    this.resetCajaValores();
  }

  onEfectivoRealChange(valor: number) {
    const parsed = Number(valor);
    this.cierre.efectivo_real = Number.isFinite(parsed) ? parsed : 0;
    this.calcularDiferencia();
  }

  calcularDiferencia() {
    const esperado = (Number(this.cierre.monto_apertura) || 0) + (Number(this.cierre.efectivo_sistema) || 0);
    const totalCaja = (Number(this.cierre.efectivo_real) || 0) + (Number(this.cierre.total_retiros) || 0);
    this.cierre.diferencia = Math.round((totalCaja - esperado) * 100) / 100;
  }

  guardarCierre() {
    if (!this.canSave) {
      return;
    }

    const data = {
      cash_opening: this.cierre.apertura,
      cash_counted: Number(this.cierre.efectivo_real) || 0,
      payments: (this.paymentTotals.length ? this.paymentTotals : [{ payment_method: 'Efectivo', payment_code: '01', amount: 0 }]).map((payment) => ({
        payment_method: payment.payment_method,
        payment_code: payment.payment_code,
        counted_amount: payment.payment_code === '01'
          ? Number(this.cierre.efectivo_real) || 0
          : payment.amount
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
        this.lastClose = response?.message?.data ?? response?.data ?? response?.message ?? response;
        this.cleanCaja();
      },
      error: (error) => {
        console.error('Error al guardar cierre:', error);
        this.alertService.error(this.readBackendMessage(error) || 'No se pudo guardar el cierre de caja.');
      }
    });
  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  get totalEsperado(): number {
    return (Number(this.cierre.monto_apertura) || 0)
      + (Number(this.cierre.efectivo_sistema) || 0)
      - (Number(this.cierre.total_retiros) || 0);
  }

  paymentAmount(code: string): number {
    return this.paymentTotals
      .filter((payment) => payment.payment_code === code)
      .reduce((sum, payment) => sum + payment.amount, 0);
  }

  get canSave(): boolean {
    return !this.sinApertura
      && !!this.cierre.apertura
      && (Number(this.cierre.efectivo_real) || 0) >= 0
      && !this.loadingData
      && !this.saving;
  }

  private getPaymentAmount(response: any, code: string): number {
    return this.normalizePaymentTotals(response)
      .filter((payment) => payment.payment_code === code)
      .reduce((sum, payment) => sum + payment.amount, 0);
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

  private readBackendMessage(error: any): string {
    const payload = error?.error ?? error;
    const direct = payload?.message ?? payload?.msg ?? payload?._server_messages;
    if (Array.isArray(direct)) return direct.map((item: any) => String(item?.message || item)).join(' ');
    if (direct && typeof direct === 'object') return String(direct.message || direct.error || direct.msg || '');
    if (typeof direct === 'string') {
      try {
        const parsed = JSON.parse(direct);
        if (Array.isArray(parsed)) return parsed.map((item: any) => String(item?.message || item)).join(' ');
      } catch { /* mensaje plano */ }
      return direct;
    }
    return error?.message || '';
  }
}
