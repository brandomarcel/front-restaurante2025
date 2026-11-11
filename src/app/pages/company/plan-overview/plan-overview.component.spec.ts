import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { SubscriptionMovement, SubscriptionOverview, SubscriptionService } from 'src/app/services/subscription.service';
import { PlanOverviewComponent } from './plan-overview.component';

describe('PlanOverviewComponent', () => {
  let service: jasmine.SpyObj<SubscriptionService>;
  const data = (): SubscriptionOverview => ({
    has_subscription: true,
    is_active: true,
    days_left: 10,
    end_date: '2026-11-20',
    plan_name: 'Plan ficticio',
    scheduled: null,
    movements: [],
  });

  beforeEach(() => {
    service = jasmine.createSpyObj<SubscriptionService>('SubscriptionService', ['getOverview']);
    service.getOverview.and.returnValue(of(data()));
    TestBed.configureTestingModule({
      providers: [
        { provide: SubscriptionService, useValue: service },
        {
          provide: CompanyCapabilitiesService,
          useValue: {
            activeBusinessId: 'BUS-TEST',
            activeBusiness: { businessname: 'Empresa ficticia' },
            business: { ruc: '1790012345001' },
          },
        },
      ],
    });
  });

  it('warns on expiry days 0, 1 and 30 but not 31, inactive or scheduled plans', () => {
    const fixture = TestBed.createComponent(PlanOverviewComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    for (const days_left of [0, 1, 30]) {
      component.overview = { ...data(), days_left };
      expect(component.expiryNote).toContain(
        days_left === 0 ? 'hoy' : `${days_left} ${days_left === 1 ? 'día' : 'días'}`,
      );
    }
    component.overview = { ...data(), days_left: 31 };
    expect(component.expiryNote).toBeNull();
    component.overview = { ...data(), is_active: false };
    expect(component.expiryNote).toBeNull();
    component.overview = {
      ...data(),
      scheduled: { movement_type: 'Renovación', plan_name: 'Plan nuevo', effective_date: '2026-11-21' },
    };
    expect(component.expiryNote).toBeNull();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Programado:');
  });

  it('collapses history after five entries and shows only positive payment amounts', () => {
    const movements = Array.from(
      { length: 6 },
      (_, index) =>
        ({
          movement_type: 'Renovación',
          status: 'Aplicado',
          plan_name: 'Plan ficticio',
          amount: index === 1 ? 15 : 0,
          used_before: 2,
          max_authorized_documents: 100,
        } as SubscriptionMovement),
    );
    service.getOverview.and.returnValue(of({ ...data(), movements }));
    const fixture = TestBed.createComponent(PlanOverviewComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('ol li').length).toBe(5);
    expect(fixture.nativeElement.querySelectorAll('li > span').length).toBe(1);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('ol li').length).toBe(6);
    expect(fixture.nativeElement.textContent).toContain('Ver menos');
  });

  it('builds a WhatsApp message with business, RUC and plan', () => {
    const fixture = TestBed.createComponent(PlanOverviewComponent);
    fixture.detectChanges();
    const message = new URL(fixture.componentInstance.whatsappUrl).searchParams.get('text') || '';
    expect(message).toContain('Empresa ficticia');
    expect(message).toContain('1790012345001');
    expect(message).toContain('Plan ficticio');
  });

  it('keeps the contact link available when the service fails or there is no plan', () => {
    service.getOverview.and.returnValue(throwError(() => new Error('Simulado')));
    const fixture = TestBed.createComponent(PlanOverviewComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.loading).toBeFalse();
    expect(fixture.componentInstance.overview).toBeNull();
    expect(fixture.nativeElement.querySelector('a').textContent).toContain('Solicitar un plan');
    expect(new URL(fixture.componentInstance.whatsappUrl).searchParams.get('text')).toContain('contratar');
  });
});
