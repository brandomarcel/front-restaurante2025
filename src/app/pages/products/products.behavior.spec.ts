import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxSpinnerService } from 'ngx-spinner';
import { of } from 'rxjs';
import { toast } from 'ngx-sonner';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CategoryService } from 'src/app/services/category.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { ProductsService } from 'src/app/services/products.service';
import { TaxesService } from 'src/app/services/taxes.service';
import { ProductsComponent } from './products.component';

/** Caracterización del catálogo: reglas que el rediseño no debe cambiar. */
describe('Productos — reglas del catálogo', () => {
  let fixture: ComponentFixture<ProductsComponent>;
  let component: ProductsComponent;
  let products: any;
  let inventory: any;
  let alert: any;
  let capabilities: any;

  const jean: any = { name: 'ITEM-1', nombre: 'JEAN', precio: 20, codigo: 'J1', isactive: 1, variant_count: 2, tax: 'IVA 15' };

  function setup(overrides: Partial<Record<string, any>> = {}): void {
    capabilities = {
      isLiteMode: true,
      isEnabled: () => true,
      hasPermission: () => true,
      ...overrides
    };
    products = {
      getAll: jasmine.createSpy('getAll').and.returnValue(of({ message: { data: [jean], total: 1, limit: 10, offset: 0 } })),
      create: jasmine.createSpy('create').and.returnValue(of({ name: 'ITEM-NEW', nombre: 'NUEVO' })),
      update: jasmine.createSpy('update').and.returnValue(of({ name: 'ITEM-1' })),
      delete: jasmine.createSpy('delete').and.returnValue(of({})),
      uploadImage: jasmine.createSpy('uploadImage').and.returnValue(of({})),
      getVariantes: jasmine.createSpy('getVariantes').and.returnValue(of({ data: [], total: 3 })),
      createVariante: jasmine.createSpy('createVariante').and.returnValue(of({ name: 'ITEM-1-AZ' })),
      updateVariante: jasmine.createSpy('updateVariante').and.returnValue(of({ name: 'ITEM-1-AZ' })),
      downloadProductImportTemplate: jasmine.createSpy('template').and.returnValue(of(new Blob())),
      previewProductImport: jasmine.createSpy('preview'),
      confirmProductImport: jasmine.createSpy('confirm')
    };
    inventory = { createInventoryMovement: jasmine.createSpy('movement').and.returnValue(of({})) };
    alert = {
      error: jasmine.createSpy('error'),
      confirm: jasmine.createSpy('confirm').and.returnValue(Promise.resolve({ isConfirmed: true }))
    };

    TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [
        { provide: ProductsService, useValue: products },
        { provide: CategoryService, useValue: { getAll: () => of([{ name: 'CAT-1', category_name: 'ROPA' }]) } },
        { provide: TaxesService, useValue: { getAll: () => of({ data: [{ name: 'IVA 15', value: 15 }, { name: 'IVA 0', value: 0 }] }) } },
        { provide: InventoryService, useValue: inventory },
        { provide: NgxSpinnerService, useValue: { show: () => undefined, hide: () => undefined } },
        { provide: AlertService, useValue: alert },
        { provide: FrappeErrorService, useValue: { handle: () => 'Error del servidor' } },
        { provide: CompanyCapabilitiesService, useValue: capabilities }
      ]
    });
    fixture = TestBed.createComponent(ProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    spyOn(toast, 'success');
    spyOn(toast, 'warning');
  });

  it('sin products.read no consulta el catálogo', () => {
    setup({ hasPermission: (key: string) => key !== 'products.read' });
    expect(products.getAll).not.toHaveBeenCalled();
    expect(alert.error).toHaveBeenCalled();
  });

  it('pide siempre activos o inactivos de forma explícita, nunca "todos"', () => {
    setup();
    expect(products.getAll.calls.mostRecent().args[0]).toBe(1);
    expect(products.getAll.calls.mostRecent().args[4]).toBe('Activo');
    component.estadoFiltro = 'Inactivo';
    component.actualizarProductosFiltrados();
    expect(products.getAll.calls.mostRecent().args[0]).toBe(0);
    expect(products.getAll.calls.mostRecent().args[4]).toBe('Inactivo');
  });

  it('guarda nombre y descripción en mayúsculas y envía el id interno de la categoría', () => {
    setup();
    component.abrirModal();
    component.seleccionarTipoProducto('simple');
    component.productoForm.patchValue({ nombre: ' camisa ', descripcion: 'algodón', precio: 10, tax: 'IVA 15', categoria: 'ROPA' });
    const payload = component.buildPayload();
    expect(payload.nombre).toBe('CAMISA');
    expect(payload.descripcion).toBe('ALGODÓN');
    expect(payload.category).toBe('CAT-1');
    expect(payload.tax_value).toBe(15);
  });

  it('el producto con variantes no exige precio ni impuesto', () => {
    setup();
    component.abrirModal();
    component.seleccionarTipoProducto('grouped');
    component.productoForm.patchValue({ nombre: 'JEAN', precio: null, tax: null });
    expect(component.productoForm.valid).toBeTrue();
  });

  it('al editar un producto con variantes bloquea precio e impuesto', () => {
    setup();
    component.abrirModal(jean);
    expect(component.f['precio'].disabled).toBeTrue();
    expect(component.f['tax'].disabled).toBeTrue();
  });

  it('el ajuste de stock respeta el modo elegido (fijar o sumar/restar)', () => {
    setup({ isLiteMode: false });
    component.abrirModal({ ...jean, variant_count: 0, controlar_inventario: 1, stock_actual: 4 });
    component.productoForm.patchValue({ stock_objetivo: 10 });
    expect(component.buildPayload().stock_actual).toBe(10);
    component.setStockMode('delta');
    component.productoForm.patchValue({ stock_ajuste: -3 });
    const payload = component.buildPayload();
    expect(payload.stock_ajuste).toBe(-3);
    expect(payload.stock_actual).toBeUndefined();
  });

  it('la variante nueva con stock inicial registra una Entrada de inventario', () => {
    setup();
    component.abrirVariantes(jean);
    component.abrirFormVariante();
    component.varianteForm.patchValue({ item_name: 'jean azul', item_code: 'J1-AZ', standard_rate: 22, stock_inicial: 5 });
    component.vfAttributes.at(0).patchValue({ value: 'Azul' });
    component.vfAttributes.at(1).patchValue({ value: '32' });
    component.guardarVariante();
    expect(products.createVariante).toHaveBeenCalledWith(jasmine.objectContaining({ item_name: 'JEAN AZUL', variant_of: 'ITEM-1', is_variant: 1 }));
    expect(inventory.createInventoryMovement).toHaveBeenCalledWith(jasmine.objectContaining({ item: 'ITEM-1-AZ', movement_type: 'Entrada', quantity: 5 }));
  });

  it('sincroniza el número de variantes en la lista al consultarlas', () => {
    setup();
    component.abrirVariantes(jean);
    expect(component.productosFiltradosList[0].variant_count).toBe(3);
  });

  it('desactivar desde la lista actualiza isactive y recarga', async () => {
    setup();
    const before = products.getAll.calls.count();
    component.toggleActivo(jean);
    await fixture.whenStable();
    expect(products.update).toHaveBeenCalledWith('ITEM-1', jasmine.objectContaining({ isactive: false }));
    expect(products.getAll.calls.count()).toBe(before + 1);
  });
});

describe('Productos — interfaz', () => {
  let fixture: ComponentFixture<ProductsComponent>;
  let component: ProductsComponent;
  let products: any;

  beforeEach(() => {
    products = {
      getAll: jasmine.createSpy('getAll').and.returnValue(of({ message: { data: [
        { name: 'A', nombre: 'AGUA', precio: 1, isactive: 1, controlar_inventario: 1, stock_actual: 0 },
        { name: 'B', nombre: 'JEAN', precio: 0, isactive: 1, variant_count: 2 }
      ], total: 2, limit: 10, offset: 0 } })),
      update: jasmine.createSpy('update').and.returnValue(of({})),
      delete: jasmine.createSpy('delete').and.returnValue(of({}))
    };
    TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [
        { provide: ProductsService, useValue: products },
        { provide: CategoryService, useValue: { getAll: () => of([]) } },
        { provide: TaxesService, useValue: { getAll: () => of({ data: [{ name: 'IVA 15%', value: 15 }] }) } },
        { provide: InventoryService, useValue: {} },
        { provide: NgxSpinnerService, useValue: { show: () => undefined, hide: () => undefined } },
        { provide: AlertService, useValue: { error: () => undefined, confirm: () => Promise.resolve({ isConfirmed: true }) } },
        { provide: FrappeErrorService, useValue: { handle: () => '' } },
        { provide: CompanyCapabilitiesService, useValue: { isLiteMode: true, isEnabled: () => true, hasPermission: () => true } }
      ]
    });
    fixture = TestBed.createComponent(ProductsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('la búsqueda espera a que se deje de escribir', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 0, 1));
    try {
      const before = products.getAll.calls.count();
      component.searchTerm = 'a';
      component.searchTerm = 'ag';
      component.searchTerm = 'agu';
      expect(products.getAll.calls.count()).toBe(before);
      jasmine.clock().tick(400);
      expect(products.getAll.calls.count()).toBe(before + 1);
      expect(products.getAll.calls.mostRecent().args[3]).toBe('agu');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('muestra "Agotado" y "Por variante" en la lista', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Agotado');
    expect(text).toContain('Por variante');
  });

  it('el menú ⋯ ofrece desactivar y eliminar por separado', () => {
    const more: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Más acciones para AGUA"]');
    more.click();
    fixture.detectChanges();
    const items = Array.from(fixture.nativeElement.querySelectorAll('[role="menuitem"]')).map((el: any) => el.textContent);
    expect(items[0]).toContain('Desactivar');
    expect(items[1]).toContain('Eliminar');
  });

  it('el impuesto se elige con botones legibles', () => {
    component.abrirModal();
    component.seleccionarTipoProducto('simple');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="radiogroup"][aria-label="Impuesto"]').textContent).toContain('IVA 15%');
  });

  it('Esc cierra primero el formulario de variante y luego la lista de variantes', () => {
    component.variantesModalVisible = true;
    component.varianteFormVisible = true;
    component.onEscape();
    expect(component.varianteFormVisible).toBeFalse();
    expect(component.variantesModalVisible).toBeTrue();
  });
});
