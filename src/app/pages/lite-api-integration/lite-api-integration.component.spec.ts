import { of, throwError } from 'rxjs';
import { LiteApiIntegrationComponent } from './lite-api-integration.component';

describe('LiteApiIntegrationComponent', () => {
  let stored: any;
  let company: jasmine.SpyObj<any>;
  let component: LiteApiIntegrationComponent;

  beforeEach(() => {
    stored = null;
    company = jasmine.createSpyObj('CompanyService', ['getLiteContext']);
    const capabilities = {
      activeBusinessId: 'BIZ-1',
      get apiConfiguration() { return stored; },
      setApiConfiguration: (value: any) => { stored = value; }
    };
    const menu = jasmine.createSpyObj('MenuService', ['setMenuForRoles']);
    const errors = { handle: () => 'Error del servidor' };
    component = new LiteApiIntegrationComponent(company, capabilities as any, menu, errors as any);
  });

  it('shows the clients of the active business', () => {
    company.getLiteContext.and.returnValue(of({ business: 'BIZ-1', api_configuration: {
      enabled: true, clients: [{ name: 'C1', environment: 'Produccion', status: 'Activo' }, { name: 'C2', environment: 'Pruebas', status: 'Inactivo' }]
    } }));
    component.load();
    expect(component.enabled).toBeTrue();
    expect(component.clients.length).toBe(2);
    expect(component.activeClients).toBe(1);
    expect(component.productionClients).toBe(1);
  });

  it('ignores a late response that belongs to another business', () => {
    company.getLiteContext.and.returnValue(of({ business: 'BIZ-2', api_configuration: { enabled: true, clients: [{ name: 'X' }] } }));
    component.load();
    expect(component.configuration).toBeNull();
    expect(stored).toBeNull();
  });

  it('distinguishes a permission denial from other errors', () => {
    company.getLiteContext.and.returnValue(throwError(() => ({ status: 403 })));
    component.load();
    expect(component.accessDenied).toBeTrue();
    expect(component.error).toBe('');
    company.getLiteContext.and.returnValue(throwError(() => ({ status: 500 })));
    component.load();
    expect(component.accessDenied).toBeFalse();
    expect(component.error).toBe('Error del servidor');
  });
});
