import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { KitchenSuppliesService } from 'src/app/services/kitchen-supplies.service';
import { RecipesComponent } from './recipes.component';

describe('Recetas: porciones con decimales', () => {
  let component: RecipesComponent;

  beforeEach(() => {
    const supplies = {
      warehouse: '',
      getDishes: () => of({ data: [], counts: {}, total: 0 }),
      getIngredients: () => of({ data: [{ name: 'L', item_name: 'Lechuga', unit: 'und', current_stock: 11 }] }),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: KitchenSuppliesService, useValue: supplies },
        { provide: CompanyCapabilitiesService, useValue: { isEnabled: () => true, hasPermission: () => true, isWarehouseMode: false } },
        { provide: AlertService, useValue: { error: () => undefined, confirm: () => Promise.resolve({ isConfirmed: true }) } },
        { provide: FrappeErrorService, useValue: { handle: () => 'Error' } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new RecipesComponent());
    component.open({ name: 'D', item_code: 'D', item_name: 'Plato', standard_rate: 5, track_stock: 0, has_recipe: false, lines: [] });
  });

  it('11 lechugas a 2 por porción con 10 % de merma alcanzan para 5 porciones, no 4', () => {
    component.lines = [{ ingredient: 'L', quantity: 2, waste_pct: 10, removable: false }];
    expect(component.preview).toEqual({ portions: 5, limiting: 'Lechuga' });
  });

  it('una sola unidad menos de stock baja a 4', () => {
    component.lines = [{ ingredient: 'L', quantity: 2.2, waste_pct: 0, removable: false }];
    (component as any).insumos[0].current_stock = 10.9;
    expect(component.preview.portions).toBe(4);
  });

  it('sin líneas válidas no inventa porciones', () => {
    component.lines = [{ ingredient: '', quantity: null, waste_pct: 0, removable: false }];
    expect(component.preview).toEqual({ portions: null, limiting: null });
  });
});
