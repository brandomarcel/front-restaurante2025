import { Component, OnInit } from '@angular/core';
import * as XLSX from 'xlsx';
import { CajasService } from 'src/app/services/cajas.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UtilsService } from '../../../core/services/utils.service';
import { UserService } from '../../../services/user.service';
import { ButtonComponent } from "src/app/shared/components/button/button.component";
import { NgSelectComponent } from "@ng-select/ng-select";
import { NgxSpinnerService } from 'ngx-spinner';
import { finalize } from 'rxjs';
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
    usuario: null as string | null,
    desde: '',
    hasta: ''
  };

  today = '';

  usuarios: any[] = [];

  // Filtros
  filtrosUsers = {
    usuario: null as string | null,
    rol: ''
  };

  loadingUsers = false;
  loadingCierres = false;
  loadingExport = false;
  private loadingCounter = 0;

  constructor(private cajasService: CajasService,
    private utilsService: UtilsService,
    private usersService: UserService,
    private spinner: NgxSpinnerService,
  ) { }

  ngOnInit(): void {
    this.today = String(this.utilsService.getSoloFechaEcuador());
    this.filters.desde = this.today;
    this.filters.hasta = this.today;

    const user = this.getCurrentUser();
    this.filtrosUsers.usuario = user?.email || null;

    this.cargarUsuarios();
    this.buscar(); // Carga inicial
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

  cargarUsuarios(): void {
    this.loadingUsers = true;
    this.beginLoading();
    this.usersService.listByCompany({
      search: undefined,
      limit: 1000
    }).pipe(
      finalize(() => {
        this.loadingUsers = false;
        this.endLoading();
      })
    ).subscribe({
      next: (rows: any[]) => {
        this.usuarios = rows;
      },
      error: (err) => {
        console.error('Error al cargar usuarios:', err);
        this.usuarios = [];
      }
    });
  }

  /** 🔍 Buscar cierres según filtros */
  buscar(): void {
    if (!this.filters.desde || !this.filters.hasta) return;

    this.loadingCierres = true;
    this.beginLoading();
    this.cajasService.obtenerReporteCierres(
      this.filters.usuario || '',
      this.filters.desde,
      this.filters.hasta
    ).pipe(
      finalize(() => {
        this.loadingCierres = false;
        this.endLoading();
      })
    ).subscribe({
      next: (res) => {
        const data = res?.message?.data || res?.data || res;
        this.cierres = Array.isArray(data) ? data : [];

        if (this.cierreSeleccionado && !this.cierres.some((c: any) => c?.name === this.cierreSeleccionado)) {
          this.cierreSeleccionado = null;
        }
      },
      error: (err) => {
        console.error('Error al obtener cierres:', err);
        this.cierres = [];
      }
    });
  }

  /** 📦 Exportar los cierres con detalle a Excel */
  exportarExcel(): void {
    if (!this.cierres.length || this.loadingExport) return;

    this.loadingExport = true;
    this.beginLoading();

    setTimeout(() => {
      try {
        const datosPlano: any[] = [];
        const metodosUnicos = new Set<string>();

        this.cierres.forEach(c => c.detalle?.forEach((p: any) => metodosUnicos.add(p.metodo_pago)));

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

          metodosUnicos.forEach((metodo) => {
            fila[metodo] = 0;
          });

          cierre.detalle?.forEach((pago: any) => {
            fila[pago.metodo_pago] = pago.monto;
          });

          datosPlano.push(fila);
        });

        const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(datosPlano);
        const wb: XLSX.WorkBook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Cierres de Caja');

        XLSX.writeFile(wb, `cierres_de_caja_${this.filters.desde}_${this.filters.hasta}.xlsx`);
      } finally {
        this.loadingExport = false;
        this.endLoading();
      }
    }, 0);
  }

}
