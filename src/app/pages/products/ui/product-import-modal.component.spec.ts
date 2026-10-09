import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { toast } from 'ngx-sonner';
import { AlertService } from 'src/app/core/services/alert.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { ProductsService } from 'src/app/services/products.service';
import { ProductImportModalComponent } from './product-import-modal.component';

describe('Carga masiva de productos', () => {
  let fixture: ComponentFixture<ProductImportModalComponent>;
  let component: ProductImportModalComponent;
  let products: any;
  let alert: any;
  const xlsx = new File(['x'], 'productos.xlsx');
  const row = (n: number, errors: string[] = []) => ({ row_number: n, code: `C${n}`, name: `P${n}`, is_variant: false, errors });

  beforeEach(() => {
    spyOn(toast, 'success');
    spyOn(toast, 'warning');
    products = {
      downloadProductImportTemplate: jasmine.createSpy('template').and.returnValue(of(new Blob())),
      previewProductImport: jasmine.createSpy('preview'),
      confirmProductImport: jasmine.createSpy('confirm').and.returnValue(of({ created: 2, updated: 0, stock_movements: 0, total: 2 }))
    };
    alert = { error: jasmine.createSpy('error') };
    TestBed.configureTestingModule({
      imports: [ProductImportModalComponent],
      providers: [
        { provide: ProductsService, useValue: products },
        { provide: AlertService, useValue: alert },
        { provide: FrappeErrorService, useValue: { handle: () => 'Error' } }
      ]
    });
    fixture = TestBed.createComponent(ProductImportModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function choose(file: File): void {
    component.onImportFileSelected({ target: { files: [file], value: 'x' } } as any);
  }

  it('solo acepta archivos .xlsx', () => {
    choose(new File(['x'], 'productos.csv'));
    expect(component.importFile).toBeNull();
    expect(alert.error).toHaveBeenCalledWith('El archivo debe tener extensión .xlsx.');
  });

  it('no confirma mientras haya filas con error y muestra primero los errores', () => {
    products.previewProductImport.and.returnValue(of({ rows: [row(1), row(2, ['Precio inválido'])], summary: { total: 2, valid: 1, invalid: 1 }, can_confirm: true }));
    choose(xlsx);
    component.validarImportacion();
    expect(component.rowsFilter).toBe('errors');
    expect(component.visibleRows.length).toBe(1);
    component.confirmarImportacion();
    expect(products.confirmProductImport).not.toHaveBeenCalled();
  });

  it('cambiar el modo invalida la revisión anterior', () => {
    products.previewProductImport.and.returnValue(of({ rows: [row(1)], summary: { total: 1, valid: 1, invalid: 0 }, can_confirm: true }));
    choose(xlsx);
    component.validarImportacion();
    component.setMode('upsert');
    expect(component.importPreview).toBeNull();
    expect(component.canConfirmImport).toBeFalse();
  });

  it('confirma con el mismo archivo revisado y avisa para recargar el catálogo', () => {
    const imported = jasmine.createSpy('imported');
    component.imported.subscribe(imported);
    products.previewProductImport.and.returnValue(of({ rows: [row(1), row(2)], summary: { total: 2, valid: 2, invalid: 0 }, can_confirm: true }));
    choose(xlsx);
    component.validarImportacion();
    component.confirmarImportacion();
    expect(products.confirmProductImport).toHaveBeenCalledWith('create_only', xlsx);
    expect(imported).toHaveBeenCalled();
    expect(component.importResult?.created).toBe(2);
  });

  it('detecta el producto agrupador de las variantes', () => {
    products.previewProductImport.and.returnValue(of({
      rows: [row(1), { ...row(2), is_variant: true, parent_code: 'C1', atributos: 'Color=Negro,Talla=M' }],
      summary: { total: 2, valid: 2, invalid: 0 }, can_confirm: true
    }));
    choose(xlsx);
    component.validarImportacion();
    const [parent, variant] = component.importPreview!.rows;
    expect(component.isImportGrouperRow(parent)).toBeTrue();
    expect(component.importRowAttributes(variant)).toBe('Color: Negro · Talla: M');
  });
});
