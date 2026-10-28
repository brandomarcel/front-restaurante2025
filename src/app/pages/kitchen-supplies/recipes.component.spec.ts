import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { toast } from 'ngx-sonner';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { Dish, KitchenSuppliesService } from 'src/app/services/kitchen-supplies.service';
import { RecipesComponent } from './recipes.component';

describe('Recetas: editor separado del catálogo', () => {
  let component: RecipesComponent;
  let supplies: any;
  const dish: Dish = { name: 'PLATO', item_code: 'P', item_name: 'Plato', standard_rate: 5,
    track_stock: 0, has_recipe: true, lines: [{ ingredient: 'I1', quantity: .25, waste_pct: 10, removable: true }] };

  beforeEach(() => {
    supplies = { warehouse: '', getDishes: jasmine.createSpy('dishes').and.returnValue(of({ data: [], counts: {}, total: 0 })),
      getIngredients: jasmine.createSpy('ingredients').and.returnValue(of({ data: [
        { name: 'I1', item_name: 'Harina', unit: 'kg', current_stock: 5 },
        { name: 'I2', item_name: 'Agua', unit: 'l', current_stock: 2 }
      ] })), saveRecipe: jasmine.createSpy('save').and.returnValue(of({})) };
    TestBed.configureTestingModule({ providers: [
      { provide: KitchenSuppliesService, useValue: supplies },
      { provide: CompanyCapabilitiesService, useValue: { isEnabled: () => true, hasPermission: () => true, isWarehouseMode: false } },
      { provide: AlertService, useValue: { error: jasmine.createSpy('error'), confirm: () => Promise.resolve({ isConfirmed: true }) } },
      { provide: FrappeErrorService, useValue: { handle: () => 'Error' } }
    ] });
    component = TestBed.runInInjectionContext(() => new RecipesComponent());
    spyOn(toast, 'success');
  });

  it('copia las líneas para editar sin mutar el plato y conserva merma y modificadores al guardar', () => {
    component.open(dish);
    component.lines[0].quantity = .5;
    expect(dish.lines[0].quantity).toBe(.25);
    component.save();
    expect(supplies.saveRecipe).toHaveBeenCalledWith(dish,
      [{ ingredient: 'I1', quantity: .5, waste_pct: 10, removable: true }]);
  });

  it('quitar la receta requiere confirmación y envía una lista vacía', async () => {
    component.open(dish);
    await component.removeRecipe();
    expect(supplies.saveRecipe).toHaveBeenCalledWith(dish, []);
  });

  it('el selector excluye insumos repetidos y conserva la unidad del insumo', () => {
    component.open(dish);
    component.addLine();
    expect(component.insumosFor(1).map(row => row.name)).toEqual(['I2']);
    expect(component.insumosFor(0).map(row => row.name)).toEqual(['I1', 'I2']);
    expect(component.unitOf(component.lines[0])).toBe('kg');
  });

  it('no guarda líneas incompletas ni cantidades no positivas', () => {
    component.open(dish);
    component.lines[0].quantity = 0;
    component.save();
    expect(supplies.saveRecipe).not.toHaveBeenCalled();
    expect(component.lineError(component.lines[0])).toContain('cuánto');
  });

  it('la pantalla exige restaurante e inventario habilitados', () => {
    const capabilities = TestBed.inject(CompanyCapabilitiesService);
    spyOn(capabilities, 'isEnabled').and.callFake(feature => feature !== 'restaurant');
    expect(component.enabled).toBeFalse();
    (capabilities.isEnabled as jasmine.Spy).and.callFake(feature => feature !== 'inventory');
    expect(component.enabled).toBeFalse();
    (capabilities.isEnabled as jasmine.Spy).and.returnValue(true);
    expect(component.enabled).toBeTrue();
  });

  it('la vista previa considera merma y el insumo que limita las porciones', () => {
    component.open(dish);
    component.lines = [{ ingredient: 'I1', quantity: 1, waste_pct: 25, removable: false },
      { ingredient: 'I2', quantity: 1, waste_pct: 0, removable: false }];
    expect(component.preview).toEqual({ portions: 2, limiting: 'Agua' });
  });
});
