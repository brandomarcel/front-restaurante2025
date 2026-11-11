import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { LiteSuppliersService, supplierIdentificationLabel } from './lite-suppliers.service';

describe('Lite suppliers RPC contract', () => {
  let service: LiteSuppliersService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CompanyCapabilitiesService, useValue: { activeBusinessId: 'BUS-TEST' } },
      ],
    });
    service = TestBed.inject(LiteSuppliersService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('searches suppliers on the server with tenant, pagination and trimmed query', () => {
    let value: any;
    service.search(' Empresa ', 8, 16).subscribe((result) => (value = result));
    const req = http.expectOne((request) => request.url.endsWith('.get_lite_suppliers'));
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(REQUIRE_AUTH)).toBeTrue();
    expect(req.request.params.get('business')).toBe('BUS-TEST');
    expect(req.request.params.get('search')).toBe('Empresa');
    expect(req.request.params.get('offset')).toBe('16');
    req.flush({ message: { data: [{ name: 'SUP-TEST' }], total: 20, has_next: true } });
    expect(value).toEqual({ data: [{ name: 'SUP-TEST' }], total: 20, has_next: true });
  });

  it('creates and updates supplier through POST payload without a second API', () => {
    for (const name of [undefined, 'SUP-TEST']) {
      const input = {
        ...(name ? { name } : {}),
        supplier_name: 'Empresa ficticia',
        identification_type: '04' as const,
        identification: '1790012345001',
        related_party: false,
      };
      service.save(input).subscribe();
      const req = http.expectOne((request) => request.url.endsWith('.save_lite_supplier'));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ business: 'BUS-TEST', payload: input });
      expect(req.request.context.get(REQUIRE_AUTH)).toBeTrue();
      req.flush({ message: { data: { name: 'SUP-TEST', ...input } } });
    }
  });

  it('uses user-facing identification labels and safe empty list fallback', () => {
    expect(supplierIdentificationLabel('04')).toBe('RUC');
    expect(supplierIdentificationLabel('05')).toBe('Cédula');
    expect(supplierIdentificationLabel(null)).toBe('—');
    service.search().subscribe((result) => expect(result).toEqual({ data: [], total: 0, has_next: false }));
    http.expectOne((request) => request.url.endsWith('.get_lite_suppliers')).flush({ message: { data: {} } });
  });
});
