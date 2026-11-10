import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { DashboardShortcut } from '../../dashboard.models';

/** Mismas features y permisos que exigen las rutas destino en `dashboard-routing.module.ts`. */
const SERVICE_SHORTCUTS: DashboardShortcut[] = [
  {
    label: 'Tomar pedido',
    detail: 'Abrir el POS de salón',
    route: '/dashboard/pos',
    features: ['restaurant', 'orders', 'pos'],
    permission: 'restaurant.orders.create'
  },
  {
    label: 'Mesas',
    detail: 'Mapa del salón y mesas ocupadas',
    route: '/dashboard/tables',
    features: ['tables'],
    permission: 'restaurant.orders.read'
  },
  {
    label: 'Órdenes',
    detail: 'Seguimiento de pedidos del día',
    route: '/dashboard/orders',
    features: ['orders'],
    permission: 'restaurant.orders.read'
  }
];

/**
 * Mesero: accesos rápidos sin métricas. El rol no tiene `reports.view`, por
 * lo que el backend rechazaría `get_dashboard_metrics`.
 */
@Component({
  selector: 'app-service-panel',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <section aria-labelledby="service-title">
      <h2 id="service-title" class="mb-3 text-[15px] font-semibold text-foreground">Tu turno en el salón</h2>
      <div *ngIf="shortcuts.length; else noShortcuts" class="grid gap-3 sm:grid-cols-3">
        <a *ngFor="let shortcut of shortcuts; let first = first" [routerLink]="shortcut.route"
          class="rounded-xl border px-5 py-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          [ngClass]="first ? 'border-primary bg-primary text-primary-foreground hover:opacity-90' : 'border-border bg-card text-foreground hover:bg-muted'">
          <p class="text-base font-semibold">{{ shortcut.label }}</p>
          <p class="mt-0.5 text-[13px]" [ngClass]="first ? 'opacity-85' : 'text-muted-foreground'">{{ shortcut.detail }}</p>
        </a>
      </div>
      <ng-template #noShortcuts>
        <p class="text-[13px] text-muted-foreground">No tienes módulos de salón habilitados en este negocio.</p>
      </ng-template>
    </section>
  `
})
export class ServicePanelComponent {
  readonly shortcuts: DashboardShortcut[];

  constructor(capabilities: CompanyCapabilitiesService) {
    this.shortcuts = SERVICE_SHORTCUTS.filter((shortcut) =>
      shortcut.features.every((feature) => capabilities.isEnabled(feature))
      && capabilities.hasPermission(shortcut.permission)
    );
  }
}
