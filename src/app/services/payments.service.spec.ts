import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PaymentsService } from './payments.service';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';

describe('PaymentsService.getAll', () => {
  let service: PaymentsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PaymentsService,
        { provide: CompanyCapabilitiesService, useValue: { activeBusinessId: 'FBU-1', businessId: 'FBU-1' } },
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(PaymentsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function load(rows: any[]): any[] {
    let result: any[] = [];
    service.getAll().subscribe((value) => (result = value));
    http.expectOne((req) => req.url.includes('get_payments')).flush({ message: rows });
    return result;
  }

  it('usa codigo_sri como codigo y conserva name y descripción', () => {
    const [cheque] = load([{ name: 'CHECK', nombre: 'Cheque', codigo_sri: '20' }]);
    expect(cheque.codigo).toBe('20');
    expect(cheque.name).toBe('CHECK');
    expect(cheque.description).toBe('Cheque');
  });

  it('sin codigo_sri mantiene el comportamiento previo', () => {
    const rows = load([
      { name: 'CASH', nombre: 'Efectivo', codigo: '01' },
      { name: 'X', nombre: 'Equis', forma_pago: '19' },
      { name: 'Y', nombre: 'Ye' }
    ]);
    expect(rows[0].codigo).toBe('01');
    expect(rows[1].codigo).toBe('19');
    expect(rows[2].codigo).toBe('Y');
  });
});
