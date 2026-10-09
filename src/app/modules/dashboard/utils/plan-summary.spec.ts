import { buildPlanSummary, planUsagePercent, planWarning } from './plan-summary';

describe('buildPlanSummary', () => {
  const today = new Date(2026, 9, 8);

  it('prioriza el consumo del dashboard Lite y toma fechas del contexto', () => {
    const plan = buildPlanSummary(
      { plan_name: 'Contexto', status: 'ACTIVO', used_authorized_vouchers: 1, purchased_authorized_vouchers: 100, end_date: '2026-10-12', auto_renew: 1 },
      { name: 'Plan Pro', status: 'Activo', unlimited_documents: false, max_authorized_documents: 100, used_authorized_documents: 40, remaining_authorized_documents: 60 },
      today
    );
    expect(plan).toEqual(jasmine.objectContaining({
      name: 'Plan Pro', status: 'ACTIVO', used: 40, included: 100, remaining: 60, daysToExpire: 4, autoRenew: true, inactive: false
    }));
    expect(planUsagePercent(plan!)).toBe(40);
    expect(planWarning(plan)).toBe('El plan vence en 4 día(s).');
  });

  it('interpreta -1 como ilimitado y estados inactivos', () => {
    const plan = buildPlanSummary({ status: 'Suspendido', remaining_authorized_vouchers: -1 }, null, today);
    expect(plan?.unlimited).toBeTrue();
    expect(plan?.inactive).toBeTrue();
    expect(planWarning(plan)).toBe('El plan no está activo. La emisión de comprobantes está bloqueada.');
  });

  it('avisa límite agotado y ausencia de plan', () => {
    const plan = buildPlanSummary(null, { name: 'Básico', status: 'Activo', max_authorized_documents: 10, used_authorized_documents: 10, remaining_authorized_documents: 0 }, today);
    expect(planWarning(plan)).toBe('Se agotó el límite de comprobantes autorizados del plan.');
    expect(buildPlanSummary(null, null)).toBeNull();
    expect(planWarning(null)).toContain('Sin plan asignado');
  });
});
