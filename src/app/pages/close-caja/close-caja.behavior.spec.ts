import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { of } from 'rxjs';
import { CajaAbiertaGuard } from 'src/app/core/guards/caja-abierta.guard';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { CajasService } from 'src/app/services/cajas.service';
import { CloseCajaComponent } from './close-caja.component';

/** Caracterización del cierre de caja. */
describe('Caja — cierre', () => {
  let fixture: ComponentFixture<CloseCajaComponent>;
  let component: CloseCajaComponent;
  let cajas: any;
  let guard: any;
  let alert: any;

  function setup(datos: any, metrics: any = null, canOperate = true): void {
    localStorage.setItem('user', JSON.stringify({ email: 'ana@x.com' }));
    cajas = {
      getDatosCierre: jasmine.createSpy('datos').and.returnValue(of({ message: datos })),
      getDashboardMetrics: jasmine.createSpy('metrics').and.returnValue(of({ message: { data: { cash: metrics } } })),
      create_cierre_de_caja: jasmine.createSpy('create').and.returnValue(of({ message: { data: { status: 'Cerrada', cash_counted: 120 } } }))
    };
    guard = { invalidateCache: jasmine.createSpy('invalidate') };
    alert = { success: jasmine.createSpy('success'), error: jasmine.createSpy('error'), confirm: jasmine.createSpy('confirm').and.returnValue(Promise.resolve({ isConfirmed: true })) };
    TestBed.configureTestingModule({
      imports: [CloseCajaComponent],
      providers: [
        provideRouter([]),
        { provide: CajasService, useValue: cajas },
        { provide: AlertService, useValue: alert },
        { provide: NgxSpinnerService, useValue: { show: () => undefined, hide: () => undefined } },
        { provide: CompanyCapabilitiesService, useValue: { isEnabled: () => canOperate, hasPermission: () => canOperate } },
        { provide: CajaAbiertaGuard, useValue: guard }
      ]
    });
    fixture = TestBed.createComponent(CloseCajaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const datosTurno = {
    apertura: { name: 'AP-1', status: 'Abierta' },
    opening_amount: 50,
    total_withdrawals: 10,
    payment_totals: [
      { payment_method: 'Efectivo', payment_code: '01', amount: 80 },
      { payment_method: 'Tarjeta de credito/debito', payment_code: '19', amount: 30 }
    ]
  };

  afterEach(() => localStorage.removeItem('user'));

  it('sin permiso de caja no consulta', () => {
    setup(datosTurno, null, false);
    expect(cajas.getDatosCierre).not.toHaveBeenCalled();
  });

  it('esperado = apertura + ventas en efectivo − retiros cuando el backend no lo envía', () => {
    setup(datosTurno);
    expect(component.totalEsperado).toBe(120);
    expect(component.cierre.diferencia).toBe(-120);
  });

  it('usa el efectivo esperado del backend cuando existe', () => {
    setup(datosTurno, { expected_cash: 115 });
    expect(component.totalEsperado).toBe(115);
  });

  it('el efectivo empieza en 0 para contarlo y los demás métodos con lo del sistema', () => {
    setup(datosTurno);
    expect(component.paymentCount('01')).toBe(0);
    expect(component.paymentCount('19')).toBe(30);
    expect(component.paymentMethodsForCount.map((p) => p.payment_code)).toEqual(['01', '19', '20']);
  });

  it('la diferencia se recalcula al contar el efectivo', () => {
    setup(datosTurno);
    component.onPaymentCountChange('01', 118);
    expect(component.cierre.efectivo_real).toBe(118);
    expect(component.cierre.diferencia).toBe(-2);
    expect(component.paymentDifference('01')).toBe(38);
  });

  it('pide confirmación, envía lo contado por método e invalida el guard', async () => {
    setup(datosTurno);
    component.onPaymentCountChange('01', 120);
    component.cierre.observaciones = ' ok ';
    component.guardarCierre();
    await fixture.whenStable();
    expect(alert.confirm).toHaveBeenCalled();
    expect(cajas.create_cierre_de_caja).toHaveBeenCalledWith({
      cash_opening: 'AP-1',
      cash_counted: 120,
      payments: [
        { payment_method: 'Efectivo', payment_code: '01', counted_amount: 120 },
        { payment_method: 'Tarjeta de credito/debito', payment_code: '19', counted_amount: 30 },
        { payment_method: 'Transferencia', payment_code: '20', counted_amount: 0 }
      ],
      notes: 'ok'
    });
    expect(guard.invalidateCache).toHaveBeenCalled();
    expect(component.sinApertura).toBeTrue();
    expect(component.lastClose?.status).toBe('Cerrada');
  });

  it('sin apertura activa no deja cerrar', () => {
    setup({ apertura: { name: 'AP-1', status: 'Cerrada' } });
    expect(component.sinApertura).toBeTrue();
    expect(component.canSave).toBeFalse();
  });
});

describe('Caja — cierre, conteo por billetes', () => {
  it('el conteo por billetes y monedas llena el efectivo contado', () => {
    localStorage.setItem('user', JSON.stringify({ email: 'ana@x.com' }));
    TestBed.configureTestingModule({
      imports: [CloseCajaComponent],
      providers: [
        provideRouter([]),
        { provide: CajasService, useValue: {
          getDatosCierre: () => of({ message: { apertura: { name: 'AP-1', status: 'Abierta' }, opening_amount: 20, payment_totals: [{ payment_method: 'Efectivo', payment_code: '01', amount: 25.75 }] } }),
          getDashboardMetrics: () => of({ message: { data: { cash: null } } })
        } },
        { provide: AlertService, useValue: { success: () => undefined, error: () => undefined, confirm: () => Promise.resolve({ isConfirmed: false }) } },
        { provide: NgxSpinnerService, useValue: { show: () => undefined, hide: () => undefined } },
        { provide: CompanyCapabilitiesService, useValue: { isEnabled: () => true, hasPermission: () => true } },
        { provide: CajaAbiertaGuard, useValue: { invalidateCache: () => undefined } }
      ]
    });
    const fixture = TestBed.createComponent(CloseCajaComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    component.onDenominationChange(2, 2);   // 2 × $20
    component.stepDenomination(4, 1);       // 1 × $5
    component.onDenominationChange(7, 1);   // 1 × 50¢
    component.onDenominationChange(8, 1);   // 1 × 25¢
    expect(component.cierre.efectivo_real).toBe(45.75);
    expect(component.differenceKind).toBe('even');
    component.onDenominationChange(2, 1);
    expect(component.differenceKind).toBe('short');
    component.clearDenominations();
    expect(component.cierre.efectivo_real).toBe(0);
    localStorage.removeItem('user');
  });
});
