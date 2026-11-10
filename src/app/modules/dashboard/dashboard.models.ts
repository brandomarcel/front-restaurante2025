import { CompanyFeatureKey } from 'src/app/core/services/company-capabilities.service';

/**
 * Pantalla que el backend asigna por rol en `ui_capabilities.dashboard`
 * (`facturada_core.api.ui_capabilities`).
 */
export type DashboardScreen =
  | 'business_overview'
  | 'cashier_shift'
  | 'billing_overview'
  | 'restaurant_service'
  | 'kitchen_board'
  | 'none';

/**
 * Panel que se dibuja: combina la pantalla del rol con los módulos activos
 * del negocio (ver `resolveDashboardLayout`).
 * - operations: Restaurante o POS genérico (`get_dashboard_metrics`).
 * - billing: solo facturación (`facturada_lite.api.dashboard.get_dashboard`).
 * - api: negocio API-only (mismo endpoint que billing).
 * - service: Mesero, accesos rápidos sin métricas (no tiene `reports.view`).
 * - kitchen: Cocina, redirige a la pantalla en tiempo real.
 */
export type DashboardView = 'operations' | 'billing' | 'api' | 'service' | 'kitchen' | 'none';

export type OperationsKind = 'restaurant' | 'pos';

export type Tone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

export interface Indicator {
  label: string;
  tone: Tone;
}

export interface PaymentTotal {
  method: string;
  /** Código SRI de la forma de pago: `01` es efectivo (el único que entra a la caja). */
  code: string;
  amount: number;
}

/** Caja del usuario actual (y terminal, si se envía) según el backend. */
export interface CashSnapshot {
  isOpen: boolean;
  openingName: string;
  openingAmount: number;
  withdrawals: number;
  systemCash: number;
  expectedCash: number;
  paymentTotals: PaymentTotal[];
}

export interface TopProduct {
  name: string;
  count: number;
  /** Monto vendido del producto en el día. */
  total: number;
}

export interface OperationsMetrics {
  kind: OperationsKind;
  ordersCount: number;
  salesTotal: number;
  topProducts: TopProduct[];
  ordersByStatus: Record<string, number>;
  salesByType: Record<string, number>;
  activeOrders: number;
  activeTotal: number;
  cash: CashSnapshot;
}

export interface CompanySummary {
  name: string;
  environment: string;
  /** Sin certificado configurado o con estado no utilizable para emitir. */
  certificateMissing: boolean;
  /** El backend ya marcó el certificado como `Vencido`. */
  certificateExpired: boolean;
  /** Fecha `YYYY-MM-DD` de fin de vigencia del certificado, si se conoce. */
  certificateValidTo: string;
}

export interface SignatureStatus extends Indicator {
  missing: boolean;
  expired: boolean;
  /** `null` cuando la vigencia todavía no se conoce. */
  daysLeft: number | null;
}

export interface PlanSummary {
  name: string;
  status: string;
  inactive: boolean;
  unlimited: boolean;
  used: number;
  included: number;
  remaining: number;
  startDate: string | null;
  endDate: string | null;
  daysToExpire: number | null;
  autoRenew: boolean | null;
}

export interface RetailStockSummary {
  loading: boolean;
  lowStock: number;
  outOfStock: number;
}

/** Algo que pide una acción de quien administra; se muestra en «Necesita tu atención». */
export interface AttentionItem {
  id: string;
  tone: 'danger' | 'warning' | 'info';
  title: string;
  detail?: string;
  action?: { label: string; route: string; queryParams?: Record<string, string> };
}

export interface DashboardShortcut {
  label: string;
  detail: string;
  route: string;
  /** Debe coincidir con `requiredFeatures`/`featureKey` de la ruta destino. */
  features: CompanyFeatureKey[];
  permission: string;
}
