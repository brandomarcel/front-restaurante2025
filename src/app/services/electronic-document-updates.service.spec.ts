import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { ElectronicDocumentUpdatesService } from './electronic-document-updates.service';
import { FrappeSocketService } from './frappe-socket.service';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';

describe('Electronic document realtime reads', () => {
  let service: ElectronicDocumentUpdatesService;
  let http: HttpTestingController;
  let capabilities: { activeBusinessId: string };
  let connected: BehaviorSubject<boolean>;
  let handlers: Map<string, (event: any) => void>;
  let socket: any;
  beforeEach(() => {
    capabilities = { activeBusinessId: 'FBU-1' };
    connected = new BehaviorSubject(false);
    handlers = new Map();
    socket = {
      connected$: connected.asObservable(), connect: jasmine.createSpy('connect'),
      subscribeDocument: jasmine.createSpy('subscribeDocument'),
      unsubscribeDocument: jasmine.createSpy('unsubscribeDocument'),
      on: (event: string, handler: (data: any) => void) => handlers.set(event, handler),
      off: (event: string) => handlers.delete(event)
    };
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: FrappeSocketService, useValue: socket },
      { provide: CompanyCapabilitiesService, useValue: capabilities }] });
    service = TestBed.inject(ElectronicDocumentUpdatesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  const notification = { doctype: 'FacturADA Lite Invoice', name: 'FLINV-1', business: 'FBU-1' };
  it('only reads local state for matching document events and releases listeners', () => {
    const updated = jasmine.createSpy('updated');
    const subscription = service.watch('FLINV-1', 'FBU-1', false).subscribe(updated);
    const handler = handlers.get('facturada_electronic_status_updated')!;
    handler({ ...notification, business: 'FBU-2' });
    handler({ ...notification, name: 'FLINV-2' });
    handler({ ...notification, doctype: 'FacturADA Lite Remission Guide' });
    http.expectNone(() => true);
    handler(notification);
    const request = http.expectOne(req => req.url.endsWith('.get_lite_invoice_detail'));
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('name')).toBe('FLINV-1');
    expect(request.request.params.get('business')).toBe('FBU-1');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.context.get(REQUIRE_AUTH)).toBeTrue();
    const document = { name: 'FLINV-1', business: 'FBU-1', status: 'Autorizada' };
    request.flush({ message: { data: document } });
    expect(updated).toHaveBeenCalledWith(document);
    subscription.unsubscribe();
    expect(handlers.size).toBe(0);
    expect(socket.unsubscribeDocument).toHaveBeenCalledWith('FacturADA Lite Invoice', 'FLINV-1');
  });
  it('discards a late response and stops reads after changing business', () => {
    const updated = jasmine.createSpy('updated');
    const subscription = service.watch('FLINV-1', 'FBU-1', false).subscribe(updated);
    const handler = handlers.get('facturada_electronic_review_required')!;
    handler(notification);
    const request = http.expectOne(() => true);
    capabilities.activeBusinessId = 'FBU-2';
    request.flush({ message: { data: { name: 'FLINV-1', business: 'FBU-1' } } });
    expect(updated).not.toHaveBeenCalled();
    handler(notification);
    http.expectNone(() => true);
    subscription.unsubscribe();
  });
  it('does not lose a terminal update while an earlier read is in progress', () => {
    const updated = jasmine.createSpy('updated');
    const subscription = service.watch('FLINV-1', 'FBU-1', false).subscribe(updated);
    handlers.get('facturada_electronic_status_updated')!(notification);
    const first = http.expectOne(() => true);
    handlers.get('facturada_electronic_review_required')!(notification);
    http.expectNone(() => true);
    first.flush({ message: { data: { name: 'FLINV-1', business: 'FBU-1', status: 'Emitida' } } });
    http.expectOne(() => true).flush({ message: { data: { name: 'FLINV-1', business: 'FBU-1', status: 'Autorizada' } } });
    expect(updated.calls.mostRecent().args[0].status).toBe('Autorizada');
    subscription.unsubscribe();
  });
  it('reads guides on reconnection and keeps listening after a failed local read', () => {
    const updated = jasmine.createSpy('updated');
    const subscription = service.watch('FLRG-1', 'FBU-1', true).subscribe(updated);
    connected.next(true);
    const first = http.expectOne(req => req.url.endsWith('.get_lite_remission_guide_detail'));
    first.flush({}, { status: 503, statusText: 'Unavailable' });
    expect(updated).not.toHaveBeenCalled();
    connected.next(false);
    connected.next(true);
    http.expectOne(req => req.url.endsWith('.get_lite_remission_guide_detail'))
      .flush({ message: { data: { name: 'FLRG-1', business: 'FBU-1' } } });
    expect(updated).toHaveBeenCalledWith({ name: 'FLRG-1', business: 'FBU-1' });
    subscription.unsubscribe();
  });
});
