import { PurchaseSettlementDetailComponent } from './purchase-settlement-detail.component';

describe('Purchase settlement detail actions', () => {
  function detail(settlement: any): PurchaseSettlementDetailComponent {
    const component = Object.create(PurchaseSettlementDetailComponent.prototype);
    component.settlement = settlement;
    component.withholdingAgent = true;
    component.capabilities = { hasPermission: () => true };
    component.router = { navigate: jasmine.createSpy() };
    return component;
  }

  it('offers retention only for an authorized purchase without another retention', () => {
    const component = detail({ name: 'LIQ-TEST', status: 'Autorizada' });
    expect(component.canCreateWithholding).toBeTrue();
    component.withholdingAgent = false;
    expect(component.canCreateWithholding).toBeFalse();
    component.withholdingAgent = true;
    component.settlement.withholding = { name: 'WH-TEST', status: 'Autorizada' };
    expect(component.canCreateWithholding).toBeFalse();
    component.settlement = { name: 'LIQ-TEST', status: 'Anulada' };
    expect(component.canCreateWithholding).toBeFalse();
  });

  it('passes the purchase ID to the retention form instead of emitting directly', () => {
    const component: any = detail({ name: 'LIQ-TEST', status: 'Autorizada' });
    component.crearRetencion();
    expect(component.router.navigate).toHaveBeenCalledOnceWith(['/dashboard/withholdings/new'], {
      queryParams: { liquidacion: 'LIQ-TEST' },
    });
  });

  it('keeps code 70 consultation-only and offers editing solely for drafts', () => {
    const component = detail({
      name: 'LIQ-TEST',
      status: 'Emitida',
      electronic: { provider_status: 'PROCESSING', code: '70' },
    });
    expect(component.canConsult).toBeTrue();
    expect(component.canRetry).toBeFalse();
    expect(component.canEdit).toBeFalse();
    component.settlement.status = 'Borrador';
    expect(component.canEdit).toBeTrue();
  });
});
