import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { InventoryService } from './inventory.service';
import { KitchenSuppliesService } from './kitchen-supplies.service';

describe('Insumos y recetas: transporte y movimientos', () => {
  let service: KitchenSuppliesService;
  let http: HttpTestingController;
  let capabilities: any;
  let inventory: any;
  let previousWarehouse: string | null;
  beforeEach(() => {
    previousWarehouse = localStorage.getItem('inventory_active_warehouse:BIZ-TEST');
    localStorage.removeItem('inventory_active_warehouse:BIZ-TEST');
    capabilities = { activeBusinessId: 'BIZ-TEST', isWarehouseMode: false, activeWarehouses: [], defaultWarehouse: null };
    inventory = { createInventoryMovement: jasmine.createSpy('movement').and.returnValue(of({})) };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: CompanyCapabilitiesService, useValue: capabilities }, { provide: InventoryService, useValue: inventory }] });
    service = TestBed.inject(KitchenSuppliesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    if (previousWarehouse === null) localStorage.removeItem('inventory_active_warehouse:BIZ-TEST');
    else localStorage.setItem('inventory_active_warehouse:BIZ-TEST', previousWarehouse);
  });

  it('crear un insumo fuerza stock y registra la existencia inicial como movimiento separado', () => {
    service.createIngredient({ name: ' harina ', unit: 'kg', minimum_stock: 2, initial_stock: 5 }).subscribe();
    const req = http.expectOne(r => r.url.endsWith('.create_producto'));
    expect(req.request.body).toEqual(jasmine.objectContaining({ business: 'BIZ-TEST', item_name: 'HARINA', is_ingredient: 1, track_stock: 1 }));
    expect(req.request.body.current_stock).toBeUndefined();
    req.flush({ message: { data: { name: 'ING-1' } } });
    expect(inventory.createInventoryMovement).toHaveBeenCalledWith(jasmine.objectContaining({ item: 'ING-1', movement_type: 'Entrada', quantity: 5 }));
  });

  it('no oculta un fallo del stock inicial ni vuelve a crear el insumo', () => {
    const failure = new Error('Stock failure');
    inventory.createInventoryMovement.and.returnValue(throwError(() => failure));
    let result: any;
    service.createIngredient({ name: 'Agua', unit: 'l', minimum_stock: 0, initial_stock: 5 }).subscribe(value => result = value);
    http.expectOne(r => r.url.endsWith('.create_producto')).flush({ message: { data: { name: 'ING-2' } } });
    expect(result.item.name).toBe('ING-2');
    expect(result.stockError).toBe(failure);
  });

  it('guarda receta y merma, y permite quitarla con lista vacía', () => {
    service.saveRecipe({ name: 'DISH', track_stock: 1 }, [{ ingredient: 'ING', quantity: .5, waste_pct: 10, removable: true }]).subscribe();
    const req = http.expectOne(r => r.url.endsWith('.update_producto'));
    expect(req.request.body).toEqual({ name: 'DISH', business: 'BIZ-TEST', track_stock: 0,
      recipe: [{ ingredient: 'ING', quantity: .5, waste_pct: 10, removable: 1 }] });
    req.flush({ message: { data: { name: 'DISH' } } });
    service.saveRecipe({ name: 'DISH', track_stock: 0 }, []).subscribe();
    const remove = http.expectOne(r => r.url.endsWith('.update_producto'));
    expect(remove.request.body.recipe).toEqual([]);
    remove.flush({ message: { data: { name: 'DISH' } } });
  });

  it('descarta una bodega persistida ajena a las opciones del negocio activo', () => {
    capabilities.isWarehouseMode = true;
    capabilities.activeWarehouses = [{ name: 'W-VALID' }];
    capabilities.defaultWarehouse = { name: 'W-VALID' };
    localStorage.setItem('inventory_active_warehouse:BIZ-TEST', 'W-FOREIGN');
    service.getIngredients().subscribe();
    const req = http.expectOne(r => r.url.endsWith('.get_insumos'));
    expect(req.request.params.get('business')).toBe('BIZ-TEST');
    expect(req.request.params.get('warehouse')).toBe('W-VALID');
    req.flush({ message: { data: [], total: 0 } });
  });
});
