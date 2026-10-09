import { Subject } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ElectronicStatusPanelComponent } from './electronic-status-panel.component';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { ElectronicReviewService } from 'src/app/services/electronic-review.service';
import { ElectronicDocumentUpdatesService } from 'src/app/services/electronic-document-updates.service';

describe('Electronic status panel', () => {
  let panel: ElectronicStatusPanelComponent;
  let changes: Subject<any>;
  let updates: any;
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-09T04:30:00Z'));
    changes = new Subject();
    updates = { watch: jasmine.createSpy('watch').and.returnValue(changes) };
    panel = new ElectronicStatusPanelComponent({ activeBusinessId: 'FBU-1', hasPermission: () => true } as any,
      {} as any, updates);
    panel.document = { name: 'FLINV-1', business: 'FBU-1', status: 'Emitida', posting_date: '2026-10-07', electronic: {
      access_key: 'key', automatic_query_active: '1', manual_review_required: '0'
    } };
  });
  afterEach(() => { panel.ngOnDestroy(); jasmine.clock().uninstall(); });
  it('never offers emission review or scheduling for a replaced original with old fields', () => {
    panel.document.regenerated_invoice = 'FLINV-NEW';
    panel.document.electronic.manual_review_required = '1';
    panel.ngOnChanges();
    expect(panel.replacement).toBe('FLINV-NEW');
    expect(panel.reviewRequired).toBeFalse();
    expect(panel.canVerify).toBeFalse();
    expect(panel.canRegenerate).toBeFalse();
    expect(panel.automaticQueryActive).toBeFalse();
    expect(updates.watch).not.toHaveBeenCalled();
  });
  it('preserves the subscription when local document state changes and cleans up on exit', () => {
    panel.ngOnChanges();
    const updated = jasmine.createSpy('updated');
    panel.updated.subscribe(updated);
    panel.document = { ...panel.document, status: 'Autorizada' };
    panel.ngOnChanges();
    expect(updates.watch).toHaveBeenCalledTimes(1);
    changes.next(panel.document);
    expect(updated).toHaveBeenCalledWith(panel.document);
    panel.ngOnDestroy();
    updated.calls.reset();
    changes.next(panel.document);
    expect(updated).not.toHaveBeenCalled();
  });
  it('normalizes backend flags without assuming reception or authorization', () => {
    expect(panel.automaticQueryActive).toBeTrue();
    expect(panel.reception).toBe('No informado');
    expect(panel.authorization).toBe('No informado');
    panel.document.electronic.automatic_query_active = '0';
    expect(panel.automaticQueryActive).toBeFalse();
  });
  it('renders the replacement link and hides electronic review actions for a closed original', () => {
    TestBed.configureTestingModule({ imports: [ElectronicStatusPanelComponent], providers: [provideRouter([]),
      { provide: CompanyCapabilitiesService, useValue: { activeBusinessId: 'FBU-1', hasPermission: () => true } },
      { provide: ElectronicReviewService, useValue: {} },
      { provide: ElectronicDocumentUpdatesService, useValue: updates }] });
    const fixture = TestBed.createComponent(ElectronicStatusPanelComponent);
    fixture.componentRef.setInput('document', { ...panel.document, regenerated_invoice: 'FLINV-NEW',
      electronic: { ...panel.document.electronic, manual_review_required: 1 } });
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/dashboard/invoices/FLINV-NEW');
    expect(element.textContent).toContain('Abrir factura reemplazante');
    expect(element.textContent).not.toContain('Registrar revisión SRI');
    expect(element.textContent).not.toContain('Consulta automática programada');
    fixture.destroy();
  });
  it('uses Ecuador calendar days and hides manual actions until the following day', () => {
    panel.document.posting_date = '2026-10-08';
    panel.document.electronic.manual_review_required = 1;
    expect(panel.manualReviewAvailable).toBeFalse();
    expect(panel.canVerify).toBeFalse();
    panel.reason = 'Revisado';
    const confirm = jasmine.createSpy('confirm');
    (panel as any).service = { confirm };
    panel.confirmReview();
    expect(confirm).not.toHaveBeenCalled();
    jasmine.clock().mockDate(new Date('2026-10-09T05:00:00Z'));
    expect(panel.manualReviewAvailable).toBeTrue();
    expect(panel.canVerify).toBeTrue();
    panel.document.posting_date = '2026-10-10';
    expect(panel.manualReviewAvailable).toBeFalse();
  });

  it('honors backend availability and preserves SRI messages while hiding manual review notices', () => {
    panel.document.electronic.manual_review_available = false;
    panel.document.electronic.messages = ['Revisión manual requerida', 'Comprobante recibido por SRI'];
    expect(panel.manualReviewAvailable).toBeFalse();
    expect(panel.messages).not.toContain('Revisión manual requerida');
    expect(panel.messages).toContain('Comprobante recibido por SRI');
    panel.document.electronic.manual_review_available = 1;
    expect(panel.manualReviewAvailable).toBeTrue();
    expect(panel.messages).toContain('Revisión manual requerida');
  });

  it('keeps guide review behavior independent of invoice dates', () => {
    panel.kind = 'guide';
    panel.document.posting_date = '2026-10-08';
    expect(panel.manualReviewAvailable).toBeTrue();
  });

  it('renders manual review notices only when the backend enables review', () => {
    TestBed.configureTestingModule({ imports: [ElectronicStatusPanelComponent], providers: [provideRouter([]),
      { provide: CompanyCapabilitiesService, useValue: { activeBusinessId: 'FBU-1', hasPermission: () => true } },
      { provide: ElectronicReviewService, useValue: {} },
      { provide: ElectronicDocumentUpdatesService, useValue: updates }] });
    const fixture = TestBed.createComponent(ElectronicStatusPanelComponent);
    fixture.componentRef.setInput('document', { ...panel.document, electronic: {
      ...panel.document.electronic, manual_review_required: 1, manual_review_available: false
    } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Registrar revisión SRI');
    expect(fixture.nativeElement.textContent).not.toContain('Revisión manual requerida.');
    fixture.componentRef.setInput('document', { ...panel.document, electronic: {
      ...panel.document.electronic, manual_review_required: 1, manual_review_available: true
    } });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Registrar revisión SRI');
    expect(fixture.nativeElement.textContent).toContain('Revisión manual requerida.');
    fixture.destroy();
  });

});
