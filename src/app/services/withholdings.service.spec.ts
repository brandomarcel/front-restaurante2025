import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { WithholdingInput, WithholdingsService } from './withholdings.service';

describe('WithholdingsService RPC contract', () => {
  let service: WithholdingsService;
  let http: HttpTestingController;
  let capabilities: { activeBusinessId: string; businessId: string };
  const input: WithholdingInput = {
    supplier: 'SUP-TEST',
    support: {
      cod_sustento: '01',
      cod_doc_sustento: '01',
      num_doc_sustento: '001-001-000000001',
      fecha_emision_doc_sustento: '2026-11-10',
      forma_pago: '20',
      taxes: [{ tax_code: '4', base_imponible: 100 }],
    },
    retentions: [{ tax_type: 'Renta', codigo_retencion: '312', base_imponible: 100, porcentaje: 2 }],
  };

  beforeEach(() => {
    capabilities = { activeBusinessId: 'BUS-TEST', businessId: '' };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CompanyCapabilitiesService, useValue: capabilities },
      ],
    });
    service = TestBed.inject(WithholdingsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('posts prior SRI annulment to the withholding endpoint with explicit confirmation', () => {
    service.registerSriAnnulment('WH-TEST', { date: '2026-11-11', reason: 'Retención duplicada', confirmed: true }).subscribe();
    const req = http.expectOne(request => request.url.endsWith('.register_lite_withholding_sri_annulment'));
    expect(req.request.method).toBe('POST');
    expect(req.request.context.get(REQUIRE_AUTH)).toBeTrue();
    expect(req.request.body).toEqual({ business: 'BUS-TEST', withholding_name: 'WH-TEST',
      sri_annulment_date: '2026-11-11', reason: 'Retención duplicada', sri_reference: null, confirmed_in_sri: 1 });
    req.flush({ message: { data: { name: 'WH-TEST', status: 'Anulada' } } });
  });

  it('sends filters and business by GET and preserves server status counts', () => {
    let result: any;
    service
      .getAll(20, 40, 'EN_PROCESO', ' Proveedor ', { from: '2026-11-01', to: '2026-11-10' })
      .subscribe((value) => (result = value));
    const req = http.expectOne((request) => request.url.endsWith('.get_all_withholdings'));
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(REQUIRE_AUTH)).toBeTrue();
    expect(req.request.params.keys().sort()).toEqual([
      'business',
      'from_date',
      'limit',
      'offset',
      'search',
      'status',
      'to_date',
    ]);
    expect(req.request.params.get('business')).toBe('BUS-TEST');
    expect(req.request.params.get('search')).toBe('Proveedor');
    expect(req.request.params.get('offset')).toBe('40');
    expect(req.request.params.get('status')).toBe('EN_PROCESO');
    req.flush({
      message: { data: [{ name: 'WH-TEST' }], total: 80, has_next: true, status_counts: { ALL: 80, EN_PROCESO: 5 } },
    });
    expect(result.message.status_counts).toEqual({ ALL: 80, EN_PROCESO: 5 });
    expect(result.message.has_next).toBeTrue();
  });

  it('normalizes malformed list data and omits empty filters', () => {
    let result: any;
    service.getAll(0).subscribe((value) => (result = value));
    const req = http.expectOne((request) => request.url.endsWith('.get_all_withholdings'));
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.has('status')).toBeFalse();
    expect(req.request.params.has('search')).toBeFalse();
    req.flush({ message: { data: {}, total: 'invalid' } });
    expect(result.message.data).toEqual([]);
    expect(result.message.total).toBe(0);
  });

  it('reads detail and setup by authenticated GET with tenant parameters', () => {
    const values: any[] = [];
    service.getDetail('WH-TEST').subscribe((value) => values.push(value));
    const detail = http.expectOne((request) => request.url.endsWith('.get_lite_withholding_detail'));
    expect(detail.request.params.get('name')).toBe('WH-TEST');
    expect(detail.request.params.get('business')).toBe('BUS-TEST');
    detail.flush({ message: { data: { name: 'WH-TEST' } } });
    service.getSetup().subscribe((value) => values.push(value));
    const setup = http.expectOne((request) => request.url.endsWith('.get_withholding_setup'));
    expect(setup.request.method).toBe('GET');
    expect(setup.request.params.get('business')).toBe('BUS-TEST');
    setup.flush({ message: { data: { withholding_agent: true } } });
    expect(values).toEqual([{ name: 'WH-TEST' }, { withholding_agent: true }]);
  });

  it('posts access-key lookup and draft payload without inventing computed taxes', () => {
    service.lookupAccessKey('1'.repeat(49)).subscribe();
    const lookup = http.expectOne((request) => request.url.endsWith('.lookup_lite_access_key'));
    expect(lookup.request.method).toBe('POST');
    expect(lookup.request.body).toEqual({ business: 'BUS-TEST', access_key: '1'.repeat(49) });
    lookup.flush({ message: { data: { valid: true } } });
    service.saveDraft(input).subscribe();
    const draft = http.expectOne((request) => request.url.endsWith('.create_lite_withholding'));
    expect(draft.request.method).toBe('POST');
    expect(draft.request.body).toEqual({ business: 'BUS-TEST', payload: input });
    draft.flush({ message: { data: { name: 'WH-TEST' } } });
  });

  it('normalizes create-and-emit response into the common fiscal lifecycle', () => {
    let result: any;
    service.createAndEmit(input).subscribe((value) => (result = value));
    const req = http.expectOne((request) => request.url.endsWith('.create_and_emit_lite_withholding'));
    expect(req.request.body).toEqual({ business: 'BUS-TEST', payload: input });
    req.flush({ message: { data: { name: 'WH-TEST' }, emission: { ok: true, code: 'SRI_AUTHORIZED' } } });
    expect(result.state).toBe('AUTHORIZED');
    expect(result.invoiceName).toBe('WH-TEST');
  });

  for (const [action, method] of [
    ['emitDraft', 'emit_lite_withholding'],
    ['refreshStatus', 'refresh_lite_withholding_status'],
    ['retry', 'retry_lite_withholding'],
  ] as const) {
    it(`posts ${action} with withholding_name, business and authentication context`, () => {
      let result: any;
      service[action]('WH-TEST').subscribe((value) => (result = value));
      const req = http.expectOne((request) => request.url.endsWith(`.${method}`));
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ business: 'BUS-TEST', withholding_name: 'WH-TEST' });
      expect(req.request.context.get(REQUIRE_AUTH)).toBeTrue();
      req.flush({ message: { data: { name: 'WH-TEST' }, emission: { ok: true, code: 'SRI_RECEIVED' } } });
      expect(result.state).toBe('PROCESSING');
    });
  }

  it('requires tenant selection before list, setup, draft or create-and-emit', () => {
    capabilities.activeBusinessId = '';
    const oldActive = localStorage.getItem('active_business'),
      oldBusiness = localStorage.getItem('businessId');
    localStorage.removeItem('active_business');
    localStorage.removeItem('businessId');
    try {
      const error = jasmine.createSpy('error');
      service.getAll().subscribe({ error });
      service.getSetup().subscribe({ error });
      service.saveDraft(input).subscribe({ error });
      service.createAndEmit(input).subscribe({ error });
      expect(error).toHaveBeenCalledTimes(4);
      http.expectNone(() => true);
    } finally {
      if (oldActive !== null) localStorage.setItem('active_business', oldActive);
      if (oldBusiness !== null) localStorage.setItem('businessId', oldBusiness);
    }
  });
});
