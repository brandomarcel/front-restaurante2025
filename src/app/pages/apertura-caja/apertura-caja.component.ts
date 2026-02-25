import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { CajasService } from 'src/app/services/cajas.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-apertura-caja',
  imports: [CommonModule, FormsModule, ButtonComponent],
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
  loadingStatus = false;
  saving = false;
  private loadingCounter = 0;

  constructor(private cajasService: CajasService,
    private alertService: AlertService,
    private spinner: NgxSpinnerService
  ) { }

  ngOnInit(): void {
    const user = this.getCurrentUser();
    this.apertura.usuario = user?.email || '';

    this.verificarCajaAbierta();
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
        this.cajaActiva = Array.isArray(res?.data) && res.data.length > 0;
      },
      error: (error) => {
        console.error('Error al verificar apertura activa:', error);
        this.cajaActiva = false;
      }
    });
  }

  abrirCaja(): void {
    if (!this.canSubmit) {
      return;
    }

    const data = {
      ...this.apertura,
      fecha_hora: this.getFechaHoraEcuador()
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
        this.cajaActiva = true;
      },
      error: (error) => {
        console.error('Error al abrir caja:', error);
        this.alertService.error('No se pudo abrir la caja.');
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
      && Number(this.apertura.monto_apertura) > 0
      && !this.loadingStatus
      && !this.saving;
  }
}
