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
        const apertura = respuesta?.apertura ?? null;

        this.sinApertura = !apertura;
        if (this.sinApertura) {
          this.resetCajaValores();
          return;
        }

        this.cierre.apertura = apertura;
        this.cierre.monto_apertura = Number(respuesta?.monto_apertura) || 0;
        this.cierre.efectivo_sistema = Number(respuesta?.efectivo_sistema) || 0;
        this.cierre.total_retiros = Number(respuesta?.total_retiros) || 0;
        this.detallePorMetodo = respuesta?.detalle || {};
        this.calcularDiferencia();
      },
      error: (error) => {
        console.warn('No hay apertura activa o no se pudo cargar datos de cierre:', error);
        this.resetCajaValores();
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

    const detalle = Object.keys(this.detallePorMetodo).map(key => ({
      metodo_pago: key,
      monto: this.detallePorMetodo[key]
    }));

    const data = {
      ...this.cierre,
      detalle
    };

    this.saving = true;
    this.beginLoading();
    this.cajasService.create_cierre_de_caja(data).pipe(
      finalize(() => {
        this.saving = false;
        this.endLoading();
      })
    ).subscribe({
      next: () => {
        this.alertService.success('Cierre guardado correctamente');
        this.cleanCaja();
      },
      error: (error) => {
        console.error('Error al guardar cierre:', error);
        this.alertService.error('No se pudo guardar el cierre de caja.');
      }
    });
  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj || {});
  }

  get totalEsperado(): number {
    return (Number(this.cierre.monto_apertura) || 0) + (Number(this.cierre.efectivo_sistema) || 0);
  }

  get canSave(): boolean {
    return !this.sinApertura
      && !!this.cierre.apertura
      && (Number(this.cierre.efectivo_real) || 0) >= 0
      && !this.loadingData
      && !this.saving;
  }
}
