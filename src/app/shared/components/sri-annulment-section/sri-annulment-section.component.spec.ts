import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { InvoicesService } from 'src/app/services/invoices.service';
import { SriAnnulmentDialogComponent } from '../sri-annulment-dialog/sri-annulment-dialog.component';
import { SriAnnulmentSectionComponent } from './sri-annulment-section.component';

describe('SriAnnulmentSectionComponent', () => {
  function create(status = 'Autorizada', allowed = true, available = true) {
    TestBed.configureTestingModule({ providers: [{ provide: InvoicesService, useValue: {} }] });
    const fixture = TestBed.createComponent(SriAnnulmentSectionComponent);
    fixture.componentRef.setInput('kind', 'withholding');
    fixture.componentRef.setInput('mode', 'action');
    fixture.componentRef.setInput('document', {
      name: 'WH-TEST',
      status,
      sri_annulment: { allowed, available, block_reason: 'Bloqueo de prueba' },
    });
    fixture.detectChanges();
    return fixture;
  }

  it('only exposes the action for an authorized document and backend-allowed role', () => {
    const fixture = create('Borrador');
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
    fixture.componentRef.setInput('document', {
      status: 'Autorizada',
      sri_annulment: { allowed: false, available: true },
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('section')).toBeNull();
  });

  it('shows the backend block reason without an annulment button', () => {
    const fixture = create('Autorizada', true, false);
    expect(fixture.nativeElement.textContent).toContain('Bloqueo de prueba');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('passes kind/name into the shared dialog and closes after the result', () => {
    const fixture = create();
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    const dialog = fixture.debugElement.query(By.directive(SriAnnulmentDialogComponent)).componentInstance;
    expect(dialog.kind).toBe('withholding');
    expect(dialog.documentName).toBe('WH-TEST');
    const changed = spyOn(fixture.componentInstance.annulled, 'emit');
    dialog.annulled.emit({ data: {} });
    fixture.detectChanges();
    expect(changed).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('app-sri-annulment-dialog')).toBeNull();
  });

  it('renders liquidation annulment audit data as a banner', () => {
    const fixture = create('Anulada');
    fixture.componentRef.setInput('kind', 'purchase-settlement');
    fixture.componentRef.setInput('mode', 'banner');
    fixture.componentRef.setInput('document', {
      status: 'Anulada',
      sri_annulment_date: '2026-11-11',
      annulled_at: '2026-11-11 09:30:00',
      annulled_by_name: 'Responsable ficticio',
      annulment_reason: 'Compra duplicada',
      sri_annulment_reference: 'REF-TEST',
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
      'Liquidación anulada en el SRI',
    );
    for (const text of ['11/11/2026', 'Responsable ficticio', 'Compra duplicada', 'REF-TEST'])
      expect(fixture.nativeElement.textContent).toContain(text);
  });
});
