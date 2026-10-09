import { DashboardViewInput, resolveDashboardLayout } from './dashboard-view';

describe('resolveDashboardLayout', () => {
  const restaurant: Omit<DashboardViewInput, 'screen'> = { restaurant: true, pos: true, billing: false, apiOnly: false };
  const restaurantWithBilling: Omit<DashboardViewInput, 'screen'> = { restaurant: true, pos: true, billing: true, apiOnly: false };
  const genericPos: Omit<DashboardViewInput, 'screen'> = { restaurant: false, pos: true, billing: true, apiOnly: false };
  const billingOnly: Omit<DashboardViewInput, 'screen'> = { restaurant: false, pos: false, billing: true, apiOnly: false };
  const apiOnly: Omit<DashboardViewInput, 'screen'> = { restaurant: false, pos: false, billing: false, apiOnly: true };

  describe('Administrador/Gerente (business_overview) según los módulos activos', () => {
    it('Restaurante: panel operativo sin resumen de comprobantes', () => {
      expect(resolveDashboardLayout({ ...restaurant, screen: 'business_overview' }))
        .toEqual({ view: 'operations', billingSummary: false });
    });

    it('Restaurante con facturación: panel operativo más comprobantes del mes', () => {
      expect(resolveDashboardLayout({ ...restaurantWithBilling, screen: 'business_overview' }))
        .toEqual({ view: 'operations', billingSummary: true });
    });

    it('POS genérico: panel operativo más comprobantes del mes', () => {
      expect(resolveDashboardLayout({ ...genericPos, screen: 'business_overview' }))
        .toEqual({ view: 'operations', billingSummary: true });
    });

    it('Solo facturación: panel de comprobantes', () => {
      expect(resolveDashboardLayout({ ...billingOnly, screen: 'business_overview' }))
        .toEqual({ view: 'billing', billingSummary: false });
    });

    it('API-only: panel de integración', () => {
      expect(resolveDashboardLayout({ ...apiOnly, screen: 'business_overview' }))
        .toEqual({ view: 'api', billingSummary: false });
    });

    it('sin módulos: sin panel', () => {
      expect(resolveDashboardLayout({ restaurant: false, pos: false, billing: false, apiOnly: false, screen: 'business_overview' }).view)
        .toBe('none');
    });
  });

  it('Cajero ve el turno de Restaurante o POS', () => {
    expect(resolveDashboardLayout({ ...restaurant, screen: 'cashier_shift' }).view).toBe('operations');
    expect(resolveDashboardLayout({ ...genericPos, screen: 'cashier_shift' })).toEqual({ view: 'operations', billingSummary: false });
  });

  it('Facturación ve comprobantes aunque el negocio tenga POS', () => {
    expect(resolveDashboardLayout({ ...genericPos, screen: 'billing_overview' }).view).toBe('billing');
    expect(resolveDashboardLayout({ ...apiOnly, screen: 'billing_overview' }).view).toBe('api');
  });

  it('Mesero ve accesos de salón solo si hay Restaurante', () => {
    expect(resolveDashboardLayout({ ...restaurant, screen: 'restaurant_service' }).view).toBe('service');
    expect(resolveDashboardLayout({ ...genericPos, screen: 'restaurant_service' }).view).toBe('none');
  });

  it('Cocina redirige a su pantalla y "none" no muestra panel', () => {
    expect(resolveDashboardLayout({ ...restaurant, screen: 'kitchen_board' }).view).toBe('kitchen');
    expect(resolveDashboardLayout({ ...restaurantWithBilling, screen: 'none' }).view).toBe('none');
  });

  it('sin pantalla del backend decide solo por módulos y no suma resumen', () => {
    expect(resolveDashboardLayout({ ...restaurantWithBilling, screen: null })).toEqual({ view: 'operations', billingSummary: false });
    expect(resolveDashboardLayout({ ...billingOnly, screen: null }).view).toBe('billing');
    expect(resolveDashboardLayout({ ...apiOnly, screen: null }).view).toBe('api');
  });
});
