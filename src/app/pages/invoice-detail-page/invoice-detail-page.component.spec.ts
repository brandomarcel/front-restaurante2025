import { InvoiceDetailPageComponent } from './invoice-detail-page.component';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { InvoicesService } from 'src/app/services/invoices.service';
import { PrintService } from 'src/app/services/print.service';
import { CreditNoteService } from 'src/app/services/credit-note.service';
import { PaymentsService } from 'src/app/services/payments.service';
import { InvoiceCollectionsService } from 'src/app/services/invoice-collections.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

describe('Invoice detail cancellation', () => {
  function detail(invoice: any): InvoiceDetailPageComponent {
    const component = Object.create(InvoiceDetailPageComponent.prototype);
    component.invoice = invoice;
    component.capabilities = { isLiteMode: true, hasPermission: () => true };
    return component;
  }

  it('blocks collections, email and another full cancellation while preserving the credit-note history', () => {
    const component = detail({ status: 'Autorizada', credit_note_summary: {
      state: 'FULL', documents: [{ name: 'NC-1', status: 'Autorizada' }]
    } });
    expect(component.isCancelled).toBeTrue();
    expect(component.canManageCollections).toBeFalse();
    expect(component.canSendEmail).toBeFalse();
    expect(component.canAnnul).toBeFalse();
    expect(component.canRetryLite).toBeFalse();
    expect(component.relatedCreditNotes[0].name).toBe('NC-1');
  });

  it('keeps a partially credited invoice distinct from a complete cancellation', () => {
    const component = detail({ status: 'Autorizada', credit_note_summary: { state: 'PARTIAL' } });
    expect(component.isCancelled).toBeFalse();
    expect(component.canAnnul).toBeFalse();
    expect(component.annulBlockReason).toContain('notas de crédito relacionadas');
  });

  it('renders the cancellation notice and a link to the related credit note in the real template', () => {
    spyOn(InvoiceDetailPageComponent.prototype, 'ngOnInit');
    TestBed.configureTestingModule({
      imports: [InvoiceDetailPageComponent],
      providers: [provideRouter([]), provideNoopAnimations(), provideHttpClient(), provideHttpClientTesting(),
        ...[InvoicesService, PrintService, CreditNoteService, PaymentsService, InvoiceCollectionsService]
          .map(provide => ({ provide, useValue: {} })),
        { provide: CompanyCapabilitiesService, useValue: {
          isLiteMode: true, hasPermission: () => true, isEnabled: () => true,
          validateFeatureUse: () => ({ allowed: true }), liteSetupMissing: []
        } }
      ]
    });
    TestBed.inject(FaIconLibrary).addIconPacks(fas);
    const fixture = TestBed.createComponent(InvoiceDetailPageComponent);
    fixture.componentInstance.invoice = { name: 'INV-CANCELLED', status: 'Autorizada',
      document_type: 'Factura', total: 115, customer: {}, items: [], payments: [],
      credit_note_summary: { state: 'FULL', documents: [{ name: 'NC-1', status: 'Autorizada', grand_total: 115 }] } };
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Factura anulada');
    expect(fixture.nativeElement.querySelector('a[href="/dashboard/credit-note/NC-1"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Anular factura con nota de crédito');
  });
});
