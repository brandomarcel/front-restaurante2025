import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgxSpinnerService } from 'ngx-spinner';
import { of } from 'rxjs';
import { toast } from 'ngx-sonner';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CategoryService } from 'src/app/services/category.service';
import { CategorysComponent } from './categorys.component';

/** Caracterización de Categorías: reglas que el rediseño no debe cambiar. */
describe('Categorías — reglas', () => {
  let fixture: ComponentFixture<CategorysComponent>;
  let component: CategorysComponent;
  let categories: any;
  let alert: any;

  const ropa = { name: 'CAT-1', category_name: 'ropa', description: 'prendas', isactive: 1 };

  function setup(hasPermission: (key: string) => boolean = () => true): void {
    categories = {
      getAll: jasmine.createSpy('getAll').and.returnValue(of({ message: { data: [ropa], total: 1, limit: 10, offset: 0 } })),
      create: jasmine.createSpy('create').and.returnValue(of({})),
      update: jasmine.createSpy('update').and.returnValue(of({})),
      delete: jasmine.createSpy('delete').and.returnValue(of({}))
    };
    alert = {
      error: jasmine.createSpy('error'),
      confirm: jasmine.createSpy('confirm').and.returnValue(Promise.resolve({ isConfirmed: true }))
    };
    TestBed.configureTestingModule({
      imports: [CategorysComponent],
      providers: [
        { provide: CategoryService, useValue: categories },
        { provide: NgxSpinnerService, useValue: { show: () => undefined, hide: () => undefined } },
        { provide: AlertService, useValue: alert },
        { provide: FrappeErrorService, useValue: { handle: () => 'Error del servidor' } },
        { provide: CompanyCapabilitiesService, useValue: { isLiteMode: true, isEnabled: () => true, hasPermission } }
      ]
    });
    fixture = TestBed.createComponent(CategorysComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    spyOn(toast, 'success');
    spyOn(window, 'confirm').and.returnValue(true);
  });

  it('sin products.read no consulta', () => {
    setup((key) => key !== 'products.read');
    expect(categories.getAll).not.toHaveBeenCalled();
    expect(alert.error).toHaveBeenCalled();
  });

  it('filtra por estado enviando Activo/Inactivo al backend', () => {
    setup();
    component.estadoFiltro = 'inactivos';
    component.actualizarCategoriasFiltradas();
    expect(categories.getAll.calls.mostRecent().args[4]).toBe('Inactivo');
    component.estadoFiltro = '';
    component.actualizarCategoriasFiltradas();
    expect(categories.getAll.calls.mostRecent().args[4]).toBeUndefined();
  });

  it('crea en mayúsculas', () => {
    setup();
    component.abrirModal();
    component.categoriaForm.patchValue({ nombre: ' bebidas ', description: 'frías' });
    component.guardarCategoria();
    expect(categories.create).toHaveBeenCalledWith(jasmine.objectContaining({ nombre: 'BEBIDAS', description: 'FRÍAS', isactive: true }));
  });

  it('edita por name y conserva el estado', () => {
    setup();
    component.abrirModal(ropa);
    component.guardarCategoria();
    expect(categories.update).toHaveBeenCalledWith('CAT-1', jasmine.objectContaining({ nombre: 'ROPA', isactive: true }));
  });

  it('no guarda sin nombre', () => {
    setup();
    component.abrirModal();
    component.guardarCategoria();
    expect(categories.create).not.toHaveBeenCalled();
  });

  it('desactivar pide confirmación y llama a delete', async () => {
    setup();
    component.eliminar('CAT-1');
    await fixture.whenStable();
    expect(categories.delete).toHaveBeenCalledWith('CAT-1');
  });

  it('sin products.manage no abre el formulario', () => {
    setup((key) => key !== 'products.manage');
    component.abrirModal();
    expect(component.mostrarModal).toBeFalse();
  });

  it('solo ofrece desactivar a las categorías activas', () => {
    setup();
    component.categoriesFiltradasList = [ropa, { ...ropa, name: 'CAT-2', category_name: 'viejas', isactive: 0 }];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('app-icon-action-button[variant="delete"]').length).toBe(1);
  });
});
