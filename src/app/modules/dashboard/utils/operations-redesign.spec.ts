import { averageTicket, cashBreakdown, emptyOperationsMetrics, productShares, soldCount } from './operations-metrics';

describe('Métricas del dashboard rediseñado', () => {
  it('restaurante divide venta entre cerradas; POS entre todas sus ventas', () => {
    const metrics = { ...emptyOperationsMetrics('restaurant'), ordersCount: 8, salesTotal: 90, ordersByStatus: { Cerrada: 3, Ingresada: 5 } };
    expect(soldCount(metrics)).toBe(3); expect(averageTicket(metrics)).toBe(30);
    metrics.kind = 'pos'; expect(soldCount(metrics)).toBe(8); expect(averageTicket(metrics)).toBe(11.25);
  });
  it('sin ventas no calcula infinito ni NaN', () => {
    expect(averageTicket(emptyOperationsMetrics('restaurant'))).toBe(0);
  });
  it('cuadre usa efectivo por código 01 y separa otros medios sin ceros', () => {
    const cash = { ...emptyOperationsMetrics('pos').cash, openingAmount: 10, withdrawals: 5, expectedCash: 35,
      paymentTotals: [{ method: 'Billetes', code: '01', amount: 30 }, { method: 'Tarjeta', code: '19', amount: 20 }, { method: 'Otro', code: '20', amount: 0 }] };
    expect(cashBreakdown(cash)).toEqual({ opening: 10, cashCollected: 30, withdrawals: 5, expected: 35, otherPayments: [{ method: 'Tarjeta', amount: 20 }], collectedTotal: 50 });
  });
  it('barras relativas ponen 100 al máximo y cero con catálogo sin ventas', () => {
    const products = [{ name: 'A', count: 4, total: 10 }, { name: 'B', count: 2, total: 5 }];
    expect(productShares(products).map(row => row.share)).toEqual([100, 50]);
    expect(productShares(products.map(row => ({ ...row, count: 0 }))).every(row => row.share === 0)).toBeTrue();
  });
});
