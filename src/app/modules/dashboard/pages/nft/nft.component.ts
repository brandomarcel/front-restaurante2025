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
import { NgApexchartsModule } from 'ng-apexcharts';

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
  imports: [CommonModule, RouterModule, AvisosComponent, NgApexchartsModule]
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
  topProductsBarOptions: any = null;
  cashFlowDonutOptions: any = null;
  moneyBarsOptions: any = null;

  private destroy$ = new Subject<void>();
  private avisoCounter = 0;

  constructor(
    private ordersService: OrdersService,
    private cajasService: CajasService,
    private companyService: CompanyService
  ) { }

  ngOnInit(): void {
    this.actualizarVisualizaciones();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadData() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    this.userData = user;
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
      this.actualizarVisualizaciones();
 
  }

  private procesarDashboard(response: any): void {
    try {
      const data = response?.message;
      if (data) {
        this.totalOrdersToday = data.total_orders_today || 0;
        this.total_sales_today = data.total_sales_today || 0;
        this.topProducts = data.top_products || [];
        this.actualizarVisualizaciones();
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
    return !!this.idApertura;
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

  get topProductName(): string {
    if (!this.topProducts.length) {
      return 'Sin datos';
    }
    return String(this.topProducts[0]?.name || 'Sin nombre');
  }

  get topProductCount(): number {
    if (!this.topProducts.length) {
      return 0;
    }
    return Number(this.topProducts[0]?.count) || 0;
  }

  get totalTopProductsUnits(): number {
    return this.topProducts.reduce((acc: number, item: any) => acc + (Number(item?.count) || 0), 0);
  }

  get topProductShareInTop(): number {
    if (!this.totalTopProductsUnits) {
      return 0;
    }
    return (this.topProductCount / this.totalTopProductsUnits) * 100;
  }

  get top3ShareInTop(): number {
    if (!this.totalTopProductsUnits) {
      return 0;
    }
    const top3Units = this.topProducts
      .slice(0, 3)
      .reduce((acc: number, item: any) => acc + (Number(item?.count) || 0), 0);
    return (top3Units / this.totalTopProductsUnits) * 100;
  }

  get retirosVsVentasPercent(): number {
    if (!this.total_sales_today) {
      return 0;
    }
    return (this.totalRetiros / this.total_sales_today) * 100;
  }

  get efectivoEsperado(): number {
    return this.montoApertura + this.total_sales_today - this.totalRetiros;
  }

  get diferenciaCaja(): number {
    return this.efectivoSistema - this.efectivoEsperado;
  }

  get diferenciaCajaLabel(): string {
    if (Math.abs(this.diferenciaCaja) < 0.01) {
      return 'Sin diferencia';
    }
    if (this.diferenciaCaja > 0) {
      return 'Sobrante';
    }
    return 'Faltante';
  }

  get diferenciaCajaClasses(): string {
    if (Math.abs(this.diferenciaCaja) < 0.01) {
      return 'bg-slate-100 text-slate-700';
    }
    if (this.diferenciaCaja > 0) {
      return 'bg-emerald-100 text-emerald-700';
    }
    return 'bg-red-100 text-red-700';
  }

  get ordersPerHour(): number {
    const currentHour = new Date().getHours();
    const elapsedHours = Math.max(currentHour + 1, 1);
    return this.totalOrdersToday / elapsedHours;
  }

  get ticketPromedioLabel(): string {
    if (!this.totalOrdersToday) {
      return 'Sin pedidos';
    }
    if (this.ticketPromedio >= 15) {
      return 'Ticket fuerte';
    }
    if (this.ticketPromedio >= 8) {
      return 'Ticket estable';
    }
    return 'Ticket bajo';
  }

  get ticketPromedioClasses(): string {
    if (!this.totalOrdersToday) {
      return 'bg-slate-100 text-slate-700';
    }
    if (this.ticketPromedio >= 15) {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (this.ticketPromedio >= 8) {
      return 'bg-sky-100 text-sky-700';
    }
    return 'bg-amber-100 text-amber-700';
  }

  get ritmoTurnoLabel(): string {
    if (!this.totalOrdersToday) {
      return 'Sin movimiento';
    }
    if (this.ordersPerHour >= 4) {
      return 'Ritmo alto';
    }
    if (this.ordersPerHour >= 2) {
      return 'Ritmo estable';
    }
    return 'Ritmo bajo';
  }

  get ritmoTurnoClasses(): string {
    if (!this.totalOrdersToday) {
      return 'bg-slate-100 text-slate-700';
    }
    if (this.ordersPerHour >= 4) {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (this.ordersPerHour >= 2) {
      return 'bg-sky-100 text-sky-700';
    }
    return 'bg-amber-100 text-amber-700';
  }

  get diferenciaCajaAbs(): number {
    return Math.abs(this.diferenciaCaja);
  }

  get estadoTurnoLabel(): string {
    if (!this.cajaAbierta) {
      return 'Atencion requerida';
    }
    if (this.diferenciaCajaAbs > 20) {
      return 'Revisar caja';
    }
    if (!this.totalOrdersToday) {
      return 'Sin movimiento';
    }
    return 'Operacion estable';
  }

  get estadoTurnoClasses(): string {
    if (!this.cajaAbierta || this.diferenciaCajaAbs > 20) {
      return 'bg-red-100 text-red-700';
    }
    if (!this.totalOrdersToday) {
      return 'bg-amber-100 text-amber-700';
    }
    return 'bg-emerald-100 text-emerald-700';
  }

  get resumenVentasClaro(): string {
    if (!this.totalOrdersToday) {
      return 'Aun no hay pedidos registrados hoy.';
    }
    return `Llevas ${this.totalOrdersToday} pedidos por ${this.total_sales_today.toFixed(2)} USD.`;
  }

  get resumenCajaClaro(): string {
    if (!this.cajaAbierta) {
      return 'No hay apertura de caja activa en este turno.';
    }
    if (this.diferenciaCajaAbs < 0.01) {
      return 'La caja esta cuadrada con el valor esperado.';
    }
    if (this.diferenciaCaja > 0) {
      return `Hay un sobrante de ${this.diferenciaCajaAbs.toFixed(2)} USD frente a lo esperado.`;
    }
    return `Hay un faltante de ${this.diferenciaCajaAbs.toFixed(2)} USD frente a lo esperado.`;
  }

  get resumenProductosClaro(): string {
    if (!this.topProducts.length) {
      return 'Sin ventas de productos para mostrar ranking.';
    }
    return `${this.topProductName} lidera las ventas con ${this.topProductCount} unidades.`;
  }

  get accionesSugeridas(): string[] {
    const acciones: string[] = [];

    if (!this.cajaAbierta) {
      acciones.push('Realizar apertura de caja para iniciar el turno.');
    }
    if (this.companyData?.firma) {
      acciones.push('Registrar firma electronica para habilitar facturacion.');
    }
    if (this.certDaysLeft !== null && this.certDaysLeft <= 30) {
      acciones.push(`Renovar certificado de firma (${this.certDaysLeft} dia(s) restantes).`);
    }
    if (this.diferenciaCajaAbs > 20) {
      acciones.push('Verificar retiros y movimientos de caja por diferencia alta.');
    }
    if (this.totalOrdersToday === 0) {
      acciones.push('Confirmar que POS y toma de pedidos esten operativos.');
    }

    if (!acciones.length) {
      acciones.push('Mantener operacion actual y monitorear cierres de pedidos.');
    }

    return acciones;
  }

  get mixVentasLabel(): string {
    if (!this.topProducts.length) {
      return 'Sin datos';
    }
    if (this.topProductShareInTop >= 45) {
      return 'Alta dependencia';
    }
    if (this.top3ShareInTop >= 75) {
      return 'Mix concentrado';
    }
    return 'Mix balanceado';
  }

  get mixVentasClasses(): string {
    if (!this.topProducts.length) {
      return 'bg-slate-100 text-slate-700';
    }
    if (this.topProductShareInTop >= 45) {
      return 'bg-rose-100 text-rose-700';
    }
    if (this.top3ShareInTop >= 75) {
      return 'bg-amber-100 text-amber-700';
    }
    return 'bg-emerald-100 text-emerald-700';
  }

  get mixVentasDetalle(): string {
    if (!this.topProducts.length) {
      return 'Todavia no hay suficientes ventas para evaluar el mix de productos.';
    }
    if (this.topProductShareInTop >= 45) {
      return `${this.topProductName} concentra ${this.topProductShareInTop.toFixed(1)}% del top vendido.`;
    }
    if (this.top3ShareInTop >= 75) {
      return `Los 3 productos lideres concentran ${this.top3ShareInTop.toFixed(1)}% de las unidades vendidas.`;
    }
    return 'Las ventas se reparten bien entre varios productos del ranking.';
  }

  get resumenComercialClaro(): string {
    if (!this.totalOrdersToday) {
      return 'Aun no hay pedidos suficientes para leer el rendimiento comercial del turno.';
    }
    return `Promedio de ${this.ordersPerHour.toFixed(1)} pedidos por hora con un ticket medio de ${this.ticketPromedio.toFixed(2)} USD.`;
  }

  get saludCajaPercent(): number {
    const base = Math.max(Math.abs(this.efectivoEsperado), 1);
    const desvio = (Math.abs(this.diferenciaCaja) / base) * 100;
    return Math.max(0, Math.min(100, 100 - desvio));
  }

  get retirosSobreVentasPercentSafe(): number {
    return Math.max(0, Math.min(this.retirosVsVentasPercent, 100));
  }

  private actualizarVisualizaciones(): void {
    this.construirChartTopProductos();
    this.construirChartFlujoCaja();
    this.construirChartResumenMonetario();
  }

  private formatChartDecimal(value: number): string {
    return (Number(value) || 0).toFixed(2);
  }

  private formatChartCurrency(value: number): string {
    return `$${this.formatChartDecimal(value)}`;
  }

  private construirChartTopProductos(): void {
    const top = this.topProducts.slice(0, 8);
    const categorias = top.length ? top.map((item: any) => String(item?.name || 'Sin nombre')) : ['Sin ventas'];
    const values = top.length ? top.map((item: any) => Number(item?.count) || 0) : [0];

    this.topProductsBarOptions = {
      series: [
        {
          name: 'Unidades',
          data: values
        }
      ],
      chart: {
        type: 'bar',
        height: 360,
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 550 }
      },
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '58%',
          borderRadius: 6,
          distributed: true
        }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: categorias,
        labels: {
          style: { colors: '#64748b' }
        }
      },
      yaxis: {
        labels: {
          style: { colors: '#334155', fontWeight: 600 }
        }
      },
      colors: ['#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444'],
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 4
      },
      tooltip: {
        y: {
          formatter: (value: number) => `${this.formatChartDecimal(value)} vendidos`
        }
      }
    };
  }

  private construirChartFlujoCaja(): void {
    const series = [
      Number(this.montoApertura) || 0,
      Number(this.total_sales_today) || 0,
      Number(this.totalRetiros) || 0
    ];

    this.cashFlowDonutOptions = {
      series,
      chart: {
        type: 'donut',
        height: 330,
        toolbar: { show: false }
      },
      labels: ['Apertura', 'Ventas', 'Retiros'],
      colors: ['#f59e0b', '#10b981', '#f43f5e'],
      legend: {
        show: false
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${this.formatChartDecimal(val)}%`
      },
      stroke: { width: 0 },
      plotOptions: {
        pie: {
          donut: {
            size: '66%',
            labels: {
              show: true,
              name: {
                show: true
              },
              value: {
                show: true,
                formatter: (value: string) => this.formatChartCurrency(Number(value))
              },
              total: {
                show: true,
                label: 'Movimiento',
                formatter: () => this.formatChartCurrency(series.reduce((acc: number, current: number) => acc + current, 0))
              }
            }
          }
        }
      },
      tooltip: {
        y: {
          formatter: (value: number) => this.formatChartCurrency(value)
        }
      },
      responsive: [
        {
          breakpoint: 1280,
          options: {
            chart: { height: 300 }
          }
        }
      ]
    };
  }

  private construirChartResumenMonetario(): void {
    const diferenciaColor = this.diferenciaCaja >= 0 ? '#16a34a' : '#dc2626';
    const values = [
      Number(this.total_sales_today) || 0,
      Number(this.totalRetiros) || 0,
      Number(this.efectivoSistema) || 0,
      Number(this.efectivoEsperado) || 0,
      Number(this.diferenciaCaja) || 0
    ];

    this.moneyBarsOptions = {
      series: [
        {
          name: 'USD',
          data: values
        }
      ],
      chart: {
        type: 'bar',
        height: 340,
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 550 }
      },
      plotOptions: {
        bar: {
          horizontal: false,
          borderRadius: 6,
          columnWidth: '48%',
          distributed: true
        }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: ['Ventas', 'Retiros', 'Efectivo', 'Esperado', 'Diferencia'],
        labels: {
          style: { colors: '#64748b' }
        }
      },
      yaxis: {
        labels: {
          formatter: (val: number) => this.formatChartDecimal(val),
          style: { colors: '#64748b' }
        }
      },
      colors: ['#10b981', '#f43f5e', '#2563eb', '#0ea5e9', diferenciaColor],
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 4
      },
      tooltip: {
        y: {
          formatter: (value: number) => this.formatChartCurrency(value)
        }
      }
    };
  }
}
