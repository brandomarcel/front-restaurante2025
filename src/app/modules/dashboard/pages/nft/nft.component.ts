import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { OrdersService } from '../../../../services/orders.service';
import { CajasService } from 'src/app/services/cajas.service';
import { CompanyService } from '../../../../services/company.service';
import { UserData } from 'src/app/core/models/user_data';
import { firstValueFrom, forkJoin, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { isNullOrEmpty } from 'src/app/shared/utils/validation';
import { AvisosComponent } from "src/app/shared/components/avisos/avisos.component";
import { diasRestantes } from 'src/app/shared/utils/date.utils';

// Interfaz para los avisos
interface Aviso {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: 'error' | 'warning' | 'info' | 'success';
  fecha: Date;
}

interface CompanyData {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  firma?: boolean;
  cert_not_after?: string;
  cert_not_before?: string;
}

@Component({
  selector: 'app-nft',
  templateUrl: './nft.component.html',
  standalone: true,
  imports: [CommonModule, RouterModule, AvisosComponent]
})
export class NftComponent implements OnInit, OnDestroy {

  // Métricas
  totalOrdersToday = 0;
  total_sales_today = 0;
  montoApertura = 0;
  totalRetiros = 0;
  efectivoSistema = 0;
  topProducts: any[] = [];

  // Nuevas propiedades
  userData?: UserData | null;
  companyData?: CompanyData;
  avisos: Aviso[] = [];

  private destroy$ = new Subject<void>();
  private avisoCounter = 0;

  constructor(
    private ordersService: OrdersService,
    private cajasService: CajasService,
    private companyService: CompanyService
  ) { }

  ngOnInit(): void {
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadData() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    console.log('user', user);
    this.userData = user;
    this.getDatosCierre();
    forkJoin({
      dashboard: this.ordersService.get_dashboard_metrics(),
      empresa: this.companyService.get_empresa(),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results: any) => {
          console.warn('RESULTS', results);
          this.procesarDashboard(results.dashboard);
          this.procesarEmpresa(results.empresa);
          this.generarAvisos();
        },
        error: (err: any) => {
          console.error('Error al obtener datos:', err);
        }
      });

  }

  private procesarDashboard(response: any): void {
    try {
      const data = response?.message;
      if (data) {
        this.totalOrdersToday = data.total_orders_today || 0;
        this.total_sales_today = data.total_sales_today || 0;
        this.topProducts = data.top_products || [];
      }
    } catch (error) {
      console.error('Error procesando dashboard:', error);
    }
  }

  async procesarEmpresa(data: any) {
    try {
      const resp = data?.message;
      console.log('data Empresa', resp.urlfirma);
      if (resp) {
        this.companyData = {
          name: resp.name || 'Sin nombre',
          phone: resp.phone,
          email: resp.email,
          address: resp.address,
          firma: isNullOrEmpty(resp.urlfirma),
          cert_not_after: resp.cert_not_after,
          cert_not_before: resp.cert_not_before

        };
      }
    } catch (error) {
      console.error('Error procesando empresa:', error);
    }
  }

  async getDatosCierre() {

    const userEmail: string = String(this.userData?.email || '');
    console.log('userEmail', userEmail);

    try {
      const resp: any = await firstValueFrom(this.cajasService.getDatosCierre(userEmail))
      console.log('resp', resp);
      const data = resp?.message || {};
      this.montoApertura = data.monto_apertura || 0;
      this.totalRetiros = data.total_retiros || 0;
      this.efectivoSistema = data.efectivo_sistema || 0;
    } catch (error) {
      console.error('Error datos cierre:', error);
    }
  }

  // Método para generar avisos según la lógica de negocio
  private generarAvisos(): void {
    // Limpiar avisos previos
    this.avisos = [];
    if (this.companyData?.firma) {
      this.agregarAviso('Aviso', 'Ingrese su firma electronica para poder emitir facturas.',
        'warning');
    }
    // Ejemplo: Sin apertura de caja
    if (!this.montoApertura) {
      this.agregarAviso(
        'Caja',
        'No hay apertura de caja activa. Por favor, realiza la apertura.',
        'warning'
      );
    }

    const dateEndCert: string = String(this.companyData?.cert_not_after || null);
    if (dateEndCert) {
      const dias = diasRestantes(dateEndCert);
      if (dias <= 30 && dias > 0) {
        this.agregarAviso(
          'Firma Digital',
          `La firma digital vencera en ${dias} día(s).`,
          'warning'
        );
      } else if (dias <= 0) {
        this.agregarAviso(
          'Firma Digital',
          'La firma digital ha expirado',
          'error'
        );
      }
    }





    // Ejemplo: Diferencia en efectivo
    // if (this.montoApertura > 0) {
    //   const diferencia = this.efectivoSistema - this.montoApertura + this.totalRetiros;
    //   if (Math.abs(diferencia) > 50) {
    //     this.agregarAviso(
    //       '💰 Posible Faltante de Caja',
    //       `Hay una diferencia de $${diferencia.toFixed(2)} en el efectivo.`,
    //       'error'
    //     );
    //   }
    // }

    // Ejemplo: Muchos pedidos
    // if (this.totalOrdersToday > 50) {
    //   this.agregarAviso(
    //     'Alto Volumen de Ventas',
    //     `Has registrado ${this.totalOrdersToday} pedidos hoy. ¡Excelente desempeño!`,
    //     'success'
    //   );
    // }

    // Ejemplo: Sin ventas
    // if (this.totalOrdersToday === 0 && this.userData) {
    //   this.agregarAviso(
    //     'ℹSin Ventas',
    //     'Aún no hay pedidos registrados hoy.',
    //     'info'
    //   );
    // }

    // Ejemplo: Retiros pendientes
    // if (this.totalRetiros > 100) {
    //   this.agregarAviso(
    //     'Retiros Elevados',
    //     `Se han retirado $${this.totalRetiros.toFixed(2)} durante el turno.`,
    //     'warning'
    //   );
    // }


  }

  // Método público para agregar avisos manualmente
  agregarAviso(titulo: string, mensaje: string, tipo: 'error' | 'warning' | 'info' | 'success'): void {
    console.log('Agregar aviso:', { titulo, mensaje, tipo });
    const aviso: Aviso = {
      id: `aviso_${this.avisoCounter++}`,
      titulo,
      mensaje,
      tipo,
      fecha: new Date()
    };
    this.avisos.push(aviso);
    console.log('avisos', this.avisos);
  }

  // Método para eliminar un aviso
  eliminarAviso(id: string): void {
    this.avisos = this.avisos.filter(aviso => aviso.id !== id);
  }

  // Método para limpiar todos los avisos
  limpiarAvisos(): void {
    this.avisos = [];
  }
}