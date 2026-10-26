import { TestBed } from '@angular/core/testing';
import { CompanyCapabilitiesService } from './company-capabilities.service';
import { UtilsService } from './utils.service';

describe('CompanyCapabilitiesService: contexto del negocio', () => {
  let service: CompanyCapabilitiesService;
  let previousStorage: Record<string, string>;

  beforeEach(() => {
    previousStorage = Object.fromEntries(Object.keys(localStorage).map(key => [key, localStorage.getItem(key)!]));
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [
      { provide: UtilsService, useValue: jasmine.createSpyObj('UtilsService', ['cambiarAmbiente']) }
    ] });
    service = TestBed.inject(CompanyCapabilitiesService);
  });

  afterEach(() => {
    localStorage.clear();
    Object.entries(previousStorage).forEach(([key, value]) => localStorage.setItem(key, value));
  });

  function context(overrides: Record<string, any> = {}): any {
    return { business: { name: 'TEST-BUSINESS', pos_experience: 'General' },
      features: { billing: true, direct_invoice: true }, business_role: 'Facturacion',
      permissions: ['billing.read'], ...overrides };
  }

  it('acepta contexto directo y envoltorios Frappe sin perder permisos', () => {
    for (const response of [context(), { message: context() }, { message: { data: context() } }]) {
      service.setFromResponse(response);
      expect(service.activeBusinessId).toBe('TEST-BUSINESS');
      expect(service.isEnabled('direct_invoice')).toBeTrue();
      expect(service.hasPermission('billing.read')).toBeTrue();
      expect(service.hasPermission('billing.create')).toBeFalse();
    }
  });

  it('no concede permisos ausentes después de cargar el contexto', () => {
    service.setFromResponse({ message: context({ permissions: null, business_role: 'Administrador' }) });
    expect(service.isLoaded).toBeTrue();
    expect(service.hasPermission('billing.create')).toBeFalse();
  });

  it('distingue permiso de lectura, creación y recursos con tres segmentos', () => {
    service.setFromResponse(context({ permissions: ['restaurant.orders.read', 'billing.read'] }));
    expect(service.hasPermission('restaurant.orders.read')).toBeTrue();
    expect(service.hasPermission('restaurant.orders.create')).toBeFalse();
    expect(service.hasPermission('direct_invoice.read')).toBeTrue();
    expect(service.hasPermission('credit_note.create')).toBeFalse();
  });

  it('normaliza permisos agrupados y banderas falsas', () => {
    service.setFromResponse(context({ permissions: { products: { read: '1', create: '0' } } }));
    expect(service.hasPermission('products.read')).toBeTrue();
    expect(service.hasPermission('products.create')).toBeFalse();
    expect(service.hasPermission('inventory.read')).toBeFalse();
  });

  it('un permiso comodín no activa módulos fuera del plan', () => {
    service.setFromResponse(context({ permissions: ['*'], features: { billing: true, inventory: false } }));
    expect(service.hasPermission('inventory.read')).toBeTrue();
    expect(service.can('inventory.read', 'inventory')).toBeFalse();
  });

  it('Retail es presentación y no habilita restaurante, caja ni inventario', () => {
    service.setFromResponse(context({ business: { name: 'TEST-BUSINESS', pos_experience: 'Retail' },
      features: { pos: true, generic_pos: true, restaurant: false, cash_register: false, inventory: false } }));
    expect(service.isRetailPos).toBeTrue();
    expect(service.isEnabled('restaurant')).toBeFalse();
    expect(service.isEnabled('cash_register')).toBeFalse();
    expect(service.isEnabled('inventory')).toBeFalse();
  });

  it('una bandera de mesas no reemplaza la licencia de restaurante', () => {
    service.setFromResponse(context({ features: { billing: true, restaurant: false, tables: true, kitchen: true } }));
    expect(service.isEnabled('tables')).toBeFalse();
    expect(service.isEnabled('kitchen')).toBeFalse();
  });

  it('oculta operación local en un negocio API-only', () => {
    service.setFromResponse(context({ features: { api: true, billing: false, products: true, customers: true } }));
    expect(service.isApiOnlyMode).toBeTrue();
    expect(service.isEnabled('products')).toBeFalse();
    expect(service.isEnabled('customers')).toBeFalse();
  });

  it('no conserva secretos de la configuración API en memoria ni almacenamiento', () => {
    service.setFromResponse(context({ api_configuration: { enabled: true,
      clients: [{ name: 'TEST-CLIENT', api_key: 'PUBLIC-TEST-KEY', secret_key: 'DO-NOT-PERSIST', password: 'DO-NOT-PERSIST' }]
    } }));
    expect(service.apiConfiguration.clients[0].api_key).toBe('PUBLIC-TEST-KEY');
    expect(JSON.stringify(service.apiConfiguration)).not.toContain('DO-NOT-PERSIST');
    expect(localStorage.getItem('company_capabilities')).not.toContain('DO-NOT-PERSIST');
  });

  it('no publica clientes API cuando el backend niega su visualización', () => {
    service.setFromResponse(context({ api_configuration: { enabled: true, can_view: false,
      clients: [{ name: 'HIDDEN-CLIENT', api_key: 'HIDDEN-KEY' }] } }));
    expect(service.apiConfiguration.clients).toEqual([]);
  });

  describe('requisitos compartidos de emisión', () => {
    function ready(overrides: Record<string, any> = {}): void {
      service.setFromResponse(context({ ready: true,
        tax_profile: { certificate_status: 'VIGENTE' },
        plan: { status: 'ACTIVO', unlimited_documents: true },
        permissions: ['billing.create'], ...overrides }));
    }

    it('permite emitir cuando configuración, certificado, plan y permiso están listos', () => {
      ready();
      expect(service.getEmissionBlockMessage({ feature: 'direct_invoice' })).toBeNull();
    });

    it('bloquea configuración incompleta aunque el plan y el certificado estén vigentes', () => {
      ready({ ready: false, missing: ['invoice_sequence'] });
      expect(service.getEmissionBlockMessage()).toContain('secuencia de factura');
    });

    for (const status of ['VENCIDO', 'NO VIGENTE', 'NO CONFIGURADO', 'ERROR DE LECTURA']) {
      it(`bloquea emisión con certificado ${status}`, () => {
        ready({ tax_profile: { certificate_status: status } });
        expect(service.getEmissionBlockMessage()).not.toBeNull();
      });
    }

    it('bloquea un plan suspendido aunque tenga cupo ilimitado', () => {
      ready({ plan: { status: 'SUSPENDIDO', unlimited_documents: true } });
      expect(service.getEmissionBlockMessage()).toContain('no está activo');
    });

    it('bloquea cupo agotado y permite el último comprobante disponible', () => {
      ready({ plan: { status: 'ACTIVO', remaining_authorized_documents: 0 } });
      expect(service.getEmissionBlockMessage()).toContain('No quedan comprobantes');
      ready({ plan: { status: 'ACTIVO', remaining_authorized_documents: 1 } });
      expect(service.getEmissionBlockMessage()).toBeNull();
    });

    it('el rol administrativo no reemplaza el permiso de emisión', () => {
      ready({ business_role: 'Administrador', permissions: ['billing.read'] });
      expect(service.getEmissionBlockMessage()).toContain('No tiene permisos');
    });
  });
});
