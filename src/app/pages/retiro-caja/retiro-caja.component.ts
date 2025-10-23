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
    this.cajasService.verificarAperturaActiva(this.retiro.usuario).subscribe(res => {
      if (res.data.length > 0) {
        this.cajaActiva = true;
        this.retiro.relacionado_a = res.data[0].name; // opcional, si quieres vincular
        this.obtenerRetiros(); // cargar retiros al iniciar
      } else {
        this.cajaActiva = false;
      }
    });
  }

  registrarRetiro() {
    const data = {
      ...this.retiro,
      fecha_hora: this.getFechaHoraEcuador()
    };

    this.cajasService.registrarRetiro(data).subscribe(() => {
  
      this.alertService.success('Retiro registrado correctamente');
      this.retiro.motivo = '';
      this.retiro.monto = 0;
      this.obtenerRetiros();

    });
  }

  /** 📆 Fecha y hora local Ecuador en formato compatible */
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

    this.cajasService.getRetirosPorApertura(this.retiro.relacionado_a).subscribe(res => {
      console.log('Retiros obtenidos:', res);
      this.retiros = res.data;
      this.totalRetiros = this.retiros.reduce((acc, r) => acc + r.monto, 0);
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

}
