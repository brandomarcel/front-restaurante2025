import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { TaxesService } from './taxes.service';

describe('Impuestos: endpoint Lite para ambos modos', () => {
  let http: HttpTestingController;
  let service: TaxesService;
  let capabilities: any;
  beforeEach(() => {
    capabilities = { isLiteMode: false, activeBusinessId: 'BIZ-ACTIVE', businessId: 'BIZ-OLD' };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: CompanyCapabilitiesService, useValue: capabilities }] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(TaxesService);
  });
  afterEach(() => http.verify());

  for (const isLiteMode of [false, true]) {
    it(`consulta Lite con negocio activo y sesión cuando isLiteMode=${isLiteMode}`, () => {
      capabilities.isLiteMode = isLiteMode;
      let result: any;
      service.getAll().subscribe(value => result = value);
      const req = http.expectOne(r => r.url.endsWith('.get_taxes'));
      expect(req.request.params.get('business')).toBe('BIZ-ACTIVE');
      expect(req.request.context.get(REQUIRE_AUTH)).toBeTrue();
      req.flush({ message: { data: [{ codigo: 'IVA15', rate: 15 }, { name: 'CERO', value: 0 }] } });
      expect(result.data).toEqual([{ codigo: 'IVA15', rate: 15, name: 'IVA15', value: 15 }, { name: 'CERO', value: 0 }]);
      http.expectNone(r => r.url.includes('/resource/taxes'));
    });
  }
});
