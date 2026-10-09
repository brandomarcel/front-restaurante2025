import { FrappeSocketService } from './frappe-socket.service';

describe('Frappe socket subscriptions', () => {
  let service: FrappeSocketService;
  let socket: any;
  beforeEach(() => {
    service = new FrappeSocketService({ run: (fn: () => void) => fn() } as any);
    socket = { connected: true, on: jasmine.createSpy('on'), off: jasmine.createSpy('off'), emit: jasmine.createSpy('emit') };
    (service as any).socket = socket;
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
