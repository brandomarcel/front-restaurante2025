import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertService } from 'src/app/core/services/alert.service';
import { CajasService } from 'src/app/services/cajas.service';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';

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

  retiros: any[] = [];
  totalRetiros = 0;
  constructor(private cajasService: CajasService,
    private alertService: AlertService
  ) { }

  ngOnInit(): void {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    this.retiro.usuario = user.email;

    this.verificarCajaAbierta();
  }

  verificarCajaAbierta() {
    this.cajasService.verificarAperturaActiva(this.retiro.usuario).subscribe({
      next: (res: any) => {
      const opening = res?.message?.apertura || (Array.isArray(res?.data) ? res.data[0] : null);
      const status = String(opening?.status || opening?.estado || 'Abierta').toLowerCase();
      if (opening && status !== 'cerrada' && status !== 'closed') {
        this.cajaActiva = true;
        this.cashOpening = opening;
        this.retiro.relacionado_a = typeof opening === 'string'
          ? opening
          : (opening.name || (typeof opening.cash_opening === 'string' ? opening.cash_opening : ''));
        this.totalRetiros = Number(res?.message?.total_retiros || opening.total_retiros || 0);
        this.obtenerRetiros();
      } else {
        this.cajaActiva = false;
        this.cashOpening = null;
      }
      },
      error: (error) => this.alertService.error(this.readBackendMessage(error) || 'No se pudo consultar la caja.')
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
      error: (error) => this.alertService.error(this.readBackendMessage(error) || 'No se pudo registrar el retiro.')
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
    if (!this.retiro.relacionado_a) return;

    this.cajasService.getRetirosPorApertura(this.retiro.relacionado_a).subscribe({
      next: (res: any) => {
        const data = res?.message || {};
        this.retiros = data.withdrawals || data.retiros || data.cash_withdrawals || this.cashOpening?.withdrawals || [];
        this.totalRetiros = Number(data.total_retiros) || this.retiros.reduce((acc, r) => acc + Number(r.amount ?? r.monto ?? 0), 0);
      },
      error: (error) => this.alertService.error(this.readBackendMessage(error) || 'No se pudo cargar el historial de retiros.')
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
    return this.cajaActiva && Number(this.retiro.monto) > 0 && String(this.retiro.motivo || '').trim().length > 0;
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
