import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { InvoicesService } from './invoices.service';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';

describe('InvoicesService (FacturADA Lite)', () => {
  let service: InvoicesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InvoicesService,
        FrappeErrorService,
        { provide: CompanyCapabilitiesService, useValue: { isLiteMode: true, businessId: 'FBU-00001' } },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(InvoicesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the Lite payload using posting_date, item and payment_method', () => {
    service.create_and_emit_from_ui_v2({
      customer: 'FLC-1', posting_date: '2026-09-02',
      items: [{ item_code: 'FLI-1', qty: 1, rate: 10, tax_rate: 15 }],
      payments: [{ formas_de_pago: 'PAY-1', monto: 11.5 }]
    }).subscribe();
    const req = http.expectOne((request) => request.url.includes('create_and_emit_from_ui_v2'));
    expect(req.request.body.items[0].item).toBe('FLI-1');
    expect(req.request.body.payments[0]).toEqual({ payment_method: 'PAY-1', payment_code: '', amount: 11.5 });
    req.flush({ message: { emission: { ok: true, code: 'SRI_AUTHORIZED' }, data: { name: 'FLINV-1' } } });
  });

  it('normalizes authorized, processing and rejected results', () => {
    const results: any[] = [];
    service.create_and_emit_from_ui_v2({}).subscribe((value) => results.push(value));
    http.expectOne((request) => request.url.includes('create_and_emit_from_ui_v2'))
      .flush({ message: { emission: { ok: true, code: 'SRI_AUTHORIZED' }, data: { name: 'A' } } });
    service.refreshLiteInvoiceStatus('A').subscribe((value) => results.push(value));
    http.expectOne((request) => request.url.includes('refresh_lite_invoice_status'))
      .flush({ message: { emission: { ok: true, code: 'SRI_RECEIVED' }, data: { name: 'A' } } });
    service.retryLiteInvoice('A').subscribe((value) => results.push(value));
    http.expectOne((request) => request.url.includes('retry_lite_invoice'))
      .flush({ message: { emission: { ok: false, code: 'SRI_REJECTED', messages: ['Uno', 'Dos'] }, data: { name: 'A' } } });
    expect(results.map((value) => value.state)).toEqual(['AUTHORIZED', 'PROCESSING', 'REJECTED']);
    expect(results[2].messages).toEqual(['Uno', 'Dos']);
  });

  it('keeps provider HTTP errors as observable errors and supports reissue', () => {
    let error: any;
    service.retryLiteInvoice('A').subscribe({ error: (value) => error = value });
    http.expectOne((request) => request.url.includes('retry_lite_invoice'))
      .flush({ message: 'validation' }, { status: 400, statusText: 'Bad Request' });
    expect(error instanceof HttpErrorResponse).toBeTrue();

    service.reissueLiteInvoice('A', '2026-09-02').subscribe();
    const req = http.expectOne((request) => request.url.includes('reissue_lite_invoice'));
    expect(req.request.body).toEqual({ invoice_name: 'A', posting_date: '2026-09-02', business: 'FBU-00001' });
    req.flush({ message: { emission: { ok: true, code: 'SRI_RECEIVED' }, data: { name: 'B' } } });
  });

  it('uses invoice_name when loading a Lite detail', () => {
    service.getInvoiceDetail('FLINV-1').subscribe();
    const req = http.expectOne((request) => request.url.includes('get_lite_invoice_detail'));
    expect(req.request.params.get('name')).toBe('FLINV-1');
    req.flush({ message: { data: { name: 'FLINV-1' } } });
  });

  it('sends the Lite invoice email request with the invoice name', () => {
    service.sendLiteInvoiceEmail('FLINV-1').subscribe();
    const req = http.expectOne((request) => request.url.includes('send_lite_invoice_email'));
    expect(req.request.body).toEqual({ invoice_name: 'FLINV-1' });
    req.flush({ message: { data: { email: { status: 'Enviado' } } } });
  });

  it('maps the current Lite list/detail field names and Autorizada status', () => {
    service.getAllInvoices(10, 0).subscribe((result: any) => {
      expect(result.data[0].status).toBe('AUTORIZADO');
      expect(result.data[0].customer.fullName).toBe('CONSUMIDOR FINAL');
      expect(result.data[0].total).toBe(11.5);
    });
    http.expectOne((request) => request.url.includes('get_all_invoices')).flush({
      message: { data: [{ name: 'FLINV-50', posting_date: '2026-09-02', status: 'Autorizada', customer_name: 'CONSUMIDOR FINAL', grand_total: 11.5 }] }
    });

    service.getInvoiceDetail('FLINV-50').subscribe((invoice: any) => {
      expect(invoice.sri.status).toBe('AUTORIZADO');
      expect(invoice.sri.access_key).toBe('KEY');
      expect(invoice.customer.fullName).toBe('CONSUMIDOR FINAL');
      expect(invoice.items[0].quantity).toBe(1);
      expect(invoice.items[0].total).toBe(11.5);
    });
    http.expectOne((request) => request.url.includes('get_lite_invoice_detail')).flush({
      data: {
        name: 'FLINV-50', status: 'Autorizada',
        customer: { name: 'FLC-1', customer_name: 'CONSUMIDOR FINAL', identification_number: '9999999999999' },
        items: [{ item: 'FLI-1', item_name: 'Servicio Demo', qty: 1, rate: 10, tax_rate: 15, taxable_amount: 10, total_amount: 11.5 }],
        totals: { total_without_tax: 10, total_taxes: 1.5, grand_total: 11.5 },
        electronic: { provider_status: 'AUTHORIZED', access_key: 'KEY' }
      }
    });
  });
});
