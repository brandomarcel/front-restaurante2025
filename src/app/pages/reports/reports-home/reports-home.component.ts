import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';

import { reportDefinitions } from '../frappe-reports/frappe-report-definitions';

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
    ...reportDefinitions(true).map(report => ({
      title: report.title, description: report.description, badge: report.badge,
      route: report.route, accent: report.accent, category: report.category
    })),
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
    if (!this.allowedByReportScope(report)) return false;

    switch (report.category) {
      case 'billing':
        return features.billing === true && this.hasAnyPermission('billing.read', 'billing.manage');
      case 'restaurant':
        return features.restaurant === true && this.hasAnyPermission('restaurant.orders.read', 'restaurant.manage');
      case 'cash':
        return features.cash_register === true
          && (this.capabilities.hasPermission('*')
            || this.capabilities.hasPermission('restaurant.manage')
            || this.capabilities.hasPermission('billing.manage'));
      case 'products':
        return features.billing === true && features.products === true && this.hasAnyPermission('products.read', 'products.manage');
      case 'customers':
        return features.customers === true && this.hasAnyPermission('customers.read', 'customers.manage');
      case 'billing_or_restaurant':
        return (features.billing === true && this.hasAnyPermission('billing.read', 'billing.manage'))
          || (features.restaurant === true && this.hasAnyPermission('restaurant.orders.read', 'restaurant.manage'));
      default:
        return false;
    }
  }

  /**
   * `ui_capabilities.report_scope` (get_user_context): global ve todo,
   * billing solo comprobantes/pagos, operational solo lo del día a día
   * (órdenes, caja, productos), none oculta todos. `null` (backend no manda
   * el dato todavía) no restringe nada más allá de lo que ya filtraban
   * `features`/`permissions`.
   */
  private allowedByReportScope(report: ReportCard): boolean {
    const scope = this.capabilities.reportScope;
    if (!scope || scope === 'global') return true;
    if (scope === 'none') return false;
    if (scope === 'billing') return report.category === 'billing' || report.category === 'billing_or_restaurant';
    // operational
    return report.category !== 'billing';
  }

  trackByReport = (_: number, report: ReportCard) => report.route;
}
