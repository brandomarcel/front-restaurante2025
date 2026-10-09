import { of, throwError } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CartService } from '../services/cart.service';
import { PosCajaComponent } from './pos-caja.component';

/**
 * Tests de caracterización del POS: fijan las reglas de venta, cobro y
 * emisión. Si alguno falla después de un cambio, el comportamiento cambió.
 */
describe('POS caja — reglas de venta', () => {
  let component: PosCajaComponent;
  let cart: CartService;
  let router: any;
  let alert: any;
  let invoices: any;
  let posSales: any;
  let orders: any;
  let collections: any;
  let permissions: string[];
  let planBlock: string | null;
  let terminalBlock: string | null;

  const customer = { name: 'CUST-1', nombre: 'Ana Pérez', num_identificacion: '0912345678', tipo_identificacion: '05 - Cedula' };
  const finalConsumer = { name: 'CF', nombre: 'Consumidor Final', num_identificacion: '9999999999999', tipo_identificacion: '07 - Consumidor Final' };
  const payments = [
    { name: 'Efectivo', codigo: '01', description: 'Efectivo' },
    { name: 'Tarjeta', codigo: '19', description: 'Tarjeta de crédito' },
    { name: 'Transferencia', codigo: '20', description: 'Transferencia' }
  ];
  const product = (overrides: any = {}) => ({ name: 'P-1', nombre: 'Camisa', codigo: 'CAM-1', precio: 10, tax_value: 15, ...overrides });

  function build(url = '/dashboard/pos-generic') {
    permissions = ['billing.create', 'billing.manage', 'billing.read'];
    planBlock = null;
    terminalBlock = null;
    cart = new CartService();
    router = { url, navigate: jasmine.createSpy('navigate') };
    alert = { confirm: jasmine.createSpy('confirm').and.returnValue(Promise.resolve({ isConfirmed: true })) };
    invoices = { create_and_emit_from_ui_v2: jasmine.createSpy('emit').and.returnValue(of({ message: { data: { name: 'FLINV-1' }, emission: { status: 'AUTHORIZED' } } })) };
    posSales = { create: jasmine.createSpy('create').and.returnValue(of({ data: { name: 'PSN-1', status: 'Borrador' } })) };
    orders = { create_order_v2: jasmine.createSpy('order').and.returnValue(of({ message: { data: { name: 'ORD-1' } } })) };
    collections = { getCurrentCashOpening: jasmine.createSpy('opening').and.returnValue(of({ message: { data: { name: 'APE-1' } } })) };
    const capabilities = {
      isEnabled: () => true,
      hasPermission: (key: string) => permissions.includes(key),
      canEmit: () => true,
      getPosTerminalBlockMessage: () => terminalBlock,
      getPlanBlockMessage: () => planBlock,
      activePosTerminal: { name: 'TERM-1' },
      activeBusinessId: 'BIZ-1',
      business: { tax_profile: { environment: 'Producción' } },
      features: { inventory: true }
    };
    const spinner = { show: () => undefined, hide: () => undefined };
    const products = { getAll: () => of([]) };
    component = new PosCajaComponent(
      {} as any, products as any, {} as any, {} as any,
      orders, posSales, invoices, collections, spinner as any, {} as any, cart, alert,
      capabilities as any, {} as any, router
    );
    (component as any).productVariantPicker = { clearCache: () => undefined };
    component.payments = payments;
    component.paymentRows = [{ method: 'Efectivo', amount: 0 }];
    component.customer = customer;
  }

  function addToCart(...items: any[]) {
    items.forEach((item) => cart.addProduct(item));
  }

  beforeEach(() => {
    spyOn(toast, 'error');
    spyOn(toast, 'success');
    spyOn(toast, 'info');
    spyOn(toast, 'warning');
    build();
  });

  describe('bloqueos antes de emitir', () => {
    it('no factura a Consumidor Final por más de USD 50', () => {
      component.customer = finalConsumer;
      addToCart(product({ precio: 50 })); // 50 + 15% IVA = 57.50
      component.confirmarPago('Factura');
      expect(toast.error).toHaveBeenCalledWith(jasmine.stringMatching('CONSUMIDOR FINAL'));
      expect(alert.confirm).not.toHaveBeenCalled();
    });

    it('sí factura a Consumidor Final hasta USD 50', async () => {
      component.customer = finalConsumer;
      addToCart(product({ precio: 40, tax_value: 0 }));
      component.confirmarPago('Factura');
      await Promise.resolve();
      expect(alert.confirm).toHaveBeenCalled();
    });

    it('no permite una nota de venta a crédito', () => {
      addToCart(product());
      component.paymentCondition = 'Credito';
      component.confirmarPago('Nota Venta');
      expect(toast.error).toHaveBeenCalledWith('Las ventas a crédito deben emitirse como factura.');
    });

    it('rechaza un efectivo recibido menor al monto en efectivo', () => {
      addToCart(product());
      component.amountReceived = 5;
      component.confirmarPago('Factura');
      expect(toast.error).toHaveBeenCalledWith('El monto recibido es menor al total.');
    });

    it('exige billing.create para facturar', () => {
      permissions = [];
      addToCart(product());
      component.confirmarPago('Factura');
      expect(toast.error).toHaveBeenCalledWith('No tiene permisos para emitir facturas.');
    });

    it('respeta el bloqueo del plan o de la terminal', () => {
      planBlock = 'Plan vencido';
      addToCart(product());
      component.confirmarPago('Factura');
      expect(toast.error).toHaveBeenCalledWith('Plan vencido');
    });

    it('no abre el cobro sin cliente o sin productos', () => {
      component.customer = null;
      component.abrirModalPago();
      expect(component.showPaymentModal).toBeFalse();
      component.customer = customer;
      component.abrirModalPago();
      expect(component.showPaymentModal).toBeFalse();
      addToCart(product());
      component.abrirModalPago();
      expect(component.showPaymentModal).toBeTrue();
      expect(component.paymentRows[0].amount).toBe(11.5);
    });
  });

  describe('POS genérico (Lite)', () => {
    it('emite la factura con el payload del contrato Lite', async () => {
      addToCart(product(), product({ name: 'P-2', nombre: 'Pantalón', codigo: 'PAN-1', precio: 20, tax_value: 0 }));
      component.confirmarPago('Factura');
      await Promise.resolve();
      expect(invoices.create_and_emit_from_ui_v2).toHaveBeenCalledTimes(1);
      const payload = invoices.create_and_emit_from_ui_v2.calls.mostRecent().args[0];
      expect(payload).toEqual(jasmine.objectContaining({
        business: 'BIZ-1',
        pos_terminal: 'TERM-1',
        customer: 'CUST-1',
        environment: 'Produccion',
        payment_condition: 'Contado',
        auto_queue: true,
        additional_fields: []
      }));
      expect(payload.items).toEqual([
        { item: 'P-1', item_code: 'CAM-1', qty: 1, rate: 10, discount_percentage: 0, discount_amount: 0, tax_rate: 15 },
        { item: 'P-2', item_code: 'PAN-1', qty: 1, rate: 20, discount_percentage: 0, discount_amount: 0, tax_rate: 0 }
      ]);
      expect(payload.payments).toEqual([{ payment_method: 'CASH', payment_code: '01', amount: 31.5, reference: '' }]);
      expect(payload.initial_collection).toBeUndefined();
    });

    it('abre la impresión con el nombre de factura devuelto y limpia la venta', async () => {
      addToCart(product());
      component.confirmarPago('Factura');
      await Promise.resolve();
      expect(component.showPrintModal).toBeTrue();
      expect(component.printContext).toBe('invoice');
      expect(cart.cart.length).toBe(0);
      expect(toast.success).toHaveBeenCalledWith('Factura autorizada por el SRI.');
    });

    it('avisa si la factura no devuelve identificador y no abre la impresión', async () => {
      invoices.create_and_emit_from_ui_v2.and.returnValue(of({ message: { data: {} } }));
      addToCart(product());
      component.confirmarPago('Factura');
      await Promise.resolve();
      expect(component.showPrintModal).toBeFalse();
      expect(toast.error).toHaveBeenCalled();
      expect(cart.cart.length).toBe(1);
    });

    it('guarda la nota de venta en borrador', async () => {
      addToCart(product());
      component.confirmarPago('Nota Venta');
      await Promise.resolve();
      expect(posSales.create).toHaveBeenCalledTimes(1);
      expect(invoices.create_and_emit_from_ui_v2).not.toHaveBeenCalled();
      expect(component.activePosSaleNote?.name).toBe('PSN-1');
    });

    it('en crédito con abono en efectivo exige caja abierta y la adjunta', async () => {
      addToCart(product());
      component.paymentCondition = 'Credito';
      component.initialCollectionAmount = 5;
      component.initialCollectionMethod = 'Efectivo';
      component.confirmarPago('Factura');
      await Promise.resolve();
      const payload = invoices.create_and_emit_from_ui_v2.calls.mostRecent().args[0];
      expect(payload.payment_condition).toBe('Credito');
      expect(payload.initial_collection).toEqual(jasmine.objectContaining({ payment_method: 'CASH', payment_code: '01', amount: 5, cash_opening: 'APE-1' }));
    });

    it('sin caja abierta no emite y lleva a la apertura', async () => {
      collections.getCurrentCashOpening.and.returnValue(throwError(() => ({ status: 404 })));
      addToCart(product());
      component.paymentCondition = 'Credito';
      component.initialCollectionAmount = 5;
      component.initialCollectionMethod = 'Efectivo';
      component.confirmarPago('Factura');
      await Promise.resolve();
      expect(invoices.create_and_emit_from_ui_v2).not.toHaveBeenCalled();
      expect(router.navigate).toHaveBeenCalledWith(['/caja/apertura']);
    });

    it('el abono inicial no puede superar el total', async () => {
      addToCart(product());
      component.paymentCondition = 'Credito';
      component.initialCollectionAmount = 100;
      component.initialCollectionMethod = 'Tarjeta';
      component.confirmarPago('Factura');
      await Promise.resolve();
      expect(toast.error).toHaveBeenCalledWith('El abono inicial no puede ser mayor al total de la factura.');
      expect(invoices.create_and_emit_from_ui_v2).not.toHaveBeenCalled();
    });
  });

  describe('POS restaurante', () => {
    beforeEach(() => build('/dashboard/pos'));

    it('factura a través de la orden, cerrándola, sin emitir una segunda factura', async () => {
      component.selectedTableId = 'MESA-1';
      addToCart(product());
      component.confirmarPago('Factura');
      await Promise.resolve();
      expect(orders.create_order_v2).toHaveBeenCalledTimes(1);
      expect(invoices.create_and_emit_from_ui_v2).not.toHaveBeenCalled();
      const payload = orders.create_order_v2.calls.mostRecent().args[0];
      expect(payload).toEqual(jasmine.objectContaining({ table: 'MESA-1', customer: 'CUST-1', estado: 'Factura', status: 'Cerrada', type_orden: 'Servirse', total: '11.50' }));
      expect(payload.items).toEqual([{ product: 'P-1', qty: 1, rate: 10, discount_percentage: 0, discount_amount: 0, tax_rate: 15 }]);
      expect(payload.payments).toEqual([{ formas_de_pago: 'Efectivo', monto: 11.5 }]);
      expect(router.navigate).toHaveBeenCalledWith(['/dashboard/orders', 'ORD-1']);
    });

    it('la nota de venta de restaurante deja la orden Ingresada sin pedir confirmación', () => {
      addToCart(product());
      component.confirmarPago('Nota Venta');
      expect(alert.confirm).not.toHaveBeenCalled();
      expect(orders.create_order_v2.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ estado: 'Nota Venta', status: 'Ingresada' }));
    });

    it('a domicilio exige dirección y teléfono', () => {
      addToCart(product());
      component.setOrderType('Domicilio');
      component.abrirModalPago();
      expect(component.showPaymentModal).toBeFalse();
      expect(toast.error).toHaveBeenCalledWith('Completa direccion y telefono para pedidos a domicilio.');
    });
  });

  describe('formas de pago Lite', () => {
    const map = (payment: any, fallback = '') => (component as any).mapLitePayment(payment, fallback);

    it('mapea cada forma de pago al par canónico del contrato', () => {
      expect(map({ name: 'Efectivo', codigo: '01' })).toEqual({ payment_method: 'CASH', payment_code: '01' });
      expect(map({ name: 'Otros', codigo: '01' })).toEqual({ payment_method: 'OTHER', payment_code: '01' });
      expect(map({ description: 'Tarjeta de débito' })).toEqual({ payment_method: 'CARD', payment_code: '19' });
      expect(map({ codigo: '20' })).toEqual({ payment_method: 'TRANSFER', payment_code: '20' });
      expect(map({ name: 'Depósito bancario' })).toEqual({ payment_method: 'TRANSFER', payment_code: '20' });
      expect(map({ name: 'Cheque' })).toBeNull();
    });
  });
});
