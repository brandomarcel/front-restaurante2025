import { AttentionInput, buildAttentionItems } from './dashboard-attention';
import { buildPlanSummary } from './plan-summary';

const base = (): AttentionInput => ({
  view: 'billing',
  signature: { missing: false, expired: false, daysLeft: 60 } as any,
  cashClosed: false,
  plan: null,
  showPlan: false,
  rejected: 0,
  pending: 0,
  lowStock: 0,
  outOfStock: 0,
  can: { openCash: true, manageSettings: true, readInvoices: true, readInventory: true },
});

describe('Atención del dashboard', () => {
  it('no ofrece alertas administrativas a mesero/cocina/sin panel', () => {
    for (const view of ['service', 'kitchen', 'none'] as const)
      expect(buildAttentionItems({ ...base(), view, rejected: 2 })).toEqual([]);
  });
  it('firma ausente/vencida y por vencer tiene gravedad y acción según permiso', () => {
    for (const signature of [
      { missing: true, expired: false, daysLeft: null },
      { missing: false, expired: true, daysLeft: -1 },
    ]) {
      const result = buildAttentionItems({ ...base(), signature: signature as any });
      expect(result[0].tone).toBe('danger');
      expect(result[0].action?.route).toBe('/settings/lite/certificate');
    }
    const data = base();
    data.signature.daysLeft = 1;
    data.can.manageSettings = false;
    const result = buildAttentionItems(data);
    expect(result[0].title).toContain('mañana');
    expect(result[0].action).toBeUndefined();
  });
  it('no muestra firma vigente con más de 30 días ni plan oculto', () => {
    expect(buildAttentionItems(base())).toEqual([]);
  });
  it('plan ausente, inactivo o agotado bloquea; vence en siete días advierte', () => {
    expect(buildAttentionItems({ ...base(), showPlan: true })[0].id).toBe('plan');
    const today = new Date(2026, 10, 9);
    for (const raw of [
      { status: 'Suspendido' },
      { status: 'Activo', max_authorized_documents: 10, remaining_authorized_documents: 0 },
    ]) {
      const plan = buildPlanSummary(null, { name: 'Plan de prueba', ...raw }, today);
      expect(buildAttentionItems({ ...base(), plan, showPlan: true })[0].tone).toBe('danger');
    }
    const plan = buildPlanSummary(
      { end_date: '2026-11-16' },
      { name: 'Plan', status: 'Activo', max_authorized_documents: 10, remaining_authorized_documents: 5 },
      today,
    );
    expect(buildAttentionItems({ ...base(), plan, showPlan: true })[0].tone).toBe('warning');
  });
  it('rechazadas enlaza su filtro y sin permiso conserva aviso sin enlace', () => {
    const data = base();
    data.rejected = 1;
    expect(buildAttentionItems(data)[0].action?.queryParams).toEqual({ estado: 'Rechazada' });
    data.can.readInvoices = false;
    expect(buildAttentionItems(data)[0].action).toBeUndefined();
  });
  it('respeta permisos para abrir caja e inventario', () => {
    const data = base();
    data.cashClosed = true;
    data.lowStock = 2;
    data.can.openCash = false;
    data.can.readInventory = false;
    const result = buildAttentionItems(data);
    expect(result.map((item) => item.id)).toEqual(['cash', 'stock']);
    expect(result.every((item) => !item.action)).toBeTrue();
    expect(result[1].tone).toBe('warning');
    data.outOfStock = 1;
    expect(buildAttentionItems(data)[1].tone).toBe('danger');
  });
  it('ordena bloqueos antes de caja/stock/pendientes y usa plural correcto', () => {
    const data = base();
    data.signature.missing = true;
    data.showPlan = true;
    data.rejected = 2;
    data.cashClosed = true;
    data.outOfStock = 1;
    data.pending = 1;
    const result = buildAttentionItems(data);
    expect(result.map((item) => item.id)).toEqual(['signature', 'plan', 'rejected', 'cash', 'stock', 'pending']);
    expect(result[2].title).toContain('2 facturas');
    expect(result[5].title).toContain('1 factura');
  });
});
