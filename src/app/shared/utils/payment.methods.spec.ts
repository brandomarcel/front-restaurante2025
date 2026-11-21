import { isPaymentMethodAlreadySelected, paymentMethodKey } from './payment.utils';

describe('payment.utils — formas con código SRI compartido', () => {
  const methods = [
    { name: 'CASH', nombre: 'Efectivo', codigo: '01' },
    { name: 'DEBIT_CARD', nombre: 'Tarjeta de débito', codigo: '16' },
    { name: 'CARD', nombre: 'Tarjeta de crédito', codigo: '19' },
    { name: 'TRANSFER', nombre: 'Transferencia o depósito', codigo: '20' },
    { name: 'CHECK', nombre: 'Cheque', codigo: '20' }
  ];

  it('transferencia y cheque (ambos 20) tienen llaves distintas', () => {
    expect(paymentMethodKey(methods, 'TRANSFER')).not.toBe(paymentMethodKey(methods, 'CHECK'));
  });

  it('TRANSFER en una fila no bloquea CHECK en otra', () => {
    const rows = [{ method: 'TRANSFER' }, { method: '' }];
    expect(isPaymentMethodAlreadySelected(methods, rows, 'CHECK', 1)).toBeFalse();
  });

  it('TRANSFER dos veces sí se bloquea', () => {
    const rows = [{ method: 'TRANSFER' }, { method: '' }];
    expect(isPaymentMethodAlreadySelected(methods, rows, 'TRANSFER', 1)).toBeTrue();
  });

  it('la misma fila no se bloquea a sí misma', () => {
    expect(isPaymentMethodAlreadySelected(methods, [{ method: 'CHECK' }], 'CHECK', 0)).toBeFalse();
  });

  it('una opción sin name cae al código', () => {
    const sinName = [{ codigo: '20', nombre: 'Algo' }];
    expect(paymentMethodKey(sinName, '20')).toBe('code:20');
  });
});
