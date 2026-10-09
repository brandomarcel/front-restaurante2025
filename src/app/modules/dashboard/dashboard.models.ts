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

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-700',
  info: 'bg-sky-100 text-sky-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700'
};

export interface Indicator {
  label: string;
  tone: Tone;
}

export interface PaymentTotal {
  method: string;
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

export interface DashboardShortcut {
  label: string;
  detail: string;
  route: string;
  classes: string;
  /** Debe coincidir con `requiredFeatures`/`featureKey` de la ruta destino. */
  features: CompanyFeatureKey[];
  permission: string;
}
