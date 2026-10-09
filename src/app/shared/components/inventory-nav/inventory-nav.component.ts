import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';

export type InventorySection = 'stock' | 'history' | 'lookup' | 'transfer' | 'warehouses';

interface InventoryNavItem {
  id: InventorySection;
  label: string;
  route: string;
  queryParams?: Record<string, string>;
}

/**
 * Navegación común del módulo de inventario. Une en un solo lugar las
 * pantallas que antes estaban repartidas entre Inventario y Configuración, y
 * muestra cada sección solo si aplica al negocio y a los permisos del usuario.
 */
@Component({
  selector: 'app-inventory-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav aria-label="Secciones de inventario" class="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 shadow-sm">
      <a *ngFor="let item of items" [routerLink]="item.route" [queryParams]="item.queryParams || null"
        [attr.aria-current]="item.id === active ? 'page' : null"
        class="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition"
        [ngClass]="item.id === active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'">
        {{ item.label }}
      </a>
      <span *ngIf="warehouseMode !== null" class="ml-auto hidden shrink-0 items-center gap-1 self-center pr-2 text-[11px] text-muted-foreground sm:flex">
        Modo: <b class="text-foreground">{{ warehouseMode ? 'Por bodega' : 'Simple' }}</b>
      </span>
    </nav>
  `
})
export class InventoryNavComponent {
  @Input() active: InventorySection = 'stock';

  constructor(private capabilities: CompanyCapabilitiesService) {}

  get warehouseMode(): boolean | null {
    return this.capabilities.isEnabled('inventory') ? this.capabilities.isWarehouseMode : null;
  }

  private has(permission: string): boolean {
    return this.capabilities.hasPermission('*') || this.capabilities.hasPermission(permission);
  }

  get items(): InventoryNavItem[] {
    const canRead = this.has('inventory.read') || this.has('inventory.manage');
    const canSettings = this.has('business.settings.manage');
    const canTransfer = this.has('inventory.manage') || canSettings;
    const warehouseMode = !!this.warehouseMode;
    const enoughWarehouses = this.capabilities.activeWarehouses.length >= 2;
    const items: InventoryNavItem[] = [];
    if (canRead) {
      items.push({ id: 'stock', label: 'Stock', route: '/dashboard/inventory' });
      items.push({ id: 'history', label: 'Movimientos', route: '/dashboard/inventory', queryParams: { tab: 'history' } });
    }
    if (canRead && warehouseMode && enoughWarehouses) {
      items.push({ id: 'lookup', label: 'Stock por bodega', route: '/dashboard/inventory/stock-lookup' });
    }
    if (canTransfer && warehouseMode && enoughWarehouses) {
      items.push({ id: 'transfer', label: 'Traslados', route: '/settings/lite/warehouses/transfer' });
    }
    if (canSettings) {
      items.push({ id: 'warehouses', label: 'Bodegas y modo', route: '/settings/lite/warehouses' });
    }
    return items;
  }
}
