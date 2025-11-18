import { Component, OnInit } from '@angular/core';
import { CajasService } from 'src/app/services/cajas.service';
import { AuthService } from 'src/app/services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { AlertService } from 'src/app/core/services/alert.service';
import { firstValueFrom } from 'rxjs';

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

  constructor(
    private cajasService: CajasService,
    private alertService: AlertService
  ) { }

  ngOnInit(): void {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    this.cierre.usuario = user.email;

    this.getDatosCierre();

  }

  async getDatosCierre() {

    try {

      const response = await firstValueFrom(this.cajasService.getDatosCierre(this.cierre.usuario));
      console.log('getDatosCierre', response);
      const respuesta = response.message;
      this.sinApertura = false;
      this.cierre.apertura = respuesta.apertura;
      this.cierre.monto_apertura = respuesta.monto_apertura;
      this.cierre.efectivo_sistema = respuesta.efectivo_sistema;
      this.cierre.total_retiros = respuesta.total_retiros;
      this.detallePorMetodo = respuesta.detalle;
      this.calcularDiferencia();
    } catch (error) {
      console.warn('No hay apertura activa:', error);
    }
  }

  cleanCaja() {
    this.sinApertura = true;
    this.cierre.monto_apertura = 0;
    this.cierre.efectivo_sistema = 0;
    this.cierre.total_retiros = 0;
    this.cierre.efectivo_real = 0;
    this.cierre.diferencia = 0;
    this.detallePorMetodo = {};
  }

  onEfectivoRealChange(valor: number) {
    this.cierre.efectivo_real = valor;
    this.calcularDiferencia();
  }

  calcularDiferencia() {
    const esperado = this.cierre.monto_apertura + this.cierre.efectivo_sistema;
    const totalCaja = this.cierre.efectivo_real + this.cierre.total_retiros;
    this.cierre.diferencia = Math.round((totalCaja - esperado) * 100) / 100;
  }

  guardarCierre() {
    const detalle = Object.keys(this.detallePorMetodo).map(key => ({
      metodo_pago: key,
      monto: this.detallePorMetodo[key]
    }));

    const data = {
      ...this.cierre,
      detalle
    };

    this.cajasService.crearCierreCaja(data).subscribe(() => {

      this.alertService.success('Cierre guardado correctamente');
      this.cleanCaja();
    });
  }

  objectKeys(obj: any): string[] {
    return Object.keys(obj);
  }
}