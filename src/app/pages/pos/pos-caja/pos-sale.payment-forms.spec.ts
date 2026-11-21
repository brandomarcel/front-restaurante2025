import { mapLitePayment } from './pos-sale.rules';

/** Formas de pago con código SRI propio: efectivo 01, débito 16, crédito 19, transferencia/cheque 20. */
describe('mapLitePayment — formas de pago (débito y cheque)', () => {
  it('cheque por name/nombre/codigo y solo por descripción', () => {
    expect(mapLitePayment({ name: 'CHECK', nombre: 'Cheque', codigo: '20' })).toEqual({ payment_method: 'CHECK', payment_code: '20' });
    expect(mapLitePayment({ description: 'Cheque' })).toEqual({ payment_method: 'CHECK', payment_code: '20' });
  });

  it('tarjeta de débito por name, solo por código 16 y por descripción', () => {
    expect(mapLitePayment({ name: 'DEBIT_CARD', nombre: 'Tarjeta de débito', codigo: '16' })).toEqual({ payment_method: 'DEBIT_CARD', payment_code: '16' });
    expect(mapLitePayment({ payment_code: '16' })).toEqual({ payment_method: 'DEBIT_CARD', payment_code: '16' });
    expect(mapLitePayment({ description: 'Tarjeta de débito' })).toEqual({ payment_method: 'DEBIT_CARD', payment_code: '16' });
  });

  it('tarjeta de crédito y el nombre antiguo siguen en CARD/19', () => {
    expect(mapLitePayment({ name: 'CARD', nombre: 'Tarjeta de crédito', codigo: '19' })).toEqual({ payment_method: 'CARD', payment_code: '19' });
    expect(mapLitePayment({ description: 'Tarjeta de credito/debito' })).toEqual({ payment_method: 'CARD', payment_code: '19' });
  });

  it('transferencia, efectivo y el alias OTHER antiguo', () => {
    expect(mapLitePayment({ name: 'TRANSFER', nombre: 'Transferencia o depósito', codigo: '20' })).toEqual({ payment_method: 'TRANSFER', payment_code: '20' });
    expect(mapLitePayment({ name: 'CASH', nombre: 'Efectivo', codigo: '01' })).toEqual({ payment_method: 'CASH', payment_code: '01' });
    expect(mapLitePayment({ name: 'Otros', codigo: '01' })).toEqual({ payment_method: 'OTHER', payment_code: '01' });
  });
});
