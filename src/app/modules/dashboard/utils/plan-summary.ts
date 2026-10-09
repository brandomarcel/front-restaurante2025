import { CompanyPlan } from 'src/app/core/services/company-capabilities.service';
import { LiteDashboardPlan } from 'src/app/services/facturada-lite-dashboard.service';
import { PlanSummary } from '../dashboard.models';
import { daysUntil, normalizeText, toBoolean, toNumber } from './dashboard-values';

const INACTIVE_STATUSES = ['VENCIDO', 'SUSPENDIDO', 'CANCELADO', 'INACTIVO'];
export const PLAN_EXPIRY_WARNING_DAYS = 7;

/**
 * Une el plan del contexto de usuario con el que devuelve el dashboard Lite.
 * Los consumos del dashboard Lite son más recientes y tienen prioridad; las
 * fechas y la renovación automática solo vienen del contexto.
 */
export function buildPlanSummary(
  contextPlan: CompanyPlan | null,
  litePlan: LiteDashboardPlan | null,
  today: Date = new Date()
): PlanSummary | null {
  if (!contextPlan && !litePlan) return null;
  const ctx: CompanyPlan = contextPlan ?? {};

  const unlimited = litePlan
    ? toBoolean(litePlan.unlimited_documents) || toNumber(litePlan.remaining_authorized_documents) === -1
    : toBoolean(ctx.unlimited_authorized_vouchers ?? ctx.unlimited_documents)
      || toNumber(ctx.remaining_authorized_vouchers ?? ctx.remaining_authorized_documents) === -1;
  const used = toNumber(litePlan
    ? litePlan.used_authorized_documents
    : (ctx.used_authorized_vouchers ?? ctx.used_authorized_documents));
  const included = toNumber(litePlan
    ? litePlan.max_authorized_documents
    : (ctx.purchased_authorized_vouchers ?? ctx.max_authorized_documents));
  const rawRemaining = litePlan
    ? litePlan.remaining_authorized_documents
    : (ctx.remaining_authorized_vouchers ?? ctx.remaining_authorized_documents);
  const remaining = unlimited
    ? 0
    : (rawRemaining === null || rawRemaining === undefined ? Math.max(included - used, 0) : Math.max(toNumber(rawRemaining), 0));

  const status = normalizeText(litePlan?.status || ctx.status || 'SIN PLAN');
  const active = litePlan?.active ?? ctx.active;
  const endDate = litePlan?.end_date || ctx.end_date || null;
  const autoRenew = ctx.auto_renew;

  return {
    name: String(litePlan?.name || ctx.plan_name || ctx.plan || 'Sin plan asignado'),
    status,
    inactive: (active !== undefined && active !== null && `${active}` !== '' && !toBoolean(active))
      || INACTIVE_STATUSES.includes(status),
    unlimited,
    used,
    included,
    remaining,
    startDate: litePlan?.start_date || ctx.start_date || null,
    endDate,
    daysToExpire: daysUntil(endDate, today),
    autoRenew: autoRenew === undefined || autoRenew === null || `${autoRenew}` === '' ? null : toBoolean(autoRenew)
  };
}

export function planUsagePercent(plan: PlanSummary): number {
  if (plan.unlimited) return 0;
  if (plan.included <= 0) return plan.used > 0 ? 100 : 0;
  return Math.min(100, Math.max(0, (plan.used / plan.included) * 100));
}

export function planExpiringSoon(plan: PlanSummary): boolean {
  return plan.daysToExpire !== null && plan.daysToExpire >= 0 && plan.daysToExpire <= PLAN_EXPIRY_WARNING_DAYS;
}

/** Motivo por el que la emisión está (o pronto estará) bloqueada por el plan. */
export function planWarning(plan: PlanSummary | null): string | null {
  if (!plan) return 'Sin plan asignado. La emisión de comprobantes no está disponible.';
  if (plan.inactive) return 'El plan no está activo. La emisión de comprobantes está bloqueada.';
  if (!plan.unlimited && plan.remaining <= 0) return 'Se agotó el límite de comprobantes autorizados del plan.';
  if (planExpiringSoon(plan)) return `El plan vence en ${plan.daysToExpire} día(s).`;
  return null;
}
