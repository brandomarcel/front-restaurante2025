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
  idApertura:string = '';
  montoApertura = 0;
  totalRetiros = 0;
  efectivoSistema = 0;
  topProducts: any[] = [];
  today = new Date();
  certDaysLeft: number | null = null;

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
    this.userData = user;
    const userEmail: string = String(this.userData?.email || '');
    this.getDatosCierre();

    forkJoin({
      dashboard: this.ordersService.get_dashboard_metrics(),
      empresa: this.companyService.get_empresa()
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (results: any) => {
          this.procesarDashboard(results.dashboard);
          this.procesarEmpresa(results.empresa);
          this.generarAvisos();
        },
        error: (err: any) => {
          console.error('Error al obtener datos:', err);
        }
      });

  }
    async getDatosCierre() {

    const userEmail: string = String(this.userData?.email || '');
    console.log('userEmail', userEmail);

      const resp: any = await firstValueFrom(this.cajasService.getDatosCierre(userEmail))
      console.log('resp', resp);
      const data = resp?.message || {};
      this.idApertura = data.apertura;
      this.montoApertura = data.monto_apertura || 0;
      this.totalRetiros = data.total_retiros || 0;
      this.efectivoSistema = data.efectivo_sistema || 0;
 
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

  procesarEmpresa(data: any) {
    try {
      const resp = data?.message;
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

  private procesarCierre(resp: any): void {
    try {
      const data = resp?.message || {};
      this.idApertura = data.apertura || '';
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
      this.agregarAviso('Aviso', 'Ingrese su firma para poder emitir facturas.',
        'warning');
    }
  
    if (!this.idApertura) {
      this.agregarAviso(
        'Caja',
        'No hay apertura de caja activa. Por favor, realiza la apertura.',
        'warning'
      );
    }

    const dateEndCert: string = String(this.companyData?.cert_not_after || null);
    if (dateEndCert) {
      const dias = diasRestantes(dateEndCert);
      this.certDaysLeft = dias;
      if (dias <= 30 && dias > 0) {
        this.agregarAviso(
          'Firma',
          `La firma vencera en ${dias} día(s).`,
          'warning'
        );
      } else if (dias <= 0) {
        this.agregarAviso(
          'Firma',
          'La firma ha expirado',
          'error'
        );
      }
    } else {
      this.certDaysLeft = null;
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
    const aviso: Aviso = {
      id: `aviso_${this.avisoCounter++}`,
      titulo,
      mensaje,
      tipo,
      fecha: new Date()
    };
    this.avisos.push(aviso);
  }

  // Método para eliminar un aviso
  eliminarAviso(id: string): void {
    this.avisos = this.avisos.filter(aviso => aviso.id !== id);
  }

  // Método para limpiar todos los avisos
  limpiarAvisos(): void {
    this.avisos = [];
  }

  get cajaAbierta(): boolean {
    return this.idApertura != null;
  }

  get ticketPromedio(): number {
    if (!this.totalOrdersToday) {
      return 0;
    }
    return this.total_sales_today / this.totalOrdersToday;
  }

  get firmaLabel(): string {
    if (this.companyData?.firma) {
      return 'Sin firma';
    }
    if (this.certDaysLeft === null) {
      return 'Sin certificado';
    }
    if (this.certDaysLeft <= 0) {
      return 'Vencida';
    }
    if (this.certDaysLeft <= 30) {
      return `Vence en ${this.certDaysLeft} dias`;
    }
    return 'Al dia';
  }

  get firmaClasses(): string {
    if (this.companyData?.firma || this.certDaysLeft === null || this.certDaysLeft <= 0) {
      return 'bg-red-100 text-red-700';
    }
    if (this.certDaysLeft <= 30) {
      return 'bg-amber-100 text-amber-700';
    }
    return 'bg-emerald-100 text-emerald-700';
  }

  getProductShare(count: number): number {
    const maxCount = Math.max(...this.topProducts.map((item: any) => Number(item.count) || 0), 0);
    if (!maxCount) {
      return 0;
    }
    return ((Number(count) || 0) / maxCount) * 100;
  }
}
