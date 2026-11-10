import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LiteDashboard } from 'src/app/services/facturada-lite-dashboard.service';
import { RecentInvoicesComponent } from '../recent-invoices/recent-invoices.component';

/**
 * Negocio de solo facturación: debajo de los comprobantes del mes, las últimas
 * facturas. El plan y el inventario se avisan en «Necesita tu atención».
 */
@Component({
  selector: 'app-billing-panel',
  standalone: true,
  imports: [CommonModule, RecentInvoicesComponent],
  template: `<app-recent-invoices [invoices]="dashboard.recent_invoices" [canOpen]="canOpenInvoices"></app-recent-invoices>`
})
export class BillingPanelComponent {
  @Input({ required: true }) dashboard!: LiteDashboard;
  @Input() canOpenInvoices = false;
}
