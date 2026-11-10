import { frappeData } from 'src/app/core/utils/frappe-response';
import { CashSnapshot, OperationsKind, OperationsMetrics, TopProduct } from '../dashboard.models';
import { isRecord, toBoolean, toNumber } from './dashboard-values';

/** Código SRI de la forma de pago en efectivo: la única que entra a la caja. */
export const CASH_PAYMENT_CODE = '01';

export const EMPTY_CASH: CashSnapshot = {
  isOpen: false,
  openingName: '',
  openingAmount: 0,
  withdrawals: 0,
  systemCash: 0,
  expectedCash: 0,
  paymentTotals: []
};

export function emptyOperationsMetrics(kind: OperationsKind): OperationsMetrics {
  return {
    kind,
    ordersCount: 0,
    salesTotal: 0,
    topProducts: [],
    ordersByStatus: {},
    salesByType: {},
    activeOrders: 0,
    activeTotal: 0,
    cash: { ...EMPTY_CASH }
  };
}

/**
 * Normaliza `facturada_restaurante.api.frontend.get_dashboard_metrics`.
 * El backend responde `{ data: {...} }` con `dashboard_type` = `restaurant`
 * (órdenes de salón) o `pos` (notas POS y facturas directas).
 */
export function normalizeOperationsMetrics(response: unknown, fallbackKind: OperationsKind): OperationsMetrics {
  const data = frappeData<any>(response);
  const payload = isRecord(data) ? data : {};
  const type = `${payload['dashboard_type'] ?? ''}`.toLowerCase();
  const kind: OperationsKind = type === 'pos' || type === 'restaurant' ? type : fallbackKind;
  const topProducts: TopProduct[] = Array.isArray(payload['top_products'])
    ? payload['top_products'].map((product: any) => ({
        name: String(product?.name ?? product?.item_name ?? 'Sin nombre'),
        count: toNumber(product?.count ?? product?.qty),
        total: toNumber(product?.total)
      }))
    : [];

  return {
    kind,
    ordersCount: toNumber(payload['total_orders_today']),
    salesTotal: toNumber(payload['total_sales_today']),
    topProducts,
    ordersByStatus: normalizeCountMap(payload['orders_by_status']),
    salesByType: normalizeCountMap(payload['sales_by_type']),
    activeOrders: toNumber(payload['active_orders']),
    activeTotal: toNumber(payload['active_total']),
    cash: normalizeCash(payload['cash'])
  };
}

function normalizeCash(value: unknown): CashSnapshot {
  if (!isRecord(value)) return { ...EMPTY_CASH };
  const isOpen = toBoolean(value['is_open']);
  const opening = value['cash_opening'];
  const openingName = typeof opening === 'string' ? opening : String(opening?.name ?? '');
  return {
    isOpen,
    openingName: isOpen ? openingName.trim() : '',
    openingAmount: toNumber(value['monto_apertura']),
    withdrawals: toNumber(value['total_retiros']),
    systemCash: toNumber(value['efectivo_sistema']),
    // El backend ya separa efectivo de tarjeta/transferencia: no recalcular.
    expectedCash: toNumber(value['expected_cash']),
    paymentTotals: Array.isArray(value['payment_totals'])
      ? value['payment_totals'].map((payment: any) => ({
          method: String(payment?.payment_method || payment?.method || 'Otro'),
          code: String(payment?.payment_code ?? ''),
          amount: toNumber(payment?.amount ?? payment?.total)
        }))
      : []
  };
}

function normalizeCountMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, raw]) => [key, toNumber(raw)]));
}

/**
 * Órdenes que forman la venta del día. En Restaurante el backend suma como venta
 * solo las órdenes cerradas (las abiertas aún no se cobran); en POS cada nota o
 * factura ya es una venta.
 */
export function soldCount(metrics: OperationsMetrics): number {
  return metrics.kind === 'restaurant' ? metrics.ordersByStatus['Cerrada'] ?? 0 : metrics.ordersCount;
}

export function averageTicket(metrics: OperationsMetrics): number {
  const count = soldCount(metrics);
  return count ? metrics.salesTotal / count : 0;
}

export function unitLabel(kind: OperationsKind): string {
  return kind === 'pos' ? 'ventas' : 'pedidos';
}

/**
 * Cuadre del turno tal como lo calcula el backend: fondo inicial + cobrado en
 * efectivo − retiros = efectivo que debe haber. Las demás formas de pago no
 * entran a la caja y se listan aparte.
 */
export interface CashBreakdown {
  opening: number;
  cashCollected: number;
  withdrawals: number;
  expected: number;
  otherPayments: { method: string; amount: number }[];
  /** Todo lo cobrado en el turno, en cualquier forma de pago. */
  collectedTotal: number;
}

export function cashBreakdown(cash: CashSnapshot): CashBreakdown {
  const isCash = (code: string) => code === CASH_PAYMENT_CODE;
  const cashCollected = cash.paymentTotals
    .filter((payment) => isCash(payment.code))
    .reduce((total, payment) => total + payment.amount, 0);
  const otherPayments = cash.paymentTotals
    .filter((payment) => !isCash(payment.code) && payment.amount !== 0)
    .map(({ method, amount }) => ({ method, amount }));
  return {
    opening: cash.openingAmount,
    cashCollected,
    withdrawals: cash.withdrawals,
    expected: cash.expectedCash,
    otherPayments,
    collectedTotal: cash.paymentTotals.reduce((total, payment) => total + payment.amount, 0)
  };
}

/** Ancho de la barra de cada producto (0–100) respecto al más vendido del día. */
export function productShares(products: TopProduct[]): (TopProduct & { share: number })[] {
  const max = products.reduce((top, product) => Math.max(top, product.count), 0);
  return products.map((product) => ({ ...product, share: max > 0 ? (product.count / max) * 100 : 0 }));
}
