import { DashboardScreen, DashboardView } from './dashboard.models';

export interface DashboardViewInput {
  /** `ui_capabilities.dashboard`; `null` si el backend aún no lo envía. */
  screen: DashboardScreen | null;
  restaurant: boolean;
  /** Licencia POS (genérico o de restaurante). */
  pos: boolean;
  billing: boolean;
  apiOnly: boolean;
}

export interface DashboardLayout {
  view: DashboardView;
  /**
   * Administrador/Gerente con facturación además de Restaurante/POS: suma el
   * resumen de comprobantes del mes al panel operativo.
   */
  billingSummary: boolean;
}

/**
 * Regla única del dashboard. El rol (pantalla enviada por el backend) decide
 * el tipo de panel y los módulos activos del negocio deciden qué datos
 * cargar, para que cada negocio vea solo lo que tiene habilitado:
 * - Restaurante o POS genérico: panel operativo (turno, caja y ventas).
 * - Solo facturación: panel de comprobantes.
 * - API-only: panel de integración.
 */
export function resolveDashboardLayout(input: DashboardViewInput): DashboardLayout {
  const hasOperations = input.restaurant || input.pos;
  const layout = (view: DashboardView, billingSummary = false): DashboardLayout => ({ view, billingSummary });

  switch (input.screen) {
    case 'kitchen_board':
      return layout('kitchen');
    case 'restaurant_service':
      return layout(input.restaurant ? 'service' : 'none');
    case 'none':
      return layout('none');
    case 'cashier_shift':
      if (hasOperations) return layout('operations');
      return layout(input.billing ? 'billing' : 'none');
    case 'billing_overview':
      if (input.apiOnly) return layout('api');
      return layout(input.billing ? 'billing' : 'none');
    case 'business_overview':
    case null:
    default: {
      const view = hasOperations ? 'operations' : input.apiOnly ? 'api' : input.billing ? 'billing' : 'none';
      return layout(view, view === 'operations' && input.billing && input.screen === 'business_overview');
    }
  }
}
