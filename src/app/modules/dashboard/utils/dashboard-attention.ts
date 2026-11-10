import { AttentionItem, DashboardView, PlanSummary, SignatureStatus } from '../dashboard.models';
import { planExpiringSoon } from './plan-summary';
import { datePresetRange } from 'src/app/shared/utils/date-presets';

/** Ruta de cada pantalla destino; el permiso se decide antes de llamar a `buildAttentionItems`. */
export const ATTENTION_ROUTES = {
  cashOpening: '/caja/apertura',
  certificate: '/settings/lite/certificate',
  plan: '/settings/lite/plan',
  invoices: '/dashboard/invoices',
  inventory: '/dashboard/inventory'
} as const;

export interface AttentionInput {
  view: DashboardView;
  signature: SignatureStatus;
  /** La caja aplica al panel y quien mira no tiene una abierta. */
  cashClosed: boolean;
  /** `null` cuando el plan no se muestra a este rol. */
  plan: PlanSummary | null;
  showPlan: boolean;
  /** Comprobantes del mes elegido (`null` si este panel no los carga). */
  rejected: number | null;
  pending: number | null;
  /** Productos en o bajo el mínimo y agotados (`null` si no aplica). */
  lowStock: number | null;
  outOfStock: number | null;
  billingError?: string;
  /** Qué acciones puede abrir quien mira (las rutas destino exigen esos permisos). */
  can: { openCash: boolean; manageSettings: boolean; readInvoices: boolean; readInventory: boolean };
}

/**
 * «Necesita tu atención»: una sola lista, de lo que bloquea a lo informativo,
 * cada punto con la acción que lo resuelve. Mesero y Cocina no la ven.
 */
export function buildAttentionItems(input: AttentionInput): AttentionItem[] {
  if (input.view === 'service' || input.view === 'kitchen' || input.view === 'none') return [];
  const items: AttentionItem[] = [];
  const { can, signature, plan } = input;

  if (input.billingError) {
    items.push({ id: 'billing-error', tone: 'danger', title: 'No se pudieron cargar los comprobantes', detail: input.billingError });
  }

  if (signature.missing) {
    items.push({
      id: 'signature',
      tone: 'danger',
      title: 'Falta la firma electrónica',
      detail: 'Sin firma no se pueden emitir facturas.',
      action: can.manageSettings ? { label: 'Subir firma', route: ATTENTION_ROUTES.certificate } : undefined
    });
  } else if (signature.expired) {
    items.push({
      id: 'signature',
      tone: 'danger',
      title: 'La firma electrónica venció',
      detail: 'Renuévala para volver a emitir facturas.',
      action: can.manageSettings ? { label: 'Renovar firma', route: ATTENTION_ROUTES.certificate } : undefined
    });
  } else if (signature.daysLeft !== null && signature.daysLeft <= 30) {
    items.push({
      id: 'signature',
      tone: 'warning',
      title: signature.daysLeft === 1 ? 'La firma electrónica vence mañana' : `La firma electrónica vence en ${signature.daysLeft} días`,
      detail: 'Renuévala antes para no dejar de facturar.',
      action: can.manageSettings ? { label: 'Ver firma', route: ATTENTION_ROUTES.certificate } : undefined
    });
  }

  if (input.showPlan) {
    const planAction = can.manageSettings ? { label: 'Ver plan', route: ATTENTION_ROUTES.plan } : undefined;
    if (!plan) {
      items.push({ id: 'plan', tone: 'danger', title: 'El negocio no tiene un plan asignado', detail: 'No se pueden emitir comprobantes.' });
    } else if (plan.inactive) {
      items.push({ id: 'plan', tone: 'danger', title: 'El plan no está activo', detail: 'La emisión de comprobantes está bloqueada.', action: planAction });
    } else if (!plan.unlimited && plan.remaining <= 0) {
      items.push({ id: 'plan', tone: 'danger', title: 'Ya usaste todos los comprobantes del plan', detail: `${plan.used} de ${plan.included} emitidos.`, action: planAction });
    } else if (planExpiringSoon(plan)) {
      items.push({
        id: 'plan',
        tone: 'warning',
        title: plan.daysToExpire === 0 ? 'El plan vence hoy' : `El plan vence en ${plan.daysToExpire} ${plan.daysToExpire === 1 ? 'día' : 'días'}`,
        action: planAction
      });
    }
  }

  if (input.rejected) {
    items.push({
      id: 'rejected',
      tone: 'danger',
      title: input.rejected === 1 ? '1 factura rechazada por el SRI este mes' : `${input.rejected} facturas rechazadas por el SRI este mes`,
      detail: 'Revisa el motivo y corrígela.',
      // Mismo período que cuenta el panel (mes en curso), para que la lista muestre el mismo número.
      action: can.readInvoices ? { label: 'Ver rechazadas', route: ATTENTION_ROUTES.invoices, queryParams: rejectedQuery() } : undefined
    });
  }

  if (input.cashClosed) {
    items.push({
      id: 'cash',
      tone: 'warning',
      title: 'No tienes una caja abierta',
      detail: 'Ábrela con el fondo inicial para cobrar en el POS.',
      action: can.openCash ? { label: 'Abrir caja', route: ATTENTION_ROUTES.cashOpening } : undefined
    });
  }

  if (input.outOfStock || input.lowStock) {
    const out = input.outOfStock ?? 0;
    const low = input.lowStock ?? 0;
    const parts = [
      out ? `${out} ${out === 1 ? 'agotado' : 'agotados'}` : '',
      low ? `${low} con stock bajo` : ''
    ].filter(Boolean);
    items.push({
      id: 'stock',
      tone: out ? 'danger' : 'warning',
      title: `Inventario: ${parts.join(' y ')}`,
      detail: 'Repón antes de que falte en la venta.',
      action: can.readInventory ? { label: 'Ver inventario', route: ATTENTION_ROUTES.inventory } : undefined
    });
  }

  if (input.pending) {
    items.push({
      id: 'pending',
      tone: 'info',
      title: input.pending === 1 ? '1 factura aún no está autorizada por el SRI' : `${input.pending} facturas aún no están autorizadas por el SRI`,
      detail: 'Desde Facturas puedes consultar su estado.',
      action: can.readInvoices ? { label: 'Ver facturas', route: ATTENTION_ROUTES.invoices } : undefined
    });
  }

  return items;
}

/** Filtro de Facturas para «Ver rechazadas»: rechazadas del mes en curso. */
function rejectedQuery(): { estado: string; desde: string; hasta: string } {
  const month = datePresetRange('month');
  return { estado: 'Rechazada', desde: month.from, hasta: month.to };
}
