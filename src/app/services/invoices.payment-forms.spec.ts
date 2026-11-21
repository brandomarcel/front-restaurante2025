import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { InvoicesService } from './invoices.service';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';

describe('InvoicesService.normalizeLitePayment — formas de pago', () => {
  let norm: (method: any, code: any) => { payment_method: string; payment_code: string };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InvoicesService,
        FrappeErrorService,
        { provide: CompanyCapabilitiesService, useValue: { isLiteMode: true, businessId: 'FBU-1' } },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    const service = TestBed.inject(InvoicesService) as any;
    norm = (m, c) => service.normalizeLitePayment(m, c);
  });

  it('mapea cada forma a su método y código SRI', () => {
    expect(norm('CHECK', '20')).toEqual({ payment_method: 'CHECK', payment_code: '20' });
    expect(norm('Cheque', '')).toEqual({ payment_method: 'CHECK', payment_code: '20' });
    expect(norm('DEBIT_CARD', '16')).toEqual({ payment_method: 'DEBIT_CARD', payment_code: '16' });
    expect(norm('', '16')).toEqual({ payment_method: 'DEBIT_CARD', payment_code: '16' });
    expect(norm('CARD', '19')).toEqual({ payment_method: 'CARD', payment_code: '19' });
    expect(norm('Tarjeta de credito/debito', '')).toEqual({ payment_method: 'CARD', payment_code: '19' });
    expect(norm('TRANSFER', '20')).toEqual({ payment_method: 'TRANSFER', payment_code: '20' });
    expect(norm('CASH', '01')).toEqual({ payment_method: 'CASH', payment_code: '01' });
  });
});
