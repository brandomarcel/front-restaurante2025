import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { InvoicesService, SriAnnulmentResult } from 'src/app/services/invoices.service';
import { SriAnnulmentDialogComponent } from './sri-annulment-dialog.component';
import { WithholdingsService } from 'src/app/services/withholdings.service';
import { PurchaseSettlementsService } from 'src/app/services/purchase-settlements.service';

describe('SriAnnulmentDialogComponent', () => {
  let service: jasmine.SpyObj<InvoicesService>;
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 10, 10, 12));
    service = jasmine.createSpyObj<InvoicesService>('InvoicesService', ['registerSriAnnulment']);
    TestBed.configureTestingModule({ providers: [{ provide: InvoicesService, useValue: service }] });
  });
  afterEach(() => jasmine.clock().uninstall());

  for (const [kind, provider, reason, title] of [
    ['withholding', WithholdingsService, 'Retención emitida por duplicado', 'Retención'],
    ['purchase-settlement', PurchaseSettlementsService, 'Liquidación emitida por duplicado', 'Liquidación de compra'],
  ] as const) {
    it(`uses ${kind} texts and its lazily selected service without calling invoices`, () => {
      const register = jasmine.createSpy('registerSriAnnulment').and.returnValue(of({ data: { status: 'Anulada' } }));
      TestBed.overrideProvider(provider, { useValue: { registerSriAnnulment: register } });
      const fixture = TestBed.createComponent(SriAnnulmentDialogComponent);
      fixture.componentRef.setInput('kind', kind);
      fixture.componentRef.setInput('documentName', 'DOC-TEST');
      fixture.componentRef.setInput('documentNumber', '001-001-000000123');
      fixture.detectChanges();
      const component = fixture.componentInstance;
      expect(fixture.nativeElement.textContent).toContain(title);
      expect(fixture.nativeElement.textContent).not.toContain('Inventario');
      expect(component.reasons).toContain(reason);
      component.reason = reason;
      component.confirmed = true;
      component.confirm();
      expect(register).toHaveBeenCalledOnceWith('DOC-TEST', { date: component.today, reason, reference: '', confirmed: true });
      expect(service.registerSriAnnulment).not.toHaveBeenCalled();
    });
  }

  function setup() {
    const fixture = TestBed.createComponent(SriAnnulmentDialogComponent);
    fixture.componentRef.setInput('invoiceName', 'INV-TEST');
    fixture.componentRef.setInput('postingDate', '2026-11-09');
    fixture.detectChanges();
    return fixture;
  }

  it('requires confirmation, a reason and an annulment date in the invoice range', () => {
    const fixture = setup(),
      component = fixture.componentInstance;
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.btn-danger');
    expect(button.disabled).toBeTrue();
    component.reason = 'Factura emitida por duplicado';
    component.confirmed = true;
    expect(component.canConfirm).toBeTrue();
    for (const date of ['', '2026-11-08', '2026-11-11']) {
      component.date = date;
      expect(component.canConfirm).toBeFalse();
    }
    component.date = '2026-11-09';
    component.reason = 'Otro';
    component.detail = ' no ';
    expect(component.canConfirm).toBeFalse();
    component.detail = 'Motivo de prueba';
    fixture.detectChanges();
    expect(button.disabled).toBeFalse();
  });

  it('sends the explicit confirmation and combined reason exactly once while saving', () => {
    const component = setup().componentInstance;
    const result = new Subject<SriAnnulmentResult>();
    service.registerSriAnnulment.and.returnValue(result);
    const emit = spyOn(component.annulled, 'emit');
    const dismissed = spyOn(component.dismissed, 'emit');
    component.reason = 'Error en los datos del cliente';
    component.detail = '  Cliente equivocado  ';
    component.reference = '  REF-TEST  ';
    component.confirmed = true;
    component.confirm();
    component.confirm();
    component.onEscape();
    expect(component.saving).toBeTrue();
    expect(dismissed).not.toHaveBeenCalled();
    expect(service.registerSriAnnulment).toHaveBeenCalledOnceWith('INV-TEST', {
      date: '2026-11-10',
      reason: 'Error en los datos del cliente: Cliente equivocado',
      reference: 'REF-TEST',
      confirmed: true,
    });
    const response = { data: {}, stock_returned: [], stock_skipped: [] } as SriAnnulmentResult;
    result.next(response);
    result.complete();
    expect(component.saving).toBeFalse();
    expect(emit).toHaveBeenCalledOnceWith(response);
  });

  it('shows stock quantities or the source-order explanation', () => {
    const fixture = setup(),
      component = fixture.componentInstance;
    component.overview = {
      allowed: true,
      available: true,
      block_reason: null,
      stock_to_return: [{ item: 'ITEM', item_name: 'Producto ficticio', warehouse: null, quantity: 1.25 }],
    };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Producto ficticio');
    expect(fixture.nativeElement.textContent).toContain('× 1.25');
    component.overview = null;
    component.fromSource = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('la orden o nota de venta, que sigue vigente');
  });

  it('does not call the backend for invalid input and recovers from service errors', () => {
    const component = setup().componentInstance;
    const emit = spyOn(component.annulled, 'emit');
    component.confirm();
    expect(service.registerSriAnnulment).not.toHaveBeenCalled();
    component.confirmed = true;
    component.reason = 'Solicitud del cliente';
    service.registerSriAnnulment.and.returnValue(throwError(() => ({ error: { message: 'Error simulado' } })));
    component.confirm();
    expect(component.saving).toBeFalse();
    expect(emit).not.toHaveBeenCalled();
    service.registerSriAnnulment.and.returnValue(
      of({ data: {}, stock_returned: [], stock_skipped: [] } as SriAnnulmentResult),
    );
    component.confirm();
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
