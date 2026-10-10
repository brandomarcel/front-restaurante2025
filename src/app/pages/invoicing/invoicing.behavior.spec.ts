import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faTrash, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import { NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { of, throwError } from 'rxjs';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { UtilsService } from 'src/app/core/services/utils.service';
import { CustomersService } from 'src/app/services/customers.service';
import { InvoiceCollectionsService } from 'src/app/services/invoice-collections.service';
import { InvoicesService } from 'src/app/services/invoices.service';
import { PaymentsService } from 'src/app/services/payments.service';
import { PrintService } from 'src/app/services/print.service';
import { ProductsService } from 'src/app/services/products.service';
import { InvoicingComponent } from './invoicing.component';

/** Caracterización de Facturación: reglas que el rediseño no debe cambiar. */
describe('Facturación — reglas de emisión', () => {
  let fixture: ComponentFixture<InvoicingComponent>;
  let component: InvoicingComponent;
  let invoices: any;
  let customers: any;
  let alert: any;
  let collections: any;
  let saved: Record<string, string>;

  const agua = { name: 'AGUA', nombre: 'AGUA 500ML', codigo: 'A1', precio: 1, tax_value: 15, isactive: 1, controlar_inventario: 1, stock_actual: 2 };
  const servicio = { name: 'SERV', nombre: 'SERVICIO', codigo: 'S1', precio: 40, tax_value: 0, isactive: 1 };
  const agotado = { name: 'OFF', nombre: 'AGOTADO', codigo: 'X', precio: 5, isactive: 1, controlar_inventario: 1, stock_actual: 0 };
  const ana = { name: 'CUST-ANA', nombre: 'ANA', num_identificacion: '0912345678', correo: 'ana@x.com' };
  const finalConsumer = { name: 'CUST-CF', nombre: 'CONSUMIDOR FINAL', num_identificacion: '9999999999999' };

  beforeEach(() => {
    saved = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; saved[k] = localStorage.getItem(k)!; }
    localStorage.clear();
    localStorage.setItem('active_business', 'BIZ-1');
    localStorage.setItem('company_capabilities', JSON.stringify({
      features: { billing: true, direct_invoice: true, pos_terminal: false },
      permissions: { '*': true },
      business: { name: 'BIZ-1', environment: 'Pruebas' }, businesses: [{ name: 'BIZ-1' }],
      establishments: [{ name: 'EST-1', business: 'BIZ-1', establishment_code: '001', status: 'Activo' }],
      emissionPoints: [{ name: 'PT-1', business: 'BIZ-1', establishment: 'EST-1', emission_point_code: '002', status: 'Activo' }],
      sequences: [{ name: 'SEQ', business: 'BIZ-1', establishment: 'EST-1', emission_point: 'PT-1', document_type: 'Factura', environment: 'Pruebas', status: 'Activo' }],
      loaded: true
    }));
    spyOn(toast, 'error');
    spyOn(toast, 'warning');
    spyOn(toast, 'success');
    spyOn(toast, 'info');

    invoices = { create_and_emit_from_ui_v2: jasmine.createSpy('emit').and.returnValue(of({ state: 'PROCESSING', invoiceName: 'INV-1', messages: [] })) };
    customers = {
      searchClientes: jasmine.createSpy('search').and.returnValue(of([])),
      get_cliente_by_identificacion: jasmine.createSpy('byId').and.callFake((id: string) =>
        id === '9999999999999' ? of({ message: finalConsumer }) : throwError(() => ({ status: 404 }))),
      create: jasmine.createSpy('create').and.returnValue(of({ message: ana }))
    };
    alert = { confirm: jasmine.createSpy('confirm').and.returnValue(Promise.resolve({ isConfirmed: true })), error: () => undefined, success: () => undefined };
    collections = { getCurrentCashOpening: jasmine.createSpy('cash').and.returnValue(of({})) };

    TestBed.configureTestingModule({
      imports: [InvoicingComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: CustomersService, useValue: customers },
        { provide: ProductsService, useValue: { getAll: () => of({ message: { data: [agua, servicio, agotado] } }) } },
        { provide: PaymentsService, useValue: { getAll: () => of([{ name: 'EFECTIVO', codigo: '01', nombre: 'Efectivo' }, { name: 'TRANSFER', codigo: '20', nombre: 'Transferencia' }]) } },
        { provide: PrintService, useValue: { getFacturaPdf: () => '', getSalesInvoiceTicket: () => '' } },
        { provide: NgxSpinnerService, useValue: { show: () => undefined, hide: () => undefined } },
        { provide: AlertService, useValue: alert },
        { provide: InvoicesService, useValue: invoices },
        { provide: InvoiceCollectionsService, useValue: collections },
        { provide: UtilsService, useValue: { getSoloFechaEcuador: () => '2026-10-09' } }
      ]
    });
    TestBed.inject(FaIconLibrary).addIcons(faTrash, faUserPlus);
    spyOn(TestBed.inject(CompanyCapabilitiesService), 'getPlanBlockMessage').and.returnValue(null);
    fixture = TestBed.createComponent(InvoicingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    Object.entries(saved).forEach(([k, v]) => localStorage.setItem(k, v));
  });

  function addProduct(product: any, times = 1): void {
    for (let i = 0; i < times; i++) component.addProductToCart(product);
  }

  it('selecciona Consumidor Final por su identificación', () => {
    component.selectFinalConsumer();
    expect(customers.get_cliente_by_identificacion).toHaveBeenCalledWith('9999999999999');
    expect(component.selectedCustomer?.name).toBe('CUST-CF');
    expect(component.invoiceForm.get('selectedCustomer')?.value).toBe('CUST-CF');
  });

  it('si la identificación no existe abre el alta con el tipo según su longitud', () => {
    component.onCustomerSearchChange('0999999999001');
    component.searchCustomerFromInput();
    expect(component.showCustomerModal).toBeTrue();
    expect(component.customerForm.get('tipo_identificacion')?.value).toBe('04 - RUC');
    expect(component.customerForm.get('num_identificacion')?.value).toBe('0999999999001');
  });

  it('no agrega productos agotados y limita la cantidad al stock', () => {
    addProduct(agotado);
    expect(component.cartItems.length).toBe(0);
    addProduct(agua, 3);
    expect(component.cartItems[0].quantity).toBe(2);
    component.cartItems[0].quantity = 9;
    component.onCartQuantityChange(0);
    expect(component.cartItems[0].quantity).toBe(2);
  });

  it('calcula IVA y total por línea con descuentos', () => {
    addProduct(servicio);
    addProduct(agua);
    component.cartItems[0].discount_percentage = 10;
    component.updateCartTotals();
    expect(component.subtotal).toBe(37);
    expect(component.iva).toBe(0.15);
    expect(component.total).toBe(37.15);
    expect(component.totalDiscount).toBe(4);
  });

  it('bloquea factura a Consumidor Final mayor a $50', () => {
    component.selectFinalConsumer();
    addProduct(servicio, 2);
    component.finalizeInvoice();
    expect(toast.error).toHaveBeenCalledWith(jasmine.stringMatching('CONSUMIDOR FINAL'));
    expect(alert.confirm).not.toHaveBeenCalled();
  });

  it('a crédito exige fecha de vencimiento y valida el abono inicial', () => {
    component.selectCustomer(ana as any);
    addProduct(servicio);
    component.invoiceForm.patchValue({ payment_condition: 'Credito' });
    component.onPaymentConditionChange();
    component.finalizeInvoice();
    expect(alert.confirm).not.toHaveBeenCalled();
    component.invoiceForm.patchValue({ payment_due_date: '2026-11-01', initial_collection_amount: 10 });
    component.finalizeInvoice();
    expect(toast.error).toHaveBeenCalledWith('El abono inicial requiere método de pago y monto mayor a cero.');
    component.invoiceForm.patchValue({ initial_collection_method: 'TRANSFER', initial_collection_amount: 99 });
    component.finalizeInvoice();
    expect(toast.error).toHaveBeenCalledWith('El abono inicial no puede ser mayor al total de la factura.');
    expect(alert.confirm).not.toHaveBeenCalled();
  });

  it('emite con el cliente, la ubicación fiscal, los ítems y el pago', async () => {
    component.selectCustomer(ana as any);
    addProduct(servicio);
    component.finalizeInvoice();
    await fixture.whenStable();
    const payload = invoices.create_and_emit_from_ui_v2.calls.mostRecent().args[0];
    expect(payload).toEqual(jasmine.objectContaining({
      customer: 'CUST-ANA', total: 40, business: 'BIZ-1', environment: 'Pruebas',
      establishment: 'EST-1', emission_point: 'PT-1', payment_condition: 'Contado', auto_queue: true
    }));
    expect(payload.items).toEqual([jasmine.objectContaining({ item: 'SERV', item_code: 'S1', qty: 1, rate: 40, tax_rate: 0 })]);
    expect(payload.payments.length).toBe(1);
    expect(component.emissionInvoiceName).toBe('INV-1');
  });

  it('el abono inicial en efectivo exige caja abierta', async () => {
    collections.getCurrentCashOpening.and.returnValue(throwError(() => ({ status: 404 })));
    component.selectCustomer(ana as any);
    addProduct(servicio);
    component.invoiceForm.patchValue({ payment_condition: 'Credito', payment_due_date: '2026-11-01', initial_collection_method: 'EFECTIVO', initial_collection_amount: 10 });
    component.onPaymentConditionChange();
    component.finalizeInvoice();
    await fixture.whenStable();
    expect(collections.getCurrentCashOpening).toHaveBeenCalled();
    expect(invoices.create_and_emit_from_ui_v2).not.toHaveBeenCalled();
  });

  // ---- Interfaz ----

  function text(): string {
    fixture.detectChanges();
    return fixture.nativeElement.textContent as string;
  }

  it('explica qué falta para emitir y se vacía cuando todo está listo', () => {
    expect(component.blockingReasons).toEqual(jasmine.arrayContaining(['Elige el cliente.', 'Agrega al menos un producto.']));
    expect(text()).toContain('Para emitir falta:');
    component.selectCustomer(ana as any);
    addProduct(servicio);
    expect(component.blockingReasons).toEqual([]);
    const submit: HTMLButtonElement = fixture.nativeElement.querySelector('button[type="submit"]');
    fixture.detectChanges();
    expect(submit.disabled).toBeFalse();
    expect(submit.textContent).toContain('Emitir factura de $40.00');
  });

  it('avisa antes de enviar que Consumidor Final supera el límite', () => {
    component.selectFinalConsumer();
    addProduct(servicio, 2);
    expect(component.finalConsumerOverLimit).toBeTrue();
    expect(text()).toContain('A Consumidor Final solo se puede facturar hasta $50.00');
  });

  it('con pagos divididos dice cuánto falta asignar', () => {
    component.selectCustomer(ana as any);
    addProduct(servicio);
    component.addPaymentRow();
    component.paymentRows[0].amount = 30;
    component.paymentRows[1].amount = 0;
    expect(component.blockingReasons).toContain('Falta asignar $10.00 en las formas de pago.');
  });

  it('muestra el ambiente de pruebas y que no tiene validez tributaria', () => {
    expect(text()).toContain('Pruebas · sin validez tributaria');
  });

  it('muestra al cliente elegido como tarjeta y avisa si no tiene correo', () => {
    component.selectCustomer({ name: 'C2', nombre: 'LUIS', num_identificacion: '0911111111' } as any);
    const content = text();
    expect(content).toContain('LUIS');
    expect(content).toContain('Sin correo registrado.');
    expect(fixture.nativeElement.querySelector('#customer-search')).toBeNull();
  });

  it('Esc cierra el alta de cliente', () => {
    component.openCustomerModalFromSearch();
    component.onEscape();
    expect(component.showCustomerModal).toBeFalse();
  });

  it('muestra el resultado de la emisión con acciones', async () => {
    component.selectCustomer(ana as any);
    addProduct(servicio);
    component.finalizeInvoice();
    await fixture.whenStable();
    const content = text();
    expect(content).toContain('Factura enviada. Autorización pendiente');
    expect(content).toContain('+ Nueva factura');
    expect(component.blockingReasons).toEqual([]);
  });

  it('con una sola serie posible la muestra sin pedir elegir', () => {
    expect(component.fiscalChoiceAvailable).toBeFalse();
    expect(component.selectedFiscalSeries).toBe('001-002');
    const content = text();
    expect(content).toContain('Serie 001-002');
    expect(content).not.toContain('¿Desde dónde facturas?');
  });
});

describe('Facturación — elegir dónde facturar', () => {
  let fixture: ComponentFixture<InvoicingComponent>;
  let component: InvoicingComponent;
  let saved: Record<string, string>;

  function setup(sequences: any[], permissions: any = { '*': true }): void {
    saved = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; saved[k] = localStorage.getItem(k)!; }
    localStorage.clear();
    localStorage.setItem('active_business', 'BIZ-1');
    localStorage.setItem('company_capabilities', JSON.stringify({
      features: { billing: true, direct_invoice: true, pos_terminal: false }, permissions,
      business: { name: 'BIZ-1', environment: 'Pruebas' }, businesses: [{ name: 'BIZ-1' }],
      establishments: [
        { name: 'EST-1', business: 'BIZ-1', establishment_code: '001', establishment_name: 'Matriz', status: 'Activo' },
        { name: 'EST-2', business: 'BIZ-1', establishment_code: '002', establishment_name: 'Sucursal', status: 'Activo' }
      ],
      emissionPoints: [
        { name: 'PT-1', business: 'BIZ-1', establishment: 'EST-1', emission_point_code: '001', status: 'Activo' },
        { name: 'PT-2', business: 'BIZ-1', establishment: 'EST-2', emission_point_code: '003', status: 'Activo' }
      ],
      sequences, loaded: true
    }));
    TestBed.configureTestingModule({
      imports: [InvoicingComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: CustomersService, useValue: { searchClientes: () => of([]) } },
        { provide: ProductsService, useValue: { getAll: () => of([]) } },
        { provide: PaymentsService, useValue: { getAll: () => of([{ name: 'EFECTIVO', codigo: '01', nombre: 'Efectivo' }]) } },
        { provide: PrintService, useValue: {} },
        { provide: NgxSpinnerService, useValue: { show: () => undefined, hide: () => undefined } },
        { provide: AlertService, useValue: {} },
        { provide: InvoicesService, useValue: {} },
        { provide: InvoiceCollectionsService, useValue: {} },
        { provide: UtilsService, useValue: { getSoloFechaEcuador: () => '2026-10-09' } }
      ]
    });
    TestBed.inject(FaIconLibrary).addIcons(faTrash, faUserPlus);
    fixture = TestBed.createComponent(InvoicingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  afterEach(() => {
    localStorage.clear();
    Object.entries(saved).forEach(([k, v]) => localStorage.setItem(k, v));
  });

  const seq = (est: string, pt: string) => ({ name: `SEQ-${pt}`, business: 'BIZ-1', establishment: est, emission_point: pt, document_type: 'Factura', environment: 'Pruebas', status: 'Activo' });

  it('con varias opciones pide elegir, resalta y luego confirma la serie', () => {
    setup([seq('EST-1', 'PT-1'), seq('EST-2', 'PT-2')]);
    let content = fixture.nativeElement.textContent as string;
    expect(component.fiscalChoiceAvailable).toBeTrue();
    expect(content).toContain('Elige desde dónde vas a facturar');
    expect(component.blockingReasons).toContain('Elige el establecimiento y el punto de emisión.');
    component.selectFiscalEstablishment('EST-2');
    fixture.detectChanges();
    content = fixture.nativeElement.textContent as string;
    expect(component.selectedFiscalSeries).toBe('002-003');
    expect(content).toContain('Facturarás con la serie 002-003');
    expect(component.blockingReasons).not.toContain('Elige el establecimiento y el punto de emisión.');
  });

  it('sin secuencias para el ambiente avisa y ofrece configurarlas', () => {
    setup([]);
    expect(component.noFiscalOptions).toBeTrue();
    const content = fixture.nativeElement.textContent as string;
    expect(content).toContain('No hay dónde facturar en Pruebas.');
    expect(content).toContain('Configurar secuencias');
  });

  it('un usuario sin configuración no ve el enlace', () => {
    setup([], { 'billing.create': true });
    expect(fixture.nativeElement.textContent).toContain('Pide a un administrador');
  });
});
