import {
  exceedsFinalConsumerLimit, extractCashOpeningName, extractOrderInvoice, isFinalConsumer,
  liteItemsFromCart, normalizeBackendEnvironment, orderItemsFromCart, readLiteInvoiceResponse
} from './pos-sale.rules';

describe('POS sale rules', () => {
  it('reconoce al Consumidor Final por tipo o por identificación', () => {
    expect(isFinalConsumer({ tipo_identificacion: '07 - Consumidor Final' })).toBeTrue();
    expect(isFinalConsumer({ identification_type: 'CONSUMIDOR FINAL' })).toBeTrue();
    expect(isFinalConsumer({ num_identificacion: '9999999999999' })).toBeTrue();
    expect(isFinalConsumer({ tipo_identificacion: '05 - Cedula', num_identificacion: '0912345678' })).toBeFalse();
  });

  it('solo bloquea facturas, no notas de venta, sobre el límite de Consumidor Final', () => {
    const cf = { num_identificacion: '9999999999999' };
    expect(exceedsFinalConsumerLimit(cf, 50, 'Factura')).toBeFalse();
    expect(exceedsFinalConsumerLimit(cf, 50.01, 'Factura')).toBeTrue();
    expect(exceedsFinalConsumerLimit(cf, 500, 'Nota Venta')).toBeFalse();
  });

  it('convierte el carrito en líneas de orden y en líneas Lite', () => {
    const cart = [{ name: 'P-1', codigo: 'C-1', quantity: 2, price: 5, tax_value: 15, discount_percentage: 10 }];
    expect(orderItemsFromCart(cart)).toEqual([{ product: 'P-1', qty: 2, rate: 5, discount_percentage: 10, discount_amount: 0, tax_rate: 15 }]);
    expect(liteItemsFromCart(cart)).toEqual([{ item: 'P-1', item_code: 'C-1', qty: 2, rate: 5, discount_percentage: 10, discount_amount: 0, tax_rate: 15 }]);
  });

  it('normaliza el ambiente del perfil tributario', () => {
    expect(normalizeBackendEnvironment('Producción')).toBe('Produccion');
    expect(normalizeBackendEnvironment('PRUEBAS')).toBe('Pruebas');
    expect(normalizeBackendEnvironment('test')).toBe('Pruebas');
    expect(normalizeBackendEnvironment(undefined)).toBe('');
  });

  it('lee la apertura de caja y la factura de la orden en sus distintas formas', () => {
    expect(extractCashOpeningName({ message: { data: { cash_opening: 'APE-1' } } })).toBe('APE-1');
    expect(extractCashOpeningName({ message: { data: { name: 'APE-2' } } })).toBe('APE-2');
    expect(extractCashOpeningName({ message: {} })).toBe('');
    expect(extractOrderInvoice({ message: { data: { invoice: { name: 'FAC-1' } } } })).toBe('FAC-1');
    expect(extractOrderInvoice({ data: { lite_invoice: 'FLINV-9' } })).toBe('FLINV-9');
    expect(extractOrderInvoice({})).toBeNull();
  });

  it('encuentra el nombre de la factura emitida en las variantes de respuesta', () => {
    expect(readLiteInvoiceResponse({ message: { data: { name: 'A' } } }).invoiceName).toBe('A');
    expect(readLiteInvoiceResponse({ invoiceName: 'B' }).invoiceName).toBe('B');
    expect(readLiteInvoiceResponse({ message: { data: { lite_invoice: { name: 'C' } } } }).invoiceName).toBe('C');
    expect(readLiteInvoiceResponse({ message: { emission: { invoice_name: 'D' } } }).invoiceName).toBe('D');
    expect(readLiteInvoiceResponse({ message: { data: {} } }).invoiceName).toBe('');
  });
});
