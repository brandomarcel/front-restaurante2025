import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';

interface ReportCard {
  title: string;
  description: string;
  badge: string;
  route: string;
  accent: string;
  featureKey?: 'cash_register';
}

@Component({
  selector: 'app-reports-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './reports-home.component.html'
})
export class ReportsHomeComponent {
  readonly reports: ReportCard[] = [
    {
      title: 'Órdenes',
      description: 'Ventas por orden, tipo de consumo, factura, SRI y forma de pago.',
      badge: 'Operación',
      route: '/report/orders',
      accent: 'from-indigo-500 to-violet-500'
    },
    {
      title: 'Productos más vendidos',
      description: 'Ranking de productos con cantidad vendida, órdenes, IVA, total y última venta.',
      badge: 'Productos',
      route: '/report/productos-mas-vendidos',
      accent: 'from-emerald-500 to-teal-500'
    },
    {
      title: 'Comprobantes electrónicos',
      description: 'Facturas y notas de crédito con estado, SRI, clave de acceso y consumo de plan.',
      badge: 'SRI',
      route: '/report/comprobantes-electronicos',
      accent: 'from-amber-500 to-orange-500'
    },
    {
      title: 'Ventas por forma de pago',
      description: 'Totales cobrados por método interno, código SRI, facturas y fechas.',
      badge: 'Pagos',
      route: '/report/ventas-forma-pago',
      accent: 'from-sky-500 to-blue-500'
    },
    {
      title: 'Cierres de caja',
      description: 'Reporte histórico de aperturas, cierres y movimientos de caja.',
      badge: 'Caja',
      route: '/report/report-cierre-caja',
      accent: 'from-slate-500 to-slate-700',
      featureKey: 'cash_register'
    }
  ];

  constructor(private capabilities: CompanyCapabilitiesService) {}

  get visibleReports(): ReportCard[] {
    const allowed = this.reports.filter((report) => !report.featureKey || this.capabilities.isEnabled(report.featureKey));
    if (this.capabilities.features.restaurant === true) {
      return allowed.filter((report) => report.route === '/report/orders' || report.route === '/report/ventas-forma-pago');
    }
    return allowed;
  }

  trackByReport = (_: number, report: ReportCard) => report.route;
}
