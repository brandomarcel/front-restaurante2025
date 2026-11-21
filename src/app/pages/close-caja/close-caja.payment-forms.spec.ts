import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { of } from 'rxjs';
import { CajaAbiertaGuard } from 'src/app/core/guards/caja-abierta.guard';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { CajasService } from 'src/app/services/cajas.service';
import { CloseCajaComponent } from './close-caja.component';

describe('Cierre de caja — formas de pago 01/16/19/20', () => {
  let c: any;

  beforeEach(() => {
    localStorage.setItem('user', JSON.stringify({ email: 'ana@x.com' }));
    TestBed.configureTestingModule({
      imports: [CloseCajaComponent],
      providers: [
        provideRouter([]),
        { provide: CajasService, useValue: {
          getDatosCierre: () => of({ message: {} }),
          getDashboardMetrics: () => of({ message: { data: { cash: null } } }),
          create_cierre_de_caja: () => of({ message: {} })
        } },
        { provide: AlertService, useValue: { success: () => undefined, error: () => undefined, confirm: () => Promise.resolve({ isConfirmed: true }) } },
        { provide: NgxSpinnerService, useValue: { show: () => undefined, hide: () => undefined } },
        { provide: CompanyCapabilitiesService, useValue: { isEnabled: () => false, hasPermission: () => false } },
        { provide: CajaAbiertaGuard, useValue: { invalidateCache: () => undefined } }
      ]
    });
    c = TestBed.createComponent(CloseCajaComponent).componentInstance;
  });

  afterEach(() => localStorage.removeItem('user'));

  it('sin cobros: cuatro renglones con sus etiquetas', () => {
    c.paymentTotals = [];
    const rows = c.buildPaymentMethodsForCount();
    expect(rows.map((r: any) => r.payment_code)).toEqual(['01', '16', '19', '20']);
    expect(rows.map((r: any) => r.payment_method)).toEqual(['Efectivo', 'Tarjeta de débito', 'Tarjeta de crédito', 'Transferencia, depósito o cheque']);
  });

  it('transferencia y cheque se agrupan en un solo renglón 20 que suma 15', () => {
    c.paymentTotals = [
      { payment_method: 'Transferencia bancaria', payment_code: '20', amount: 10 },
      { payment_method: 'Cheque', payment_code: '20', amount: 5 }
    ];
    const rows = c.buildPaymentMethodsForCount();
    const r20 = rows.filter((r: any) => r.payment_code === '20');
    expect(r20.length).toBe(1);
    expect(r20[0].payment_method).toBe('Transferencia, depósito o cheque');
    expect(c.paymentAmount('20')).toBe(15);
  });

  it('normalizePaymentTotals deduce el código por el nombre', () => {
    const code = (name: string) => c.normalizePaymentTotals({ payment_totals: [{ payment_method: name, amount: 1 }] })[0].payment_code;
    expect(code('Tarjeta de débito')).toBe('16');
    expect(code('Tarjeta de debito')).toBe('16');
    expect(code('Cheque')).toBe('20');
    expect(code('Transferencia bancaria')).toBe('20');
    expect(code('Tarjeta de credito')).toBe('19');
  });
});
