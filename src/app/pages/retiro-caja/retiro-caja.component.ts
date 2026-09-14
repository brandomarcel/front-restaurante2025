import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertService } from 'src/app/core/services/alert.service';
import { CajasService } from 'src/app/services/cajas.service';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';

@Component({
  selector: 'app-retiro-caja',
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './retiro-caja.component.html',
  styleUrls: ['./retiro-caja.component.css']
})
export class RetiroCajaComponent implements OnInit {
  retiro = {
    usuario: '',
    motivo: '',
    monto: 0,
    fecha_hora: '',
    relacionado_a: '' // opcional: puedes enlazar a la apertura si quieres
  };

  cajaActiva = false;
  cashOpening: any | null = null;
  cashStatus = 'Sin apertura activa';
  montoApertura = 0;
  efectivoSistema = 0;
  diferencia: number | null = null;
  loading = false;
  loadingWithdrawals = false;
  error = '';

  retiros: any[] = [];
  totalRetiros = 0;
  constructor(private cajasService: CajasService,
    private alertService: AlertService,
    public capabilities: CompanyCapabilitiesService
  ) { }

  ngOnInit(): void {
    const user = this.getCurrentUser();
    this.retiro.usuario = user.email;

    this.verificarCajaAbierta();
  }

  verificarCajaAbierta() {
    this.loading = true;
    this.error = '';
    this.cajaActiva = false;
    this.cashOpening = null;
    this.cashStatus = 'Sin apertura activa';
    this.retiro.relacionado_a = '';
    this.retiros = [];
    this.totalRetiros = 0;
    this.montoApertura = 0;
    this.efectivoSistema = 0;
    this.diferencia = null;
    this.cajasService.verificarAperturaActiva(this.retiro.usuario).subscribe({
      next: (res: any) => {
        this.loading = false;
        const body = res?.message ?? res ?? {};
        const normalized = body?.data && !Array.isArray(body.data) ? body.data : body;
        const candidateOpening = normalized?.cash_opening
          ?? normalized?.apertura
          ?? normalized?.opening
          ?? normalized?.last_cash_opening
          ?? (Array.isArray(res?.data) ? res.data[0] : null);
        const opening = this.hasOpeningRecord(candidateOpening) ? candidateOpening : null;
        const status = this.normalizeStatus(
          opening?.status
          ?? opening?.estado
          ?? normalized?.opening_status
          ?? normalized?.status
        );
        const isClosed = ['CERRADA', 'CLOSED', 'CANCELADA', 'CANCELLED'].includes(status);
        this.cashOpening = opening || null;
        this.cajaActiva = !!opening && !isClosed;
        this.cashStatus = this.cajaActiva
          ? 'Abierta'
          : (opening && isClosed ? 'Cerrada' : 'Sin apertura activa');
        this.retiro.relacionado_a = this.openingName(opening);
        this.montoApertura = this.toNumber(normalized?.monto_apertura ?? normalized?.opening_amount ?? opening?.monto_apertura ?? opening?.opening_amount);
        this.efectivoSistema = this.toNumber(normalized?.efectivo_sistema ?? normalized?.system_cash ?? opening?.efectivo_sistema);
        this.diferencia = this.readNullableNumber(normalized?.diferencia ?? normalized?.difference ?? opening?.diferencia ?? opening?.difference);
        this.loadDashboardMetrics();
        this.obtenerRetiros();
      },
      error: (error) => {
        this.loading = false;
        this.error = this.errorMessage(error);
        this.alertService.error(this.error);
      }
    });
  }

  private loadDashboardMetrics(): void {
    this.cajasService.getDashboardMetrics().subscribe({
      next: (response: any) => {
        const message = response?.message ?? response ?? {};
        const cash = message?.data?.cash ?? message?.cash ?? null;
        if (!cash) return;
        this.montoApertura = this.toNumber(cash.monto_apertura ?? cash.opening_amount ?? this.montoApertura);
        this.efectivoSistema = this.toNumber(cash.efectivo_sistema ?? cash.expected_cash ?? this.efectivoSistema);
        this.diferencia = this.readNullableNumber(cash.difference ?? cash.diferencia ?? this.diferencia);
      },
      error: () => { /* La apertura sigue siendo utilizable si no hay métricas. */ }
    });
  }

  registrarRetiro() {
    if (!this.canSubmit) {
      return;
    }

    const data = {
      cash_opening: this.retiro.relacionado_a,
      amount: Number(this.retiro.monto),
      reason: String(this.retiro.motivo || '').trim()
    };

    this.cajasService.create_retiro_de_caja(data).subscribe({
      next: () => {
        this.alertService.success('Retiro registrado correctamente');
        this.retiro.motivo = '';
        this.retiro.monto = 0;
        this.verificarCajaAbierta();
      },
      error: (error) => this.alertService.error(this.errorMessage(error) || 'No se pudo registrar el retiro.')
    });
  }

  /** Fecha y hora local Ecuador en formato compatible */
  getFechaHoraEcuador(): string {
    const date = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' })
    );

    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }


  obtenerRetiros() {
    this.loadingWithdrawals = true;
    this.cajasService.getCashWithdrawals().subscribe({
      next: (res: any) => {
        this.loadingWithdrawals = false;
        const body = res?.message ?? res ?? {};
        const rows = Array.isArray(body?.data)
          ? body.data
          : (Array.isArray(res?.data) ? res.data : (body?.withdrawals ?? body?.retiros ?? body?.cash_withdrawals ?? []));
        const allRows = Array.isArray(rows) ? rows : [];
        const openingId = this.retiro.relacionado_a;
        // “Mi Caja” siempre muestra únicamente el turno del usuario actual.
        // La consulta consolidada para otros usuarios vive en Gestión de Cajas.
        this.retiros = allRows.filter((row: any) => this.openingName(row?.cash_opening ?? row?.apertura) === openingId);
        const calculated = this.retiros.reduce((acc, row) => acc + this.toNumber(row?.amount ?? row?.monto), 0);
        this.totalRetiros = calculated;
      },
      error: (error) => {
        this.loadingWithdrawals = false;
        this.error = this.errorMessage(error);
        this.alertService.error(this.error);
      }
    });
  }

eliminarRetiro(name: string) {
  const confirmacion = confirm('¿Estás seguro de eliminar este retiro?');

  if (confirmacion) {
    this.cajasService.eliminarRetiro(name).subscribe(() => {
      this.alertService.success('Retiro eliminado correctamente');
      this.obtenerRetiros(); 
    });
  }
}

  get canSubmit(): boolean {
    return this.cajaActiva
      && !this.loading
      && !this.loadingWithdrawals
      && Number(this.retiro.monto) > 0
      && String(this.retiro.motivo || '').trim().length > 0;
  }

  private getCurrentUser(): { email: string } {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return { email: String(user?.email || '').trim() };
    } catch {
      return { email: '' };
    }
  }

  private openingName(opening: any): string {
    if (typeof opening === 'string') return opening.trim();
    return String(opening?.name || opening?.cash_opening || opening?.apertura || '').trim();
  }

  private hasOpeningRecord(opening: any): boolean {
    return this.openingName(opening).length > 0;
  }

  private normalizeStatus(value: unknown): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  }

  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private readNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private errorMessage(error: any): string {
    const status = Number(error?.status ?? error?.error?.status ?? 0);
    if (status === 403) return 'No tienes permiso para administrar la caja.';
    return this.readBackendMessage(error) || 'No se pudo consultar la información de caja.';
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
