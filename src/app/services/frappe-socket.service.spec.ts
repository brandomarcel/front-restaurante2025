import { FrappeSocketService } from './frappe-socket.service';

describe('Frappe socket subscriptions', () => {
  let service: FrappeSocketService;
  let socket: any;
  let storedSite: string | null;
  beforeEach(() => {
    storedSite = localStorage.getItem('facturada.frappe_site');
    service = new FrappeSocketService({ run: (fn: () => void) => fn() } as any);
    socket = { connected: true, on: jasmine.createSpy('on'), off: jasmine.createSpy('off'), emit: jasmine.createSpy('emit') };
    (service as any).socket = socket;
  });
  afterEach(() => {
    if (storedSite === null) localStorage.removeItem('facturada.frappe_site');
    else localStorage.setItem('facturada.frappe_site', storedSite);
  });

  it('stores a cleaned site without opening a socket when there is no current instance', () => {
    (service as any).socket = undefined;
    const connect = spyOn(service, 'connect');
    service.setSite(' /tenant-test/ ');
    expect(localStorage.getItem('facturada.frappe_site')).toBe('tenant-test');
    expect(connect).not.toHaveBeenCalled();
    service.setSite('');
    expect(localStorage.getItem('facturada.frappe_site')).toBe('tenant-test');
  });

  it('does not disconnect or reconnect when the backend repeats the same site', () => {
    (service as any).site = 'tenant-test';
    socket.removeAllListeners = jasmine.createSpy();
    socket.disconnect = jasmine.createSpy();
    const connect = spyOn(service, 'connect');
    service.setSite('/tenant-test/');
    expect(socket.disconnect).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it('discards the previous active socket but preserves listener, room and document subscriptions', () => {
    socket.active = true;
    socket.removeAllListeners = jasmine.createSpy();
    socket.disconnect = jasmine.createSpy();
    const connect = spyOn(service, 'connect');
    service.on('updated', jasmine.createSpy('handler'));
    service.subscribe('business:BUS-TEST');
    service.subscribeDocument('FacturADA Lite Invoice', 'INV-TEST');
    const oldListeners = (service as any).listeners;
    service.setSite('another-tenant-test');
    expect(socket.removeAllListeners).toHaveBeenCalledTimes(1);
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledTimes(1);
    expect((service as any).listeners).toBe(oldListeners);
    expect((service as any).rooms.has('business:BUS-TEST')).toBeTrue();
    expect((service as any).documents.get('FacturADA Lite Invoice/INV-TEST').subscribers).toBe(1);
  });

  it('keeps an explicitly inactive socket inactive when the site changes', () => {
    socket.active = false;
    socket.removeAllListeners = jasmine.createSpy();
    socket.disconnect = jasmine.createSpy();
    const connect = spyOn(service, 'connect');
    service.setSite('inactive-tenant-test');
    expect(socket.disconnect).toHaveBeenCalledTimes(1);
    expect(connect).not.toHaveBeenCalled();
  });
  it('removes the actual zone-wrapped listener and preserves other consumers', () => {
    const first = jasmine.createSpy('first');
    const second = jasmine.createSpy('second');
    service.on('updated', first);
    const wrapped = socket.on.calls.mostRecent().args[1];
    service.on('updated', first);
    expect(socket.on).toHaveBeenCalledTimes(1);
    service.on('updated', second);
    wrapped({ name: 'FLINV-1' });
    expect(first).toHaveBeenCalledWith({ name: 'FLINV-1' });
    service.off('updated', first);
    expect(socket.off).toHaveBeenCalledWith('updated', wrapped);
    expect(socket.off).not.toHaveBeenCalledWith('updated');
  });
  it('keeps a document room until its last consumer leaves', () => {
    service.subscribeDocument('FacturADA Lite Invoice', 'FLINV-1');
    service.subscribeDocument('FacturADA Lite Invoice', 'FLINV-1');
    expect(socket.emit).toHaveBeenCalledTimes(1);
    expect(socket.emit).toHaveBeenCalledWith('doc_subscribe', 'FacturADA Lite Invoice', 'FLINV-1');
    service.unsubscribeDocument('FacturADA Lite Invoice', 'FLINV-1');
    expect(socket.emit).toHaveBeenCalledTimes(1);
    service.unsubscribeDocument('FacturADA Lite Invoice', 'FLINV-1');
    expect(socket.emit).toHaveBeenCalledWith('doc_unsubscribe', 'FacturADA Lite Invoice', 'FLINV-1');
  });
});
