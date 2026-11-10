import { normalizeOperationsMetrics } from './operations-metrics';

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
    expect(metrics.topProducts).toEqual([{ name: 'Seco', count: 3, total: 30 }]);
    expect(metrics.cash).toEqual({
      isOpen: true,
      openingName: 'APE-0001',
      openingAmount: 20,
      withdrawals: 5,
      systemCash: 55,
      expectedCash: 55,
      paymentTotals: [{ method: 'Efectivo', code: '', amount: 40 }]
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
