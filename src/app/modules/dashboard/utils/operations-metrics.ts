import { frappeData } from 'src/app/core/utils/frappe-response';
import {
  CashSnapshot,
  Indicator,
  OperationsKind,
  OperationsMetrics,
  SignatureStatus,
  TopProduct
} from '../dashboard.models';
import { isRecord, toBoolean, toNumber } from './dashboard-values';

/** Diferencia de caja (USD) a partir de la cual se pide revisar el turno. */
export const CASH_DIFFERENCE_ALERT = 20;

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
        count: toNumber(product?.count ?? product?.qty)
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
          amount: toNumber(payment?.amount ?? payment?.total)
        }))
      : []
  };
}

function normalizeCountMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, raw]) => [key, toNumber(raw)]));
}

export function averageTicket(metrics: OperationsMetrics): number {
  return metrics.ordersCount ? metrics.salesTotal / metrics.ordersCount : 0;
}

export function cashDifference(cash: CashSnapshot): number {
  return cash.systemCash - cash.expectedCash;
}

/** Promedio por hora desde el inicio del día. */
export function ordersPerHour(count: number, now: Date = new Date()): number {
  return count / Math.max(now.getHours() + 1, 1);
}

export function unitLabel(kind: OperationsKind): string {
  return kind === 'pos' ? 'ventas' : 'pedidos';
}

export function ticketIndicator(metrics: OperationsMetrics): Indicator {
  if (!metrics.ordersCount) return { label: `Sin ${unitLabel(metrics.kind)}`, tone: 'neutral' };
  const ticket = averageTicket(metrics);
  if (ticket >= 15) return { label: 'Ticket fuerte', tone: 'success' };
  if (ticket >= 8) return { label: 'Ticket estable', tone: 'info' };
  return { label: 'Ticket bajo', tone: 'warning' };
}

export function paceIndicator(metrics: OperationsMetrics, now: Date = new Date()): Indicator {
  if (!metrics.ordersCount) return { label: 'Sin movimiento', tone: 'neutral' };
  const pace = ordersPerHour(metrics.ordersCount, now);
  if (pace >= 4) return { label: 'Ritmo alto', tone: 'success' };
  if (pace >= 2) return { label: 'Ritmo estable', tone: 'info' };
  return { label: 'Ritmo bajo', tone: 'warning' };
}

export function cashDifferenceIndicator(cash: CashSnapshot): Indicator {
  const difference = cashDifference(cash);
  if (Math.abs(difference) < 0.01) return { label: 'Sin diferencia', tone: 'neutral' };
  return difference > 0 ? { label: 'Sobrante', tone: 'success' } : { label: 'Faltante', tone: 'danger' };
}

export interface ProductMix extends Indicator {
  topName: string;
  topCount: number;
  /** Porcentaje del producto líder dentro del ranking. */
  topShare: number;
  detail: string;
}

export function productMix(products: TopProduct[]): ProductMix {
  const totalUnits = products.reduce((total, product) => total + product.count, 0);
  if (!products.length || !totalUnits) {
    return {
      label: 'Sin datos',
      tone: 'neutral',
      topName: products[0]?.name ?? 'Sin datos',
      topCount: products[0]?.count ?? 0,
      topShare: 0,
      detail: 'Todavía no hay suficientes ventas para evaluar el mix de productos.'
    };
  }
  const [top] = products;
  const topShare = (top.count / totalUnits) * 100;
  const top3Share = (products.slice(0, 3).reduce((total, product) => total + product.count, 0) / totalUnits) * 100;
  const base = { topName: top.name, topCount: top.count, topShare };
  if (topShare >= 45) {
    return { ...base, label: 'Alta dependencia', tone: 'danger', detail: `${top.name} concentra ${topShare.toFixed(1)}% del top vendido.` };
  }
  if (top3Share >= 75) {
    return { ...base, label: 'Mix concentrado', tone: 'warning', detail: `Los 3 productos líderes concentran ${top3Share.toFixed(1)}% de las unidades vendidas.` };
  }
  return { ...base, label: 'Mix balanceado', tone: 'success', detail: 'Las ventas se reparten bien entre varios productos del ranking.' };
}

export interface OperationsContext {
  /** La caja aplica a Restaurante y a POS con `cash_register`. */
  showCash: boolean;
  signature: SignatureStatus;
}

export interface OperationsInsights {
  status: Indicator;
  salesSummary: string;
  cashTitle: string;
  cashSummary: string;
  productSummary: string;
  actions: string[];
}

/** Lectura rápida del turno: estado general, resúmenes y qué revisar ahora. */
export function buildOperationsInsights(metrics: OperationsMetrics, context: OperationsContext): OperationsInsights {
  const unit = unitLabel(metrics.kind);
  const { cash } = metrics;
  const difference = cashDifference(cash);
  const differenceAbs = Math.abs(difference);
  const { signature } = context;
  const signatureBlocked = signature.missing || signature.expired;
  const mix = productMix(metrics.topProducts);

  let status: Indicator;
  if (context.showCash) {
    if (!cash.isOpen) status = { label: 'Atención requerida', tone: 'danger' };
    else if (differenceAbs > CASH_DIFFERENCE_ALERT) status = { label: 'Revisar caja', tone: 'danger' };
    else if (!metrics.ordersCount) status = { label: 'Sin movimiento', tone: 'warning' };
    else status = { label: 'Operación estable', tone: 'success' };
  } else if (signatureBlocked) {
    status = { label: 'Revisar firma', tone: 'danger' };
  } else {
    status = metrics.ordersCount
      ? { label: 'Operación activa', tone: 'success' }
      : { label: 'Sin movimiento', tone: 'info' };
  }

  const salesSummary = metrics.ordersCount
    ? `Llevas ${metrics.ordersCount} ${unit} por ${metrics.salesTotal.toFixed(2)} USD.`
    : `Aún no hay ${unit} registrados hoy.`;

  let cashSummary: string;
  if (context.showCash) {
    if (!cash.isOpen) cashSummary = 'No hay apertura de caja activa en este turno.';
    else if (differenceAbs < 0.01) cashSummary = 'La caja está cuadrada con el valor esperado.';
    else cashSummary = `Hay un ${difference > 0 ? 'sobrante' : 'faltante'} de ${differenceAbs.toFixed(2)} USD frente a lo esperado.`;
  } else {
    cashSummary = signatureSummary(signature);
  }

  const productSummary = metrics.topProducts.length
    ? `${mix.topName} lidera las ventas con ${mix.topCount} unidades.`
    : 'Sin ventas de productos para mostrar ranking.';

  const actions: string[] = [];
  if (context.showCash && !cash.isOpen) actions.push('Realizar apertura de caja para iniciar el turno.');
  actions.push(...signatureActions(signature));
  if (context.showCash && differenceAbs > CASH_DIFFERENCE_ALERT) actions.push('Verificar retiros y movimientos de caja por diferencia alta.');
  if (!metrics.ordersCount) {
    actions.push(metrics.kind === 'pos'
      ? 'Confirmar que el punto de venta esté operativo.'
      : 'Confirmar que POS y toma de pedidos estén operativos.');
  }
  if (!actions.length) actions.push('Mantener la operación actual y monitorear los cierres.');

  return {
    status,
    salesSummary,
    cashTitle: context.showCash ? 'Situación de caja' : 'Firma / SRI',
    cashSummary,
    productSummary,
    actions
  };
}

export function signatureSummary(signature: SignatureStatus): string {
  if (signature.missing) return 'Falta registrar la firma electrónica para emitir comprobantes.';
  if (signature.daysLeft === null) return 'Certificado configurado; su vigencia está pendiente de validar.';
  if (signature.expired) return 'La firma está vencida. Debes renovarla antes de emitir.';
  return `Firma activa. Certificado con ${signature.daysLeft} día(s) disponibles.`;
}

export function signatureActions(signature: SignatureStatus): string[] {
  if (signature.missing) return ['Registrar la firma electrónica para habilitar la emisión de comprobantes.'];
  if (signature.expired) return ['Renovar la firma electrónica: el certificado está vencido.'];
  if (signature.daysLeft !== null && signature.daysLeft <= 30) {
    return [`Renovar el certificado de firma (${signature.daysLeft} día(s) restantes).`];
  }
  return [];
}
