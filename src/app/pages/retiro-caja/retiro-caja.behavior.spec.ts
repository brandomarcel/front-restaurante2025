import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { CajasService } from 'src/app/services/cajas.service';
import { RetiroCajaComponent } from './retiro-caja.component';

/** Caracterización de los retiros de caja. */
describe('Caja — retiros', () => {
  let fixture: ComponentFixture<RetiroCajaComponent>;
  let component: RetiroCajaComponent;
  let cajas: any;

  function setup(opening: any = { name: 'AP-1', status: 'Abierta' }): void {
    localStorage.setItem('user', JSON.stringify({ email: 'ana@x.com' }));
    cajas = {
      verificarAperturaActiva: jasmine.createSpy('verificar').and.returnValue(of({ message: { apertura: opening, opening_amount: 40 } })),
      getDashboardMetrics: jasmine.createSpy('metrics').and.returnValue(of({ message: { data: { cash: { expected_cash: 90 } } } })),
      getCashWithdrawals: jasmine.createSpy('withdrawals').and.returnValue(of({ message: { data: [
        { name: 'R1', cash_opening: 'AP-1', amount: 10, reason: 'Hielo' },
        { name: 'R2', cash_opening: 'AP-OTRA', amount: 99 },
        { name: 'R3', cash_opening: { name: 'AP-1' }, amount: 5.5 }
      ] } })),
      create_retiro_de_caja: jasmine.createSpy('create').and.returnValue(of({}))
    };
    TestBed.configureTestingModule({
      imports: [RetiroCajaComponent],
      providers: [
        provideRouter([]),
        { provide: CajasService, useValue: cajas },
        { provide: AlertService, useValue: { success: jasmine.createSpy('success'), error: jasmine.createSpy('error'), confirm: () => Promise.resolve({ isConfirmed: true }) } },
        { provide: CompanyCapabilitiesService, useValue: { isEnabled: () => true, hasPermission: () => true } }
      ]
    });
    fixture = TestBed.createComponent(RetiroCajaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => localStorage.removeItem('user'));

  it('solo muestra los retiros de la apertura del usuario', () => {
    setup();
    expect(component.retiros.map((r) => r.name)).toEqual(['R1', 'R3']);
    expect(component.totalRetiros).toBe(15.5);
    expect(component.montoApertura).toBe(40);
    expect(component.efectivoSistema).toBe(90);
  });

  it('exige monto y motivo', () => {
    setup();
    component.retiro.monto = 5;
    expect(component.canSubmit).toBeFalse();
    component.retiro.motivo = 'Compra de pan';
    expect(component.canSubmit).toBeTrue();
  });

  it('registra el retiro contra la apertura activa y limpia el formulario', async () => {
    setup();
    component.retiro.monto = 12.5;
    component.retiro.motivo = '  Compra de pan ';
    component.registrarRetiro();
    await fixture.whenStable();
    expect(cajas.create_retiro_de_caja).toHaveBeenCalledWith({ cash_opening: 'AP-1', amount: 12.5, reason: 'Compra de pan' });
    expect(component.retiro.monto).toBe(0);
    expect(component.retiro.motivo).toBe('');
  });

  it('sin caja abierta no permite retirar', () => {
    setup({ name: 'AP-1', status: 'Cerrada' });
    component.retiro.monto = 5;
    component.retiro.motivo = 'x';
    expect(component.cajaActiva).toBeFalse();
    expect(component.canSubmit).toBeFalse();
  });

  it('si no se confirma, no registra el retiro', async () => {
    setup();
    const alert = TestBed.inject(AlertService) as any;
    alert.confirm = () => Promise.resolve({ isConfirmed: false });
    component.retiro.monto = 3;
    component.retiro.motivo = 'x';
    component.registrarRetiro();
    await fixture.whenStable();
    expect(cajas.create_retiro_de_caja).not.toHaveBeenCalled();
    expect(component.saving).toBeFalse();
  });

  it('avisa si se retira más de lo esperado en caja', () => {
    setup();
    component.retiro.monto = 100;
    expect(component.exceedsExpectedCash).toBeTrue();
  });
});
