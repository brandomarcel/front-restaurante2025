import { InventoryNavComponent } from './inventory-nav.component';

describe('Inventory navigation', () => {
  function build(options: { permissions: string[]; warehouseMode: boolean; warehouses: number }) {
    const capabilities = {
      isEnabled: () => true,
      isWarehouseMode: options.warehouseMode,
      activeWarehouses: Array.from({ length: options.warehouses }, (_, index) => ({ name: `W${index}` })),
      hasPermission: (permission: string) => options.permissions.includes(permission)
    };
    return new InventoryNavComponent(capabilities as any).items.map(item => item.id);
  }

  it('shows only stock and movements in simple mode for a reader', () => {
    expect(build({ permissions: ['inventory.read'], warehouseMode: false, warehouses: 3 })).toEqual(['stock', 'history']);
  });

  it('adds lookup and transfers only with two or more warehouses in warehouse mode', () => {
    expect(build({ permissions: ['inventory.read', 'inventory.manage'], warehouseMode: true, warehouses: 1 })).toEqual(['stock', 'history']);
    expect(build({ permissions: ['inventory.read', 'inventory.manage'], warehouseMode: true, warehouses: 2 }))
      .toEqual(['stock', 'history', 'lookup', 'transfer']);
  });

  it('shows warehouse settings only to business administrators', () => {
    expect(build({ permissions: ['business.settings.manage'], warehouseMode: false, warehouses: 0 })).toEqual(['warehouses']);
  });
});
