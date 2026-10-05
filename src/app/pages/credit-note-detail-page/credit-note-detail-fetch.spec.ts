import { of, throwError } from 'rxjs';
import { CreditNoteDetailPageComponent } from './credit-note-detail-page.component';

describe('Credit note detail loading', () => {
  let component: CreditNoteDetailPageComponent;
  let invoices: jasmine.SpyObj<any>;
  beforeEach(() => {
    invoices = jasmine.createSpyObj('InvoicesService', ['getLiteCreditNoteDetail']);
    component = new CreditNoteDetailPageComponent({} as any, {} as any, invoices, {} as any, { isLiteMode: false } as any);
  });
  it('uses normalized Lite detail even when the business operates as restaurant', () => {
    const document = { name: 'FLINV-1', status: 'En Revision', electronic: { authorization_status: 'UNKNOWN' } };
    invoices.getLiteCreditNoteDetail.and.returnValue(of(document));
    component.fetch('FLINV-1');
    expect(invoices.getLiteCreditNoteDetail).toHaveBeenCalledWith('FLINV-1');
    expect(component.invoice).toBe(document);
    expect(component.loading).toBeFalse();
  });
  it('clears the previous document and shows permission errors', () => {
    component.invoice = { name: 'previous' };
    invoices.getLiteCreditNoteDetail.and.returnValue(throwError(() => ({ status: 403 })));
    component.fetch('FLINV-1');
    expect(component.invoice).toBeNull();
    expect(component.error).toContain('No tienes permiso');
    expect(component.loading).toBeFalse();
  });
  it('does not query without a document name', () => {
    component.fetch('');
    expect(invoices.getLiteCreditNoteDetail).not.toHaveBeenCalled();
    expect(component.error).toBe('Nota de crédito no encontrada');
    expect(component.loading).toBeFalse();
  });
  it('allows consultation but not retry while processing in a restaurant business', () => {
    (component.capabilities as any).hasPermission = (permission: string) => permission === 'billing.manage';
    component.invoice = { name: 'FLINV-1', status: 'Emitida', electronic: { provider_status: 'PROCESSING' } };
    component.loading = false;
    expect(component.canConsultAuthorization).toBeTrue();
    expect(component.canRetry).toBeFalse();
  });
  it('keeps consultation unavailable without billing.manage', () => {
    (component.capabilities as any).hasPermission = () => false;
    component.invoice = { name: 'FLINV-1', status: 'En Revision' };
    component.loading = false;
    expect(component.canConsultAuthorization).toBeFalse();
  });
});
