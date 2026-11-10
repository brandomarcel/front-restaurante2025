import { HttpClient } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { PrintService } from './print.service';
import { PrintStationService, PrintStationSettings } from './print-station.service';

const SETTINGS = 'facturada.printstation';
const keys = [SETTINGS, 'facturada.printstation.printed', 'facturada.printstation.device'];
const target: PrintStationSettings = { enabled: true, mode: 'network', host: '192.0.2.10', port: 9100, printer: '', autoPrint: true, plainText: false, deviceName: 'Equipo de pruebas' };

describe('PrintStationService: estación local de cocina', () => {
  let stored: (string | null)[], http: jasmine.SpyObj<HttpClient>;
  let canBill = true, canKitchen = false;
  const create = () => new PrintStationService(http, {
    activeBusinessId: 'B-TEST', isEnabled: () => true,
    hasPermission: (permission: string) => permission === 'restaurant.orders.read' || (permission === 'billing.create' && canBill) || (permission === 'restaurant.orders.update' && canKitchen),
  } as any as CompanyCapabilitiesService, new FrappeErrorService(), { openComanda: () => true } as any as PrintService);
  beforeEach(() => {
    stored = keys.map(key => localStorage.getItem(key)); keys.forEach(key => localStorage.removeItem(key));
    canBill = true; canKitchen = false;
    http = jasmine.createSpyObj('HttpClient', ['get', 'post']); http.post.and.returnValue(of({}));
  });
  afterEach(() => keys.forEach((key, i) => stored[i] === null ? localStorage.removeItem(key) : localStorage.setItem(key, stored[i]!)));

  it('mesero no puede ser estación; cajero y cocina sí', () => {
    const service = create(); expect(service.available).toBeTrue();
    canBill = false; expect(service.available).toBeFalse();
    canKitchen = true; expect(service.available).toBeTrue();
  });
  it('valida nombre de impresora o host y puerto RAW', () => {
    const service = create(); expect(service.isValidTarget(target)).toBeTrue();
    for (const port of [0, 65536, 1.5]) expect(service.isValidTarget({ ...target, port })).toBeFalse();
    expect(service.isValidTarget({ ...target, host: 'http://invalid/path' })).toBeFalse();
    expect(service.isValidTarget({ ...target, mode: 'printer', printer: '  USB Cocina  ' })).toBeTrue();
    expect(service.isValidTarget({ ...target, mode: 'printer', printer: ' ' })).toBeFalse();
  });
  it('Normal no activa QZ aunque haya destino guardado', () => {
    localStorage.setItem(SETTINGS, JSON.stringify({ ...target, enabled: false }));
    const service = create(); expect(service.configured).toBeFalse(); expect(service.autoPrintActive).toBeFalse();
  });
  it('configuración anterior sin enabled conserva directo si tenía impresora', () => {
    const previous: Partial<PrintStationSettings> = { ...target }; delete previous.enabled;
    localStorage.setItem(SETTINGS, JSON.stringify(previous));
    expect(create().configured).toBeTrue();
  });
  it('tolera preferencias dañadas sin abrir conexiones', () => {
    localStorage.setItem(SETTINGS, '{broken'); const service = create();
    expect(service.configured).toBeFalse(); expect(service.status()).toBe('idle'); expect(http.get).not.toHaveBeenCalled();
  });
  it('sin impresora usa el fallback sin intentar imprimir por QZ', () => {
    const service = create(), fallback = jasmine.createSpy('fallback');
    const print = spyOn(service, 'printKitchenTicket').and.resolveTo();
    service.printComanda('ORDER-TEST', false, fallback);
    expect(fallback).toHaveBeenCalledTimes(1); expect(print).not.toHaveBeenCalled();
  });
  it('pedido o lote se imprime una sola vez entre dos instancias del equipo', async () => {
    localStorage.setItem(SETTINGS, JSON.stringify(target));
    const first = create(), second = create();
    const a = spyOn(first, 'printKitchenTicket').and.resolveTo();
    const b = spyOn(second, 'printKitchenTicket').and.resolveTo();
    const results = await Promise.all([first.autoPrint('ORDER-TEST', false, 'ORDER-TEST:new', 'Caja'), second.autoPrint('ORDER-TEST', false, 'ORDER-TEST:new', 'Cocina')]);
    expect(results.filter(Boolean).length).toBe(1); expect(a.calls.count() + b.calls.count()).toBe(1);
    expect(await first.autoPrint('ORDER-TEST', true, 'ORDER-TEST:batch-2', 'Caja')).toBeTrue();
    expect(a.calls.count() + b.calls.count()).toBe(2);
  });
  it('guardar limpia datos y reporta al Desk sin que un fallo del reporte impida guardar', () => {
    const service = create(); http.post.and.returnValue(throwError(() => new Error('Reporte simulado')));
    expect(() => service.saveSettings({ ...target, host: ' 192.0.2.10 ', deviceName: ' PC de prueba ' })).not.toThrow();
    expect(service.settings().host).toBe('192.0.2.10'); expect(service.settings().deviceName).toBe('PC de prueba');
    expect(JSON.parse(localStorage.getItem(SETTINGS)!).enabled).toBeTrue();
    const body = http.post.calls.mostRecent().args[1] as any;
    expect(body.business).toBe('B-TEST'); expect(body.event).toBe('config'); expect(body.device_id).toMatch(/^[A-Za-z0-9-]{8,64}$/);
  });
});
