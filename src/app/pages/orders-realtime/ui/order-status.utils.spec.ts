import {
  kitchenStage,
  orderStage,
  orderHeadline,
  orderTypeLabel,
  isInvoiced,
  orderAgeMinutes,
} from './order-status.utils';
import { OrderVM } from 'src/app/services/realtime-orders.service';

const order = (value: any) => value as OrderVM;
describe('Etapas y etiquetas de órdenes', () => {
  it('preparación domina una mezcla de platos listos y pendientes', () => {
    expect(
      kitchenStage(
        order({
          status: 'Ingresada',
          items: [{ kitchen_status: 'Listo' }, { kitchen_status: 'En preparación' }, { kitchen_status: 'Pendiente' }],
        }),
      ),
    ).toBe('PREP');
  });
  it('ignora platos anulados al decidir si el pedido está listo', () => {
    expect(
      kitchenStage(
        order({
          items: [{ kitchen_status: 'Cancelado' }, { kitchen_status: 'Listo' }, { kitchen_status: 'Entregado' }],
        }),
      ),
    ).toBe('READY');
  });
  it('un pendiente impide marcar todo como listo', () => {
    expect(kitchenStage(order({ items: [{ kitchen_status: 'Listo' }, { kitchen_status: 'Pendiente' }] }))).toBe('NEW');
  });
  it('sin datos de platos usa el estado de la orden', () => {
    expect(kitchenStage(order({ status: 'Preparación' }))).toBe('PREP');
    expect(kitchenStage(order({ status: 'Lista' }))).toBe('READY');
    expect(orderStage('Lista')).toBe('ready');
    expect(orderStage('Cancelada')).toBe('cancelled');
  });
  it('identifica mesa y alias, luego cliente o consumidor final', () => {
    expect(orderHeadline(order({ tableName: 'Mesa 2', alias: 'Familia' }))).toBe('Mesa 2 (Familia)');
    expect(orderHeadline(order({ alias: 'Para recoger' }))).toBe('Para recoger');
    expect(orderHeadline(order({ customer: { nombre: 'Cliente' } }))).toBe('Cliente');
    expect(orderHeadline(null)).toBe('Consumidor final');
  });
  it('señala entrega y factura existente sin ofrecer un segundo cobro', () => {
    expect(orderTypeLabel(order({ orderType: 'A domicilio' }))).toBe('A domicilio');
    expect(orderTypeLabel(order({ orderType: 'Para llevar' }))).toBe('Para llevar');
    expect(isInvoiced(order({ sri: { invoice: 'TEST-INVOICE' } }))).toBeTrue();
    expect(isInvoiced(order({ sri: { status: 'Sin factura' } }))).toBeFalse();
  });
  it('no muestra tiempos negativos ni inválidos', () => {
    expect(orderAgeMinutes({ createdAt: 'invalid' } as any)).toBe(0);
    expect(orderAgeMinutes({ createdAtISO: '2026-11-08T12:00:00Z' } as any, Date.parse('2026-11-08T11:00:00Z'))).toBe(
      0,
    );
  });
});
