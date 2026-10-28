import { TestBed } from '@angular/core/testing';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { KitchenSuppliesService } from 'src/app/services/kitchen-supplies.service';
import { KitchenWarehousePickerComponent } from './kitchen-warehouse-picker.component';

describe('Selector de bodega de Insumos y Recetas', () => {
  let caps: any;
  let supplies: any;

  function build(): KitchenWarehousePickerComponent {
    TestBed.configureTestingModule({
      providers: [
        { provide: CompanyCapabilitiesService, useValue: caps },
        { provide: KitchenSuppliesService, useValue: supplies },
      ],
    });
    return TestBed.runInInjectionContext(() => new KitchenWarehousePickerComponent());
  }

  beforeEach(() => {
    caps = { isWarehouseMode: true, activeWarehouses: [{ name: 'W1', warehouse_name: 'Cocina' }, { name: 'W2' }] };
    supplies = { warehouse: 'W1', selectWarehouse: jasmine.createSpy('select') };
  });

  it('en modo Simple no se muestra', () => {
    caps.isWarehouseMode = false;
    expect(build().visible).toBeFalse();
  });

  it('en multi-bodega muestra las bodegas activas y la elegida', () => {
    const picker = build();
    expect(picker.visible).toBeTrue();
    expect(picker.options.length).toBe(2);
    expect(picker.selected).toBe('W1');
  });

  it('elegir una bodega la recuerda y avisa a la pantalla para recargar', () => {
    const picker = build();
    const emitted: string[] = [];
    picker.changed.subscribe((value) => emitted.push(value));
    picker.choose('W2');
    expect(supplies.selectWarehouse).toHaveBeenCalledWith('W2');
    expect(emitted).toEqual(['W2']);
  });
});
