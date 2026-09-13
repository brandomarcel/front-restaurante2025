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
  category: 'billing' | 'restaurant' | 'cash' | 'products' | 'customers' | 'billing_or_restaurant';
  restaurantOnly?: boolean;
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
      accent: 'from-indigo-500 to-violet-500',
      category: 'restaurant',
      restaurantOnly: true
    },
    {
      title: 'Productos más vendidos',
      description: 'Ranking de productos con cantidad vendida, órdenes, IVA, total y última venta.',
      badge: 'Productos',
      route: '/report/productos-mas-vendidos',
      accent: 'from-emerald-500 to-teal-500',
      category: 'products'
    },
    {
      title: 'Comprobantes electrónicos',
      description: 'Facturas y notas de crédito con estado, SRI, clave de acceso y consumo de plan.',
      badge: 'SRI',
      route: '/report/comprobantes-electronicos',
      accent: 'from-amber-500 to-orange-500',
      category: 'billing'
    },
    {
      title: 'Ventas por forma de pago',
      description: 'Totales cobrados por método interno, código SRI, facturas y fechas.',
      badge: 'Pagos',
      route: '/report/ventas-forma-pago',
      accent: 'from-sky-500 to-blue-500',
      category: 'billing_or_restaurant'
    },
    {
      title: 'Cierres de caja',
      description: 'Reporte histórico de aperturas, cierres y movimientos de caja.',
      badge: 'Caja',
      route: '/report/report-cierre-caja',
      accent: 'from-slate-500 to-slate-700',
      category: 'cash'
    }
  ];

  constructor(private capabilities: CompanyCapabilitiesService) {}

  get visibleReports(): ReportCard[] {
    return this.reports.filter((report) => this.canViewReport(report));
  }

  private canViewReports(): boolean {
    return this.capabilities.hasPermission('*') || this.capabilities.hasPermission('reports.view');
  }

  private hasAnyPermission(...permissions: string[]): boolean {
    return permissions.some((permission) => this.capabilities.hasPermission(permission));
  }

  private canViewReport(report: ReportCard): boolean {
    const features = this.capabilities.features;
    if (!this.canViewReports()) return false;

    switch (report.category) {
      case 'billing':
        return features.billing === true && this.hasAnyPermission('billing.read', 'billing.manage');
      case 'restaurant':
        return features.restaurant === true && this.hasAnyPermission('restaurant.orders.read', 'restaurant.manage');
      case 'cash':
        return features.restaurant_pos === true && features.cash_register === true
          && this.capabilities.hasPermission('restaurant.cash.manage');
      case 'products':
        return features.products === true && this.hasAnyPermission('products.read', 'products.manage');
      case 'customers':
        return features.customers === true && this.hasAnyPermission('customers.read', 'customers.manage');
      case 'billing_or_restaurant':
        return (features.billing === true && this.hasAnyPermission('billing.read', 'billing.manage'))
          || (features.restaurant === true && this.hasAnyPermission('restaurant.orders.read', 'restaurant.manage'));
      default:
        return false;
    }
  }

  trackByReport = (_: number, report: ReportCard) => report.route;
}
