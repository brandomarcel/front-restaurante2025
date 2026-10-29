import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CompanyMigrationComponent } from './company-migration.component';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { REQUIRE_AUTH } from 'src/app/core/interceptor/auth-context';

describe('Transferencia de empresa desde Restaurante', () => {
  let fixture: ComponentFixture<CompanyMigrationComponent>;
  let component: CompanyMigrationComponent;
  let http: HttpTestingController;
  let capabilities: any;
  const context = { business: 'DEST', name: 'Negocio de pruebas', tax_id: '1790012345001', inventory_mode: 'Simple', warehouses: [], imports: [] };
  beforeEach(() => {
    capabilities = { activeBusinessId: 'DEST' };
    TestBed.configureTestingModule({ imports: [CompanyMigrationComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
      { provide: CompanyCapabilitiesService, useValue: capabilities }
    ] });
    fixture = TestBed.createComponent(CompanyMigrationComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    const request = http.expectOne(req => req.url.endsWith('.get_context'));
    expect(request.request.params.get('business')).toBe('DEST');
    request.flush({ message: context });
  });
  afterEach(() => http.verify());
  function select(): void {
    component.choose({ target: { files: [new File(['synthetic'], 'empresa.zip', { type: 'application/zip' })] } } as any);
  }
  it('revisa el ZIP en la empresa seleccionada sin importar operaciones', () => {
    select(); component.inspect();
    const request = http.expectOne(req => req.url.endsWith('.preview'));
    expect(request.request.context.get(REQUIRE_AUTH)).toBeTrue();
    expect((request.request.body as FormData).get('business')).toBe('DEST');
    expect((request.request.body as FormData).get('file')).toBe(component.file);
    request.flush({ message: { name: 'PREVIEW', can_import: false, counts: { orders: 1 }, errors: ['Caja abierta'], warnings: [], source_company: {} } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Caja abierta');
    expect((fixture.nativeElement.querySelector('[data-test-id="migration-confirm"]') as HTMLButtonElement).disabled).toBeTrue();
    component.import();
    http.expectNone(req => req.url.endsWith('.confirm'));
  });
  it('confirma una sola vez y conserva el identificador de la vista previa', () => {
    component.preview = { name: 'PREVIEW', can_import: true };
    component.import(); component.import();
    const request = http.expectOne(req => req.url.endsWith('.confirm'));
    expect(request.request.body).toEqual({ business: 'DEST', name: 'PREVIEW' });
    request.flush({ message: { name: 'PREVIEW', status: 'Importado' } });
    http.expectOne(req => req.url.endsWith('.get_context')).flush({ message: context });
    expect(component.result.status).toBe('Importado');
    component.import();
    http.expectNone(req => req.url.endsWith('.confirm'));
  });
  it('no confirma en otra empresa si se cambia el contexto durante la revision', () => {
    component.preview = { name: 'PREVIEW', can_import: true };
    capabilities.activeBusinessId = 'OTHER';
    component.import();
    http.expectNone(req => req.url.endsWith('.confirm'));
    expect(component.sameBusiness).toBeFalse();
  });
  it('cambiar el archivo elimina la confirmacion anterior', () => {
    component.preview = { name: 'OLD', can_import: true };
    select();
    expect(component.preview).toBeNull();
    component.import();
    http.expectNone(req => req.url.endsWith('.confirm'));
  });
  it('muestra denegacion sin convertirla en una importacion exitosa', () => {
    component.preview = { name: 'PREVIEW', can_import: true };
    component.import();
    http.expectOne(req => req.url.endsWith('.confirm')).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(component.busy).toBeFalse();
    expect(component.result).toBeUndefined();
    expect(component.error).toContain('No tienes permiso');
  });
});
