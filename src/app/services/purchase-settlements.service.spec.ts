import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { PurchaseSettlementInput, PurchaseSettlementsService } from './purchase-settlements.service';

describe('Purchase settlements RPC contract', () => {
  let service: PurchaseSettlementsService;
  let http: HttpTestingController;
  const payload: PurchaseSettlementInput = {
    supplier: 'SUP-TEST',
    forma_pago: '20',
    items: [{ descripcion: 'Compra ficticia', cantidad: 2, precio_unitario: 10, tax_code: '0' }],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CompanyCapabilitiesService, useValue: { activeBusinessId: 'BUS-TEST' } },
      ],
    });
    service = TestBed.inject(PurchaseSettlementsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lists with tenant, grouped status, search and date range before pagination', () => {
    let value: any;
    service
      .getAll(20, 40, 'CON_ERROR', ' Agricultor ', { from: '2026-11-01', to: '2026-11-11' })
      .subscribe((result) => (value = result));
    const req = http.expectOne((request) => request.url.endsWith('.get_all_purchase_settlements'));
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(REQUIRE_AUTH)).toBeTrue();
    expect(req.request.params.get('business')).toBe('BUS-TEST');
    expect(req.request.params.get('status')).toBe('CON_ERROR');
    expect(req.request.params.get('search')).toBe('Agricultor');
    expect(req.request.params.get('offset')).toBe('40');
    expect(req.request.params.get('from_date')).toBe('2026-11-01');
    expect(req.request.params.get('to_date')).toBe('2026-11-11');
    req.flush({ message: { data: [{ name: 'LIQ-TEST' }], total: 41, status_counts: { ALL: 41, Anulada: 2 } } });
    expect(value.message.has_next).toBeFalse();
    expect(value.message.status_counts).toEqual({ ALL: 41, Anulada: 2 });
  });

  it('reads detail and setup via the purchase-specific authenticated GET endpoints', () => {
    service.getDetail('LIQ-TEST').subscribe((value) => expect(value.name).toBe('LIQ-TEST'));
    const detail = http.expectOne((request) => request.url.endsWith('.get_lite_purchase_settlement_detail'));
    expect(detail.request.params.get('name')).toBe('LIQ-TEST');
    expect(detail.request.params.get('business')).toBe('BUS-TEST');
    detail.flush({ message: { data: { name: 'LIQ-TEST' } } });
    service.getSetup().subscribe((value) => expect(value.withholding_agent).toBeTrue());
    const setup = http.expectOne((request) => request.url.endsWith('.get_purchase_settlement_setup'));
    expect(setup.request.method).toBe('GET');
    expect(setup.request.context.get(REQUIRE_AUTH)).toBeTrue();
    setup.flush({ message: { data: { withholding_agent: true } } });
  });

  it('posts draft input without inventing computed taxes or fiscal identity', () => {
    service.saveDraft(payload).subscribe((value) => expect(value.name).toBe('LIQ-TEST'));
    const req = http.expectOne((request) => request.url.endsWith('.create_lite_purchase_settlement'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ business: 'BUS-TEST', payload });
    expect(req.request.context.get(REQUIRE_AUTH)).toBeTrue();
    req.flush({ message: { data: { name: 'LIQ-TEST' } } });
  });

  it('normalizes create-and-emit authorization using the shared lifecycle', () => {
    service.createAndEmit(payload).subscribe((result) => {
      expect(result.state).toBe('AUTHORIZED');
      expect(result.invoiceName).toBe('LIQ-TEST');
    });
    const req = http.expectOne((request) => request.url.endsWith('.create_and_emit_lite_purchase_settlement'));
    expect(req.request.body).toEqual({ business: 'BUS-TEST', payload });
    req.flush({ message: { data: { name: 'LIQ-TEST' }, emission: { ok: true, code: 'SRI_AUTHORIZED' } } });
  });

  for (const [action, method] of [
    ['emitDraft', 'emit_lite_purchase_settlement'],
    ['refreshStatus', 'refresh_lite_purchase_settlement_status'],
    ['retry', 'retry_lite_purchase_settlement'],
  ] as const) {
    it(`posts ${action} with settlement_name and business`, () => {
      service[action]('LIQ-TEST').subscribe((result) => expect(result.state).toBe('PROCESSING'));
      const req = http.expectOne((request) => request.url.endsWith(`.${method}`));
      expect(req.request.method).toBe('POST');
      expect(req.request.context.get(REQUIRE_AUTH)).toBeTrue();
      expect(req.request.body).toEqual({ business: 'BUS-TEST', settlement_name: 'LIQ-TEST' });
      req.flush({ message: { data: { name: 'LIQ-TEST' }, emission: { ok: true, code: 'SRI_RECEIVED' } } });
    });
  }

  it('records prior SRI annulment by POST with explicit confirmation', () => {
    service
      .registerSriAnnulment('LIQ-TEST', { date: '2026-11-11', reason: 'Compra duplicada', confirmed: true })
      .subscribe();
    const req = http.expectOne((request) => request.url.endsWith('.register_lite_purchase_settlement_sri_annulment'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      business: 'BUS-TEST',
      settlement_name: 'LIQ-TEST',
      sri_annulment_date: '2026-11-11',
      reason: 'Compra duplicada',
      sri_reference: null,
      confirmed_in_sri: 1,
    });
    req.flush({ message: { data: { name: 'LIQ-TEST', status: 'Anulada' } } });
  });
});
