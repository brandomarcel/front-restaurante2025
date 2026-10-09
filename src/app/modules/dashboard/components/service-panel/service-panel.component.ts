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
    classes: 'border-primary/20 bg-primary/5 text-primary hover:bg-primary/10',
    features: ['restaurant', 'orders', 'pos'],
    permission: 'restaurant.orders.create'
  },
  {
    label: 'Mesas',
    detail: 'Mapa del salón y mesas ocupadas',
    route: '/dashboard/tables',
    classes: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
    features: ['tables'],
    permission: 'restaurant.orders.read'
  },
  {
    label: 'Órdenes',
    detail: 'Seguimiento de pedidos del día',
    route: '/dashboard/orders',
    classes: 'border-border bg-muted/40 text-foreground/80 hover:bg-muted',
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
    <section class="rounded-xl border border-border bg-card p-3 shadow-sm">
      <h2 class="text-sm font-bold text-foreground">Atención en salón</h2>
      <p class="mb-3 text-[10px] text-muted-foreground">Accesos rápidos para tu turno.</p>
      <div *ngIf="shortcuts.length; else noShortcuts" class="grid gap-2 sm:grid-cols-3">
        <a *ngFor="let shortcut of shortcuts" [routerLink]="shortcut.route"
          class="rounded-lg border p-3 transition" [ngClass]="shortcut.classes">
          <p class="text-sm font-black">{{ shortcut.label }}</p>
          <p class="text-[11px]">{{ shortcut.detail }}</p>
        </a>
      </div>
      <ng-template #noShortcuts>
        <p class="text-xs text-muted-foreground">No tienes módulos de salón habilitados en este negocio.</p>
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
