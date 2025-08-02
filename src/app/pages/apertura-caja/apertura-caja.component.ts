import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { CajasService } from 'src/app/services/cajas.service';
import { AlertService } from 'src/app/core/services/alert.service';

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

  constructor(private cajasService: CajasService,
    private alertService: AlertService
  ) { }

  ngOnInit(): void {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    this.apertura.usuario = user.email;

    this.verificarCajaAbierta();
  }

  verificarCajaAbierta() {
    this.cajasService.verificarAperturaActiva(this.apertura.usuario).subscribe(res => {
      this.cajaActiva = res.data.length > 0;
    });
  }

  abrirCaja() {
    const data = {
      ...this.apertura,
      fecha_hora: this.getFechaHoraEcuador()
    };

    this.cajasService.crearAperturaCaja(data).subscribe(() => {
      this.alertService.success('Caja abierta correctamente');
      this.cajaActiva = true;
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
}