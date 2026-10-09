import { FormBuilder } from '@angular/forms';
import { convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { InventoryComponent } from './inventory.component';

describe('Inventory stock view', () => {
  let component: InventoryComponent;
  const products: any[] = [
    { name: 'A', nombre: 'Arroz', maneja_stock: 1, stock_actual: 50, stock_minimo: 5 },
    { name: 'B', nombre: 'Azúcar', maneja_stock: 1, stock_actual: 3, stock_minimo: 5 },
    { name: 'C', nombre: 'Café', maneja_stock: 1, stock_actual: 0, stock_minimo: 2 }
  ];

  function build(isLiteMode = true) {
    const capabilities = { isLiteMode, isEnabled: () => true, hasPermission: () => true, isWarehouseMode: false, activeWarehouses: [], warehouses: [] };
    const route = { queryParamMap: of(convertToParamMap({ tab: 'history' })) };
    const destroyRef = { onDestroy: () => () => undefined };
    component = new InventoryComponent({} as any, {} as any, new FormBuilder(), {} as any, {} as any, {} as any,
      capabilities as any, route as any, {} as any, destroyRef as any);
    component.initMovementForm();
    component.inventoryProducts = products;
    component.productOptions = products;
    component.setStockFilter('all');
  }

  it('opens the tab requested in the URL', () => {
    build();
    expect(component.activeTab).toBe('history');
  });

  it('uses the same rule for the summary cards and the filtered list', () => {
    build();
    expect(component.stockFilterCount('available')).toBe(1);
    expect(component.stockFilterCount('low')).toBe(1);
    expect(component.stockFilterCount('out')).toBe(1);
    component.setStockFilter('low');
    expect(component.visibleProducts.map((item: any) => item.name)).toEqual(['B']);
    component.setStockFilter('low');
    expect(component.stockFilter).toBe('all');
  });

  it('previews the resulting stock for each kind of movement', () => {
    build();
    component.movementItems.at(0).patchValue({ product: 'A', quantity: 10 });
    component.selectMovementType('Entrada');
    expect(component.movementPreview(0)).toEqual({ current: 50, result: 60, unit: jasmine.any(String) as any });
    component.selectMovementType('Salida');
    expect(component.movementPreview(0)?.result).toBe(40);
    component.selectMovementType('Ajuste');
    component.movementItems.at(0).patchValue({ target_stock: 12 });
    expect(component.movementPreview(0)?.result).toBe(12);
  });

  it('warns when an outgoing movement exceeds the current stock', () => {
    build();
    component.movementItems.at(0).patchValue({ product: 'B', quantity: 10 });
    component.selectMovementType('Salida');
    expect(component.movementPreview(0)?.result).toBe(-7);
  });
});
