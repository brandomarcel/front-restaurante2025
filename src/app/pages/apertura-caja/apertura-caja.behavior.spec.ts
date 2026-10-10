import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { of } from 'rxjs';
import { CajaAbiertaGuard } from 'src/app/core/guards/caja-abierta.guard';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { CajasService } from 'src/app/services/cajas.service';
import { AperturaCajaComponent } from './apertura-caja.component';

/** Caracterización de la apertura de caja. */
describe('Caja — apertura', () => {
  let fixture: ComponentFixture<AperturaCajaComponent>;
  let component: AperturaCajaComponent;
  let cajas: any;
  let guard: any;
  let capabilities: any;
  const t1 = { name: 'T1', terminal_name: 'Caja 1' };
  const t2 = { name: 'T2', terminal_name: 'Caja 2' };

  function setup(opts: { opening?: any; terminals?: any[]; usesTerminals?: boolean; active?: any } = {}): void {
    localStorage.setItem('user', JSON.stringify({ email: 'ana@x.com' }));
    cajas = {
      verificarAperturaActiva: jasmine.createSpy('verificar').and.returnValue(of({ message: { apertura: opts.opening ?? null } })),
      getDashboardMetrics: jasmine.createSpy('metrics').and.returnValue(of({ message: { data: { cash: { opening_amount: 50 } } } })),
      create_apertura_de_caja: jasmine.createSpy('create').and.returnValue(of({}))
    };
    guard = { invalidateCache: jasmine.createSpy('invalidate') };
    capabilities = {
      usesPosTerminalModel: opts.usesTerminals ?? false,
      activePosTerminals: opts.terminals ?? [],
      activePosTerminal: opts.active ?? null,
      setActivePosTerminal: jasmine.createSpy('setActive').and.returnValue(true),
      isEnabled: () => true,
      hasPermission: () => true
    };
    TestBed.configureTestingModule({
      imports: [AperturaCajaComponent],
      providers: [
        provideRouter([]),
        { provide: CajasService, useValue: cajas },
        { provide: AlertService, useValue: { success: jasmine.createSpy('success'), error: jasmine.createSpy('error'), confirm: () => Promise.resolve({ isConfirmed: true }) } },
        { provide: NgxSpinnerService, useValue: { show: () => undefined, hide: () => undefined } },
        { provide: CompanyCapabilitiesService, useValue: capabilities },
        { provide: CajaAbiertaGuard, useValue: guard }
      ]
    });
    fixture = TestBed.createComponent(AperturaCajaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => localStorage.removeItem('user'));

  it('consulta la apertura del usuario de la sesión', () => {
    setup();
    expect(cajas.verificarAperturaActiva).toHaveBeenCalledWith('ana@x.com');
    expect(component.cajaActiva).toBeFalse();
  });

  it('el monto de apertura debe ser mayor a cero', () => {
    setup();
    component.apertura.monto_apertura = 0;
    expect(component.canSubmit).toBeFalse();
    component.apertura.monto_apertura = 20;
    expect(component.canSubmit).toBeTrue();
  });

  it('abre caja con monto, nota y terminal, e invalida la caché del guard', () => {
    setup({ usesTerminals: true, terminals: [t1], active: t1 });
    component.apertura.monto_apertura = 100;
    component.apertura.observacion = '  turno mañana ';
    component.abrirCaja();
    expect(cajas.create_apertura_de_caja).toHaveBeenCalledWith({ opening_amount: 100, notes: 'turno mañana', pos_terminal: 'T1' });
    expect(guard.invalidateCache).toHaveBeenCalled();
    expect(cajas.verificarAperturaActiva).toHaveBeenCalledTimes(2);
  });

  it('con varias terminales exige elegir una', () => {
    setup({ usesTerminals: true, terminals: [t1, t2] });
    component.apertura.monto_apertura = 100;
    expect(component.needsTerminalSelection).toBeTrue();
    expect(component.canSubmit).toBeFalse();
    component.onTerminalChange('T2');
    expect(capabilities.setActivePosTerminal).toHaveBeenCalledWith(t2);
    expect(component.canSubmit).toBeTrue();
  });

  it('sin terminales configuradas no permite abrir', () => {
    setup({ usesTerminals: true, terminals: [] });
    component.apertura.monto_apertura = 100;
    expect(component.needsTerminalConfiguration).toBeTrue();
    expect(component.canSubmit).toBeFalse();
  });

  it('con una caja abierta no permite abrir otra y muestra sus métricas', () => {
    setup({ opening: { name: 'AP-1', status: 'Abierta' } });
    component.apertura.monto_apertura = 100;
    expect(component.cajaActiva).toBeTrue();
    expect(component.canSubmit).toBeFalse();
    expect(component.cashMetrics?.opening_amount).toBe(50);
  });
});
