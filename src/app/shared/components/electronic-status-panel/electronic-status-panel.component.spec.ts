import { Subject, of, throwError } from 'rxjs';
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

  describe('reenvío con la misma clave', () => {
    let perms: Record<string, boolean>;
    const resendMock = (response: any) => {
      const resendSameKey = jasmine.createSpy('resendSameKey').and.returnValue(response);
      TestBed.configureTestingModule({ imports: [ElectronicStatusPanelComponent], providers: [provideRouter([]),
        { provide: CompanyCapabilitiesService, useValue: { activeBusinessId: 'FBU-1', hasPermission: (p: string) => !!perms[p] } },
        { provide: ElectronicReviewService, useValue: { resendSameKey } },
        { provide: ElectronicDocumentUpdatesService, useValue: updates }] });
      return resendSameKey;
    };
    const render = (resend: any) => {
      const fixture = TestBed.createComponent(ElectronicStatusPanelComponent);
      fixture.componentRef.setInput('document', { ...panel.document, modified: '2026-10-09 10:00:00',
        electronic: { ...panel.document.electronic, resend_same_key: resend } });
      fixture.detectChanges();
      return fixture;
    };
    const available = { available: true, reason: '', available_at: null, attempts: 1, max_attempts: 3 };
    beforeEach(() => { perms = { 'billing.resend': true }; });
    it('shows the button only when available and permitted', () => {
      resendMock(of({}));
      let fixture = render(available);
      expect(fixture.nativeElement.textContent).toContain('Reenviar al SRI (misma clave)');
      expect(fixture.nativeElement.textContent).toContain('Reenvíos: 1 de 3');
      fixture.destroy();
      fixture = render(undefined);
      expect(fixture.nativeElement.textContent).not.toContain('Reenviar al SRI');
      fixture.destroy();
      perms['billing.resend'] = false;
      fixture = render({ ...available, reason: 'x' });
      expect(fixture.nativeElement.textContent).not.toContain('Reenviar al SRI');
      expect(fixture.nativeElement.textContent).not.toContain('Reenvío con la misma clave');
      fixture.destroy();
    });
    it('shows the reason as a note when unavailable', () => {
      resendMock(of({}));
      const fixture = render({ available: false, reason: 'Disponible desde las 17:40', attempts: 0, max_attempts: 3 });
      expect(fixture.nativeElement.textContent).toContain('Reenvío con la misma clave: Disponible desde las 17:40');
      expect(fixture.nativeElement.textContent).not.toContain('Reenviar al SRI (misma clave)');
      fixture.destroy();
    });
    it('sends the payload and emits the updated invoice', () => {
      const spy = resendMock(of({ message: { resent: true, data: { name: 'FLINV-1' } } }));
      spyOn(window, 'confirm').and.returnValue(true);
      const fixture = render(available);
      const component = fixture.componentInstance;
      const updated = jasmine.createSpy('updated');
      component.updated.subscribe(updated);
      component.resendReason = ' Sin recepción ';
      component.resendSameKey();
      expect(spy).toHaveBeenCalledWith('FLINV-1', 'Sin recepción', 'FBU-1', '2026-10-09 10:00:00');
      expect(updated).toHaveBeenCalledWith({ name: 'FLINV-1' });
      fixture.destroy();
    });
    it('does not send without reason and handles resent false', () => {
      const spy = resendMock(of({ message: { resent: false, message: 'Ya autorizada', data: { name: 'FLINV-1' } } }));
      spyOn(window, 'confirm').and.returnValue(true);
      const fixture = render(available);
      const component = fixture.componentInstance;
      component.resendSameKey();
      expect(spy).not.toHaveBeenCalled();
      const updated = jasmine.createSpy('updated');
      component.updated.subscribe(updated);
      component.resendReason = 'Motivo';
      component.resendSameKey();
      expect(spy).toHaveBeenCalled();
      expect(updated).toHaveBeenCalledWith({ name: 'FLINV-1' });
      expect(component.busy).toBeFalse();
      fixture.destroy();
    });
    it('handles 403 without emitting', () => {
      resendMock(throwError(() => ({ status: 403 })));
      spyOn(window, 'confirm').and.returnValue(true);
      const fixture = render(available);
      const component = fixture.componentInstance;
      const updated = jasmine.createSpy('updated');
      component.updated.subscribe(updated);
      component.resendReason = 'Motivo';
      component.resendSameKey();
      expect(updated).not.toHaveBeenCalled();
      expect(component.busy).toBeFalse();
      fixture.destroy();
    });
  });
});
