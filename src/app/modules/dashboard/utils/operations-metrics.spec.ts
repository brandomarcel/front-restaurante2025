import { SignatureStatus } from '../dashboard.models';
import {
  buildOperationsInsights,
  cashDifferenceIndicator,
  emptyOperationsMetrics,
  normalizeOperationsMetrics,
  paceIndicator,
  productMix,
  ticketIndicator
} from './operations-metrics';

const okSignature: SignatureStatus = { label: 'Al día', tone: 'success', missing: false, expired: false, daysLeft: 120 };

describe('normalizeOperationsMetrics', () => {
  it('lee la respuesta de Restaurante con su caja', () => {
    const metrics = normalizeOperationsMetrics({
      message: {
        data: {
          dashboard_type: 'restaurant',
          total_orders_today: 4,
          total_sales_today: '60.5',
          top_products: [{ name: 'Seco', count: 3, total: 30 }],
          orders_by_status: { Ingresada: 1, Cerrada: '3' },
          sales_by_type: { Servirse: 40 },
          active_orders: 1,
          active_total: 12,
          cash: {
            is_open: true,
            cash_opening: 'APE-0001',
            monto_apertura: 20,
            total_retiros: 5,
            efectivo_sistema: 55,
            expected_cash: 55,
            payment_totals: [{ payment_method: 'Efectivo', amount: 40 }]
          }
        }
      }
    }, 'pos');

    expect(metrics.kind).toBe('restaurant');
    expect(metrics.salesTotal).toBe(60.5);
    expect(metrics.ordersByStatus).toEqual({ Ingresada: 1, Cerrada: 3 });
    expect(metrics.topProducts).toEqual([{ name: 'Seco', count: 3 }]);
    expect(metrics.cash).toEqual({
      isOpen: true,
      openingName: 'APE-0001',
      openingAmount: 20,
      withdrawals: 5,
      systemCash: 55,
      expectedCash: 55,
      paymentTotals: [{ method: 'Efectivo', amount: 40 }]
    });
  });

  it('usa el tipo de respaldo y una caja cerrada cuando faltan datos', () => {
    const metrics = normalizeOperationsMetrics({ message: { data: { cash: { is_open: 0, cash_opening: 'X' } } } }, 'pos');
    expect(metrics.kind).toBe('pos');
    expect(metrics.ordersCount).toBe(0);
    expect(metrics.cash.isOpen).toBeFalse();
    expect(metrics.cash.openingName).toBe('');
  });
});

describe('indicadores del turno', () => {
  it('clasifica ticket, ritmo y diferencia de caja', () => {
    const metrics = { ...emptyOperationsMetrics('restaurant'), ordersCount: 10, salesTotal: 200 };
    expect(ticketIndicator(metrics)).toEqual({ label: 'Ticket fuerte', tone: 'success' });
    expect(paceIndicator(metrics, new Date(2026, 9, 8, 1))).toEqual({ label: 'Ritmo alto', tone: 'success' });
    expect(cashDifferenceIndicator({ ...metrics.cash, systemCash: 10, expectedCash: 15 })).toEqual({ label: 'Faltante', tone: 'danger' });
  });

  it('detecta dependencia de un solo producto', () => {
    const mix = productMix([{ name: 'A', count: 9 }, { name: 'B', count: 1 }]);
    expect(mix.label).toBe('Alta dependencia');
    expect(mix.topShare).toBe(90);
  });
});

describe('buildOperationsInsights', () => {
  it('con caja: sin apertura pide abrir el turno', () => {
    const insights = buildOperationsInsights(emptyOperationsMetrics('restaurant'), { showCash: true, signature: okSignature });
    expect(insights.status.label).toBe('Atención requerida');
    expect(insights.cashTitle).toBe('Situación de caja');
    expect(insights.actions[0]).toBe('Realizar apertura de caja para iniciar el turno.');
  });

  it('sin caja: el estado depende de la firma', () => {
    const insights = buildOperationsInsights(emptyOperationsMetrics('pos'), {
      showCash: false,
      signature: { label: 'Sin firma', tone: 'danger', missing: true, expired: false, daysLeft: null }
    });
    expect(insights.status.label).toBe('Revisar firma');
    expect(insights.cashTitle).toBe('Firma / SRI');
    expect(insights.actions).toContain('Registrar la firma electrónica para habilitar la emisión de comprobantes.');
  });

  it('firma vencida no se reporta con días negativos', () => {
    const insights = buildOperationsInsights(emptyOperationsMetrics('pos'), {
      showCash: false,
      signature: { label: 'Vencida', tone: 'danger', missing: false, expired: true, daysLeft: -3 }
    });
    expect(insights.actions).toContain('Renovar la firma electrónica: el certificado está vencido.');
  });
});
