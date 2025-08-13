import { Component, OnInit } from '@angular/core';
import * as XLSX from 'xlsx';
import { CajasService } from 'src/app/services/cajas.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UtilsService } from '../../../core/services/utils.service';
import { UserService } from '../../../services/user.service';
import { ButtonComponent } from "src/app/shared/components/button/button.component";
import { NgSelectComponent } from "@ng-select/ng-select";
@Component({
  selector: 'app-report-cierre-caja',
  imports: [CommonModule, FormsModule, ButtonComponent, NgSelectComponent],
  templateUrl: './report-cierre-caja.component.html',
  styleUrl: './report-cierre-caja.component.css'
})
export class ReportCierreCajaComponent implements OnInit {
  cierres: any[] = [];
  cierreSeleccionado: string | null = null;

  // Filtros
  filters = {
    usuario: '',
    desde: '',
    hasta: ''
  };

  today: any;

  usuarios: any[] = [];

  // Filtros
  filtrosUsers = {
    usuario: null,
    rol: ''
  };

  constructor(private cajasService: CajasService,
    private utilsService: UtilsService,
    private userService: UserService
  ) { }

  ngOnInit(): void {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    this.filtrosUsers.usuario = user.email;

    this.cargarUsuarios();

    this.buscar(); // Carga inicial
    this.today = this.utilsService.getSoloFechaEcuador();
  }


  cargarUsuarios(): void {
    this.userService.getUsuariosConRoles(this.filtrosUsers.usuario || ''  , this.filtrosUsers.rol)
      .subscribe({
        next: (res) => {
          console.log('Usuarios con roles obtenidos:', res);
          this.usuarios = res.message || res;
        },
        error: (err) => {
          console.error('Error al obtener usuarios con roles:', err);
        }
      });
  }

  /** 🔍 Buscar cierres según filtros */
  buscar(): void {
    this.cajasService.obtenerReporteCierres(
      this.filters.usuario,
      this.filters.desde,
      this.filters.hasta
    ).subscribe({
      next: (res) => {
        this.cierres = res.message || res; // depende si tu backend usa return o frappe.response
      },
      error: (err) => {
        console.error('Error al obtener cierres:', err);
      }
    });
  }

  /** 📦 Exportar los cierres con detalle a Excel */
  exportarExcel(): void {
    const datosPlano: any[] = [];

    // Obtener todos los métodos de pago únicos (para usar como columnas dinámicas)
    const metodosUnicos = new Set<string>();
    this.cierres.forEach(c => c.detalle?.forEach((p: any) => metodosUnicos.add(p.metodo_pago)));

    // Generar los datos combinados
    this.cierres.forEach((cierre) => {
      const fila: any = {
        Fecha: new Date(cierre.fecha_hora).toLocaleString(),
        Usuario: cierre.usuario,
        Apertura: cierre.apertura,
        'Monto Apertura': cierre.monto_apertura,
        'Sistema (Efectivo)': cierre.efectivo_sistema,
        'Efectivo Real': cierre.efectivo_real,
        Retiros: cierre.total_retiros,
        Diferencia: cierre.diferencia,
        Estado: cierre.estado
      };

      // Inicializar columnas de métodos con 0
      metodosUnicos.forEach(metodo => {
        fila[metodo] = 0;
      });

      // Llenar montos por método en su respectiva columna
      cierre.detalle?.forEach((pago: any) => {
        fila[pago.metodo_pago] = pago.monto;
      });

      datosPlano.push(fila);
    });

    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(datosPlano);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cierres de Caja');

    XLSX.writeFile(wb, 'cierres_de_caja.xlsx');
  }

}