import { of } from 'rxjs';
import { PosShellComponent } from './pos-shell.component';

describe('POS shell — variante de la pantalla', () => {
  function build(options: { permissions: string[]; businessRole?: string; tables?: boolean; tablesResponse?: any[] }) {
    const capabilities = {
      activeBusinessId: 'BIZ-1',
      businessRole: options.businessRole ?? null,
      isEnabled: (feature: string) => feature === 'tables' ? options.tables !== false : true,
      hasPermission: (key: string) => options.permissions.includes(key)
    };
    const route = { snapshot: { queryParamMap: { get: () => null } } };
    const auth = { getCurrentUser: () => ({ roles: [] }) };
    const orders = { getTables: () => of({ message: { data: options.tablesResponse ?? [] } }) };
    const router = { navigate: jasmine.createSpy('navigate') };
    const component = new PosShellComponent(auth as any, capabilities as any, route as any, orders as any, router as any);
    component.ngOnInit();
    return { component, router };
  }

  it('muestra el POS de mesero a quien crea órdenes pero no factura', () => {
    expect(build({ permissions: ['restaurant.orders.create'] }).component.roleName).toBe('Mesero');
  });

  it('el mesero con mesas configuradas entra por el salón', () => {
    const { router, component } = build({ permissions: ['restaurant.orders.create'], tablesResponse: [{ name: 'M1' }] });
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard/tables'], { replaceUrl: true });
    expect(component.posReady).toBeFalse();
  });

  it('quien puede facturar ve la caja aunque también cree órdenes', () => {
    const { component } = build({ permissions: ['restaurant.orders.create', 'billing.create'], businessRole: 'Cajero' });
    expect(component.roleName).toBe('Cajero');
  });

  it('usa el rol del negocio para gerentes y administradores', () => {
    expect(build({ permissions: ['billing.create'], businessRole: 'Administrador' }).component.roleName).toBe('Gerente');
  });
});
