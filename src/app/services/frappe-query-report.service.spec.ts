import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { FrappeQueryReportService } from './frappe-query-report.service';
import { CajasService } from './cajas.service';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { FrappeErrorService } from '../core/services/frappe-error.service';

describe('Report HTTP contracts', () => {
  let http: HttpTestingController;
  let reports: FrappeQueryReportService;
  let cash: CajasService;
  let capabilities: any;
  beforeEach(() => {
    capabilities = { activeBusinessId: 'ACTIVE', reportScope: 'global', hasPermission: () => true, isEnabled: () => true };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: CompanyCapabilitiesService, useValue: capabilities },
      { provide: FrappeErrorService, useValue: { handle: () => 'Error' } }] });
    http = TestBed.inject(HttpTestingController);
    reports = TestBed.inject(FrappeQueryReportService);
    cash = TestBed.inject(CajasService);
  });
  afterEach(() => http.verify());

  it('always queries the selected business with session credentials', () => {
    reports.run('FacturADA Lite Ventas', { business: 'OTHER', company: 'legacy', status: '' }).subscribe();
    const request = http.expectOne(req => req.url.includes('query_report.run'));
    const url = new URL(request.request.url, 'http://localhost');
    expect(JSON.parse(url.searchParams.get('filters')!)).toEqual({ business: 'ACTIVE' });
    expect(request.request.withCredentials).toBeTrue();
    request.flush({ message: { columns: [], result: [] } });
  });

  it('exports all rows using the selected business', () => {
    reports.exportExcel('FacturADA Lite Ventas', { business: 'OTHER' }).subscribe();
    const request = http.expectOne(req => req.url.includes('export_query'));
    const body: FormData = request.request.body;
    expect(body.get('visible_idx')).toBe('[]');
    expect(JSON.parse(String(body.get('filters')))).toEqual({ business: 'ACTIVE' });
    expect(body.get('applied_filters')).toBe(body.get('filters'));
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob());
  });

  it('supplies all required parameters for native cash Excel export', () => {
    cash.exportCashClosingsReport({ status: 'Confirmado' }).subscribe();
    const request = http.expectOne(req => req.url.includes('export_query'));
    expect(JSON.parse(request.request.body.visible_idx)).toEqual([]);
    expect(JSON.parse(request.request.body.applied_filters).business).toBe('ACTIVE');
    expect(request.request.withCredentials).toBeTrue();
    request.flush(new Blob());
  });

  it('rejects queries and cash exports without reports permission', () => {
    capabilities.hasPermission = (permission: string) => permission === 'billing.manage';
    let errors = 0;
    reports.run('FacturADA Lite Ventas', {}).subscribe({ error: () => errors++ });
    cash.exportCashClosingsReport().subscribe({ error: () => errors++ });
    expect(errors).toBe(2);
    http.expectNone(req => req.url.includes('query_report'));
  });
});
