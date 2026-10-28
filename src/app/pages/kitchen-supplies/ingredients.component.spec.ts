import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { toast } from 'ngx-sonner';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { Ingredient, KitchenSuppliesService } from 'src/app/services/kitchen-supplies.service';
import { IngredientsComponent } from './ingredients.component';

describe('Insumos: alta, movimientos y estados', () => {
  let component: IngredientsComponent;
  let supplies: any;
  let alerts: any;
  let caps: any;
  const row = (over: Partial<Ingredient> = {}): Ingredient => ({
    name: 'I1', item_code: 'I1', item_name: 'CARNE', unit: 'g', minimum_stock: 100, current_stock: 500, state: 'ok', used_in: 2, ...over,
  });

  function build() {
    TestBed.configureTestingModule({
      providers: [
        { provide: KitchenSuppliesService, useValue: supplies },
        { provide: CompanyCapabilitiesService, useValue: caps },
        { provide: AlertService, useValue: alerts },
        { provide: FrappeErrorService, useValue: { handle: (e: any) => e?.message || 'Error' } },
      ],
    });
    component = TestBed.runInInjectionContext(() => new IngredientsComponent());
    spyOn(toast, 'success');
  }

  beforeEach(() => {
    supplies = {
      warehouse: '',
      getIngredients: jasmine.createSpy('list').and.returnValue(of({ data: [row()], total: 1, counts: { all: 1, ok: 1, low: 0, out: 0 }, has_next: false })),
      createIngredient: jasmine.createSpy('create').and.returnValue(of({ item: { name: 'N' }, stockError: null })),
      updateIngredient: jasmine.createSpy('update').and.returnValue(of({})),
      registerMovement: jasmine.createSpy('move').and.returnValue(of({})),
    };
    alerts = { error: jasmine.createSpy('error'), confirm: jasmine.createSpy('confirm').and.returnValue(Promise.resolve({ isConfirmed: true })) };
    caps = { isEnabled: () => true, hasPermission: () => true, isWarehouseMode: false };
    build();
    component.ngOnInit();
  });

  it('carga la lista y los contadores', () => {
    expect(component.rows.length).toBe(1);
    expect(component.counts['all']).toBe(1);
    expect(component.loading).toBeFalse();
  });

  it('sin insumos ni filtros muestra la guía de primer uso', () => {
    supplies.getIngredients.and.returnValue(of({ data: [], total: 0, counts: { all: 0 }, has_next: false }));
    component.load();
    expect(component.isFirstRun).toBeTrue();
  });

  it('un filtro activo sin resultados no es primer uso', () => {
    supplies.getIngredients.and.returnValue(of({ data: [], total: 0, counts: { all: 0 }, has_next: false }));
    component.search = 'zzz';
    component.load();
    expect(component.isFirstRun).toBeFalse();
  });

  it('un error de carga muestra el mensaje y permite reintentar', () => {
    supplies.getIngredients.and.returnValue(throwError(() => new Error('sin red')));
    component.load();
    expect(component.loadError).toBe('sin red');
    expect(component.loading).toBeFalse();
  });

  it('tocar dos veces la misma tarjeta quita el filtro', () => {
    component.setFilter('low');
    expect(component.filter).toBe('low');
    component.setFilter('low');
    expect(component.filter).toBe('all');
  });

  it('no guarda un insumo sin nombre', () => {
    component.openCreate();
    component.save();
    expect(component.nameInvalid).toBeTrue();
    expect(supplies.createIngredient).not.toHaveBeenCalled();
  });

  it('crea el insumo con unidad, stock inicial y mínimo', () => {
    component.openCreate();
    component.form = { name: ' lechuga ', unit: 'und', minimum_stock: 5, initial_stock: 40 };
    component.save();
    expect(supplies.createIngredient).toHaveBeenCalledWith({ name: ' lechuga ', unit: 'und', minimum_stock: 5, initial_stock: 40 });
    expect(component.formOpen).toBeFalse();
  });

  it('«Guardar y otro» deja el formulario abierto, vacío y con la misma unidad', () => {
    component.openCreate();
    component.form = { name: 'Tomate', unit: 'g', minimum_stock: 5, initial_stock: 10 };
    component.save(true);
    expect(component.formOpen).toBeTrue();
    expect(component.form).toEqual({ name: '', unit: 'g', minimum_stock: 0, initial_stock: 0 });
  });

  it('si falla el stock inicial avisa, pero el insumo ya quedó creado', () => {
    supplies.createIngredient.and.returnValue(of({ item: { name: 'N' }, stockError: new Error('sin permiso') }));
    component.openCreate();
    component.form = { name: 'Pan', unit: 'und', minimum_stock: 0, initial_stock: 10 };
    component.save();
    expect(alerts.error).toHaveBeenCalledWith('sin permiso');
  });

  it('una salida mayor al stock se rechaza y no llama al backend', () => {
    component.openMove(row({ current_stock: 5 }), 'Salida');
    component.moveQty = 9;
    component.confirmMove();
    expect(component.moveError).toContain('más de lo que hay');
    expect(supplies.registerMovement).not.toHaveBeenCalled();
  });

  it('una compra suma y muestra el stock resultante antes de confirmar', () => {
    component.openMove(row({ current_stock: 5 }), 'Entrada');
    component.moveQty = 10;
    expect(component.moveResult).toBe(15);
    component.confirmMove();
    expect(supplies.registerMovement).toHaveBeenCalledWith('I1', 'Entrada', 10, '');
  });

  it('contar acepta cero y deja ese valor como stock real', () => {
    component.openMove(row({ current_stock: 5 }), 'Ajuste');
    component.moveQty = 0;
    expect(component.moveQtyInvalid).toBeFalse();
    expect(component.moveResult).toBe(0);
    component.confirmMove();
    expect(supplies.registerMovement).toHaveBeenCalledWith('I1', 'Ajuste', 0, '');
  });

  it('cambiar de tipo de movimiento limpia la cantidad', () => {
    component.openMove(row(), 'Entrada');
    component.moveQty = 4;
    component.setMoveKind('Salida');
    expect(component.moveQty).toBeNull();
  });

  it('desactivar pide confirmación y avisa de las recetas que lo usan', async () => {
    component.openEdit(row({ used_in: 3 }));
    await component.deactivate();
    expect(alerts.confirm.calls.mostRecent().args[0]).toContain('3 platos');
    expect(supplies.updateIngredient).toHaveBeenCalledWith('I1', { status: 'Inactivo' });
  });

  it('cancelar la confirmación no desactiva', async () => {
    alerts.confirm.and.returnValue(Promise.resolve({ isConfirmed: false }));
    component.openEdit(row());
    await component.deactivate();
    expect(supplies.updateIngredient).not.toHaveBeenCalled();
  });

  it('sin permiso de productos no puede crear, y sin permiso de inventario no puede mover', () => {
    caps.hasPermission = (key: string) => key === 'inventory.read';
    expect(component.canCreate).toBeFalse();
    expect(component.canMove).toBeFalse();
  });

  it('en modo por bodega sin bodega elegida no carga nada', () => {
    caps.isWarehouseMode = true;
    supplies.getIngredients.calls.reset();
    component.load();
    expect(component.needsWarehouse).toBeTrue();
    expect(supplies.getIngredients).not.toHaveBeenCalled();
  });

  it('la pantalla exige restaurante e inventario', () => {
    caps.isEnabled = (key: string) => key === 'inventory';
    expect(component.enabled).toBeFalse();
  });

  it('la barra de stock nunca sale del 0-100 %', () => {
    expect(component.fillPercent(row({ current_stock: 100000 }))).toBe(100);
    expect(component.fillPercent(row({ current_stock: 0 }))).toBe(0);
  });
});
