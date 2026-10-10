import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { CajasService } from 'src/app/services/cajas.service';
import { CashManagementComponent } from './cash-management.component';

/** Caracterización de Gestión de cajas. */
describe('Caja — gestión', () => {
  let fixture: ComponentFixture<CashManagementComponent>;
  let component: CashManagementComponent;
  let cajas: any;

  function setup(canView = true): void {
    cajas = {
      getCashRegisterHistory: jasmine.createSpy('history').and.returnValue(of({ message: { data: {
        openings: [
          { name: 'AP-1', user: 'ana@x.com', status: 'Abierta', opened_at: '2026-10-01 08:00:00', opening_amount: 50 },
          { name: 'AP-2', user: 'luis@x.com', status: 'Cerrada', opened_at: '2026-10-05 08:00:00', opening_amount: 30 }
        ],
        withdrawals: [{ name: 'R1', user: 'ana@x.com', status: 'Confirmado', posted_at: '2026-10-01 10:00:00', amount: 10 }],
        closings: [{ name: 'CI-1', user: 'luis@x.com', status: 'Cerrada', closed_at: '2026-10-05 18:00:00', difference: -2 }],
        summary: { total_openings: 2, open_openings: 1, accumulated_difference: -2 }
      } } }))
    };
    TestBed.configureTestingModule({
      imports: [CashManagementComponent],
      providers: [
        provideRouter([]),
        { provide: CajasService, useValue: cajas },
        { provide: AlertService, useValue: { error: jasmine.createSpy('error') } },
        { provide: CompanyCapabilitiesService, useValue: { isEnabled: () => canView, hasPermission: () => canView } }
      ]
    });
    fixture = TestBed.createComponent(CashManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('sin permiso no consulta el historial', () => {
    setup(false);
    expect(cajas.getCashRegisterHistory).not.toHaveBeenCalled();
  });

  it('carga aperturas, retiros, cierres y resumen', () => {
    setup();
    expect(component.openings.length).toBe(2);
    expect(component.countSummary('total_openings')).toBe(2);
    expect(component.moneySummary('accumulated_difference')).toBe(-2);
  });

  it('filtra por usuario, estado y fechas', () => {
    setup();
    component.filters.user = 'ANA';
    expect(component.visibleOpenings.map((r) => r.name)).toEqual(['AP-1']);
    component.clearFilters();
    component.filters.status = 'Cerrada';
    expect(component.visibleOpenings.map((r) => r.name)).toEqual(['AP-2']);
    component.clearFilters();
    component.filters.fromDate = '2026-10-03';
    expect(component.visibleOpenings.map((r) => r.name)).toEqual(['AP-2']);
    component.filters.toDate = '2026-10-04';
    expect(component.visibleOpenings.length).toBe(0);
  });

  it('recarga cuando llega el evento de cambios en tiempo real', () => {
    setup();
    window.dispatchEvent(new Event('facturada:restaurant-data-changed'));
    expect(cajas.getCashRegisterHistory).toHaveBeenCalledTimes(2);
    fixture.destroy();
  });

  it('ofrece los usuarios y estados reales, y limpia un estado que no existe en la otra pestaña', () => {
    setup();
    expect(component.userOptions).toEqual(['ana@x.com', 'luis@x.com']);
    expect(component.statusOptions).toEqual(['Abierta', 'Cerrada']);
    component.filters.status = 'Abierta';
    component.setTab('withdrawals');
    expect(component.statusOptions).toEqual(['Confirmado']);
    expect(component.filters.status).toBe('');
  });
});
