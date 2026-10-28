import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { KitchenSuppliesService } from 'src/app/services/kitchen-supplies.service';

/**
 * Selector de bodega para Insumos y Recetas. Solo se muestra si el negocio activó el manejo por
 * bodegas: en modo Simple no existe y el restaurante no ve nada de esto.
 */
@Component({
  selector: 'app-kitchen-warehouse-picker',
  standalone: true,
  imports: [CommonModule],
  template: `
    <label *ngIf="visible" class="flex items-center gap-2 rounded-lg border border-border bg-muted/40 py-1 pl-3 pr-1 text-xs">
      <span class="font-semibold text-muted-foreground">Bodega</span>
      <select class="select !h-8 !w-44 !border-0 !bg-transparent !text-xs !font-bold" [value]="selected" (change)="choose($any($event.target).value)" aria-label="Bodega">
        <option value="">Elige una bodega</option>
        <option *ngFor="let warehouse of options" [value]="warehouse.name">{{ warehouse.warehouse_name || warehouse.name }}</option>
      </select>
    </label>
  `,
})
export class KitchenWarehousePickerComponent {
  private readonly capabilities = inject(CompanyCapabilitiesService);
  private readonly supplies = inject(KitchenSuppliesService);

  @Output() changed = new EventEmitter<string>();

  get visible(): boolean {
    return this.capabilities.isWarehouseMode;
  }

  get options(): any[] {
    return this.capabilities.activeWarehouses;
  }

  get selected(): string {
    return this.supplies.warehouse;
  }

  choose(warehouseId: string): void {
    this.supplies.selectWarehouse(warehouseId);
    this.changed.emit(warehouseId);
  }
}
