import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgSelectModule } from '@ng-select/ng-select';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { OnlyNumbersDirective } from 'src/app/core/directives/only-numbers.directive';
import { MenuService } from 'src/app/modules/layout/services/menu.service';
import { CategoryService } from 'src/app/services/category.service';
import { CustomersService } from 'src/app/services/customers.service';
import { OrdersService } from 'src/app/services/orders.service';
import { PaymentsService } from 'src/app/services/payments.service';
import { PrintService } from 'src/app/services/print.service';
import { ProductsService } from 'src/app/services/products.service';
import { environment } from '../../../environments/environment';
import { UtilsService } from '../../core/services/utils.service';
import { AlertService } from '../../core/services/alert.service';
import { filter, finalize } from 'rxjs';
import { ButtonComponent } from "src/app/shared/components/button/button.component";

@Component({
  selector: 'app-pos',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FontAwesomeModule, NgSelectModule, OnlyNumbersDirective, ButtonComponent],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.css'
})

export class PosComponent implements OnInit {
  ambiente: string = '';

  private apiUrl = environment.apiUrl; // Reemplaza con tu URL de API real
  showPaymentModal: boolean = false;
  amountReceived: number | null = null;
  change: number = 0;

  products: any = [];
  filteredProductList: any[] = [];

  categories: any = [];
  payments: any = [];

  identificationCustomer: string = '';
  customer: any = null;
  alias: string = '';
  cart: any[] = [];
  searchTerm: string = '';
  selectedCategory = '';
  //categories = ['Entrada', 'Sopas', 'Adicionales', 'Bebidas', 'Postres', 'Platos_Fuertes', 'Burguers'];
  orderType: 'Servirse' | 'Llevar' | 'Domicilio' = 'Servirse';
  deliveryAddress: string = '';
  deliveryPhone: string = '';

  paymentMethod: string = '01';

  showCustomerModal = false;

  showPrintModal = false;
  printOption: 'comanda' | 'factura' | 'ambas' = 'ambas';
  private pendingOrderId: string | null = null;

  submitted = false;
  clienteForm!: FormGroup;

  today: any;

  private url = environment.URL
  constructor(public menuService: MenuService,
    private customersService: CustomersService,
    private productsService: ProductsService,
    private categoryService: CategoryService,
    private paymentsService: PaymentsService,
    private fb: FormBuilder,
    private ordersService: OrdersService,
    private spinner: NgxSpinnerService,
    private printService: PrintService,
    private utilsService: UtilsService,
    private alertService: AlertService
  ) { }

  ngOnInit(): void {



    const ambienteGuardado = localStorage.getItem('ambiente');
    console.log('📦ambienteGuardado', ambienteGuardado);
    this.ambiente = ambienteGuardado ?? '----------';
    // this.utilsService.ambiente$.subscribe(valor => {
    //   this.ambiente = valor;
    //   console.log('Ambiente actualizado:', valor);
    // });
    const fechaEcuador = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' })
    );
    console.log('📦fechaEcuador', fechaEcuador);

    this.today = fechaEcuador.toISOString();
    console.log('📦this.today', this.today);


    console.log('entro');
    this.clienteForm = this.fb.group({
      nombre: ['', [Validators.required]],
      num_identificacion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(13)]],
      tipo_identificacion: ['05 - Cédula', [Validators.required]],
      correo: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required]],
      direccion: ['', [Validators.required]],
    });

    //this.toggleSidebar();

    this.loadProducts();
    this.loadCategory();
    this.loadMethodPayment();

    // Agrega la validación personalizada
    this.clienteForm.get('tipo_identificacion')?.valueChanges.subscribe(() => {
      this.clienteForm.patchValue({ num_identificacion: null });
      this.clienteForm.get('num_identificacion')?.updateValueAndValidity();
    });

    this.clienteForm.get('num_identificacion')?.setValidators([
      Validators.required,
      this.identificacionLengthValidator()
    ]);

  }
  setItemType(item: any, tipo: 'Servirse' | 'Llevar') {
    item.tipo = tipo;
    // si tienes recargos (empaque o delivery por ítem), actualiza aquí:
    // item.fee = tipo === 'Llevar' ? this.packagingFeePerItem : tipo === 'Domicilio' ? this.deliveryFeePerItem : 0;

  }
  public toggleSidebar() {
    this.menuService.toggleSidebar();
  }
  get f() {
    return this.clienteForm.controls;
  }

  setOrderType(tipo: 'Servirse' | 'Llevar' | 'Domicilio') {
    this.orderType = tipo;
  }
  loadProducts() {
    this.spinner.show();
    this.productsService.getAll(1).subscribe((res: any) => {
      this.spinner.hide();
      this.products = res.message.data || [];

      console.log('Productos cargados:', this.products);
      this.applyFilters(); // 🔥 Actualiza lista filtrada
    });
  }

  loadCategory() {
    this.spinner.show();
    this.categoryService.getAll().subscribe((res: any) => {
      this.spinner.hide();
      this.categories = res.message.data || [];
      console.log(' this.categories', this.categories);
    });
  }

  loadMethodPayment() {
    this.spinner.show();
    this.paymentsService.getAll().subscribe((res: any) => {
      this.spinner.hide();
      this.payments = res || [];
      console.log(' this.payments', this.payments);
    });
  }

  findByIdentificationCustomer(): void {
    const identification = this.identificationCustomer?.trim();
    console.log('identification', this.identificationCustomer);

    if (!identification || (identification.length !== 10 && identification.length !== 13)) {
      toast.warning('La identificación debe tener 10 o 13 digitos.');
      return;
    }

    this.spinner.show();
    this.customersService.get_cliente_by_identificacion(identification).subscribe({
      next: (res) => {
        this.customer = res.message;
        console.log('Cliente encontrado:', res);
      },
      error: (err) => {
        console.error('Error al buscar cliente:', err);
        this.customer = null;
        let tipo_identificacion = '';
        if (this.identificationCustomer.length === 10) {
          tipo_identificacion = '05 - Cedula';
        } else if (this.identificationCustomer.length === 13) {
          tipo_identificacion = '04 - RUC';


        }
        this.clienteForm.patchValue({ identification: this.identificationCustomer, tipo_identificacion: tipo_identificacion });
        //this.identificationCustomer = '';
        this.showCustomerModal = true;
        this.clienteForm.patchValue({
          num_identificacion: this.identificationCustomer,
        });
        toast.error('Cliente no encontrado con esa identificación');
        this.spinner.hide();
      },
      complete: () => {
        this.spinner.hide();
      }
    });
  }


  selectFinalConsumer() {
    this.identificationCustomer = '9999999999999';

    console.log('this.identificationCustomer', this.identificationCustomer);
    this.findByIdentificationCustomer();

  }
  guardarCliente() {
    this.submitted = true;
    console.log('this.clienteForm', this.clienteForm);

    if (this.clienteForm.invalid) {
      return;
    }

    this.customersService.create(this.clienteForm.getRawValue()).subscribe({
      next: (res) => {
        console.log('Cliente creado:', res);
        toast.success('Cliente creado exitosamente');
        this.cerrarModal();
        this.customer = res.message.data;
        this.identificationCustomer = this.customer.num_identificacion;
      },
      error: (err) => {
        // Manejo de error específico de Frappe
        if (err.error && err.error._server_messages) {
          try {
            const messages = JSON.parse(err.error._server_messages);
            const mensaje = JSON.parse(messages[0]);
            const mensajeLimpio = this.stripHtml(mensaje.message);
            toast.error('Error: ' + mensajeLimpio); // Mostrar mensaje sin HTML
          } catch (e) {
            toast.error('Ocurrió un error al procesar la respuesta del servidor.');
            console.error('Error al parsear mensaje del servidor:', e);
          }
        } else if (err.error && err.error.message) {
          toast.error('Error: ' + err.error.message);
        } else {
          toast.error('Error desconocido al crear el cliente.');
        }

        console.error('Error al crear cliente:', err);
      }
    });
  }

  // Función para eliminar etiquetas HTML del mensaje
  stripHtml(html: string): string {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }



applyFilters() {
  const term = this.normalize(this.searchTerm);
  const selectedCat = this.normalize(this.selectedCategory);
  console.log('selectedCat', selectedCat);

  console.log('term', term);

  this.filteredProductList = (this.products || []).filter((product: any) => {
    // categoría del producto (tolerante a distintas formas)
    const prodCat = this.normalize(this.getProductCategoryName(product));
    const okCat = !selectedCat || prodCat === selectedCat;

    if (!term) return okCat;

    // nombres/desc posibles (name/nombre, description/descripcion)
    const name = this.normalize(product?.nombre);
    console.log('name', name);
    console.log('term', term);

    const desc = this.normalize(product?.description ?? product?.descripcion);
console.log('desc', desc);
    const okText = name.includes(term) || desc.includes(term);
    return okCat && okText;
  });
  console.log('filteredProductList', this.filteredProductList);
}



  addProduct(product: any) {
    const existing = this.cart.find(i => i.name === product.name);

    const price = this.toNumber(product.precio ?? product.price);
    const taxValue = this.getTaxPercent(product); // 0 o 15

    if (existing) {
      existing.quantity++;
      this.recalcItem(existing);
    } else {
      const newItem = {
        ...product,
        price,
        quantity: 1,
        tax_value: taxValue // en porcentaje (0 o 15) para backend
      };
      this.recalcItem(newItem);
      this.cart.push(newItem);
    }
  }

  increase(item: any) {
    item.quantity++;
    this.recalcItem(item);
  }

  decrease(item: any) {
    if (item.quantity > 1) {
      item.quantity--;
      this.recalcItem(item);
    } else {
      const i = this.cart.indexOf(item);
      if (i !== -1) this.cart.splice(i, 1);
    }
  }




  get subtotal(): number {
    return this.round2(this.cart.reduce((acc, it) => acc + this.toNumber(it.subtotal), 0));
  }

  get iva(): number {
    return this.round2(this.cart.reduce((acc, it) => acc + this.toNumber(it.iva), 0));
  }

  get total(): number {
    return this.round2(this.cart.reduce((acc, it) => acc + this.toNumber(it.total), 0));
  }



  // finalizarVenta() {
  //   if (!this.identificationCustomer || this.cart.length === 0) {
  //     alert('Selecciona un cliente y agrega productos al carrito.');
  //     return;
  //   }

  //   const order = {
  //     customerId: this.customer.id,
  //     items: this.cart.map(item => ({
  //       productId: item.id,
  //       quantity: item.quantity
  //     })),
  //     type: 'nota', // Solo guardamos como "nota"
  //     createdAt: this.today
  //   };

  //   console.log('order', order);

  //   this.ordersService.create(order).subscribe(() => {

  //   });

  //   this.ordersService.create(order).subscribe({
  //     next: (res) => {
  //       alert('Pedido guardado exitosamente. Puedes facturarlo más tarde.');
  //       this.customer = null;
  //       this.identificationCustomer = '';
  //       this.cart = [];
  //     },
  //     error: (err) => {
  //       console.error(err);
  //       alert('Ocurrió un error al guardar el pedido.');
  //     }
  //   });
  // }


  // Método para abrir el modal
  abrirModalPago() {
    if (!this.customer) {
      toast.error('Selecciona un cliente.');
      this.identificationCustomer = '';

      return;
    }
    if (this.cart.length === 0) {
      toast.error('Agrega productos al carrito.');
      return;
    }

    this.amountReceived = null;
    this.change = 0;
    this.showPaymentModal = true;
  }

calcularCambio() {
  if (this.paymentMethod === '01') {
    const recibido = Number(this.amountReceived);
    if (Number.isFinite(recibido)) {
      this.change = recibido - this.total;
    } else {
      this.change = 0;
    }
  }
}


  confirmarPago(typePago: string) {
    console.log('this.paymentMethod', this.paymentMethod);
    console.log('this.amountReceived', this.amountReceived);
    console.log('this.change', this.change);
    console.log('this.cart', this.cart);
    const payment = this.payments.find((p: any) => p.codigo === this.paymentMethod);
    console.log('paymentCode', payment);
    console.log('this.client', this.customer);

    const TYPE_IDENTIFICATION_RUC = "07 - Consumidor Final";
    const UMBRAL = 50;

    const isConsumidorFinal = this.customer?.tipo_identificacion === TYPE_IDENTIFICATION_RUC;
    const total = Number(this.total); // asegúrate que es número


    if (isConsumidorFinal && typePago === 'Factura' && total >= UMBRAL) {
      toast.error(`El consumidor final no puede facturar por un monto mayor o igual a $${UMBRAL}.`);
      return;
    }


    // if (this.paymentMethod === '01' && (this.amountReceived === null || this.change < 0)) {
    //   toast.warning('Monto recibido insuficiente.');
    //   return;
    // }

    const order = {
      customer: this.customer?.name,
      alias: this.alias, // o this.customer?.id si estás usando el ID
      estado: typePago,
      total: this.total.toFixed(2),
      type_orden: this.orderType,
      delivery_address: this.deliveryAddress,
      delivery_phone: this.deliveryPhone,
      fecha: this.today,
      items: this.cart.map(item => ({
        product: item.name, // Asegúrate que sea el código tipo "PROD-0012"
        qty: item.quantity,
        rate: item.price, // o item.precio si ese es el campo
        tax_rate: item.tax_value
      })),
      payments: [
        {
          formas_de_pago: payment?.name, // Esto es importante
        }
      ]
    };



    if (typePago === 'Factura') {
      this.alertService.confirm('¿Deseas continuar con la factura?', 'Esta acción no se puede deshacer.').then((result) => {
        if (result.isConfirmed) {
          console.log('Confirmado');
          this.spinner.show();
          this.ordersService.create_order_v2(order).pipe(finalize(() => this.spinner.hide()))
            .subscribe({
              next: (res: any) => {
                console.log('Pedido guardado:', res);
                const orderId = res.message?.name; // Asegúrate de que el ID del pedido se obtenga correctamente
                this.pendingOrderId = orderId;
                this.spinner.hide();
                console.log('orderId', orderId);
                toast.success(`Pedido guardado. ${this.paymentMethod === '01' ? 'Cambio: $' + this.change.toFixed(2) : ''}`);
                // setTimeout(() => this.printCombinedTicket(orderId), 500);
                this.openPrintModal(orderId);
              },
              error: (err) => {
                this.spinner.hide()

              },
              complete: () => {
                this.spinner.hide();
              }
            }
            );

        } else {
          console.log('Cancelado');
        }
      });

      return
    }
    this.spinner.show();
    this.ordersService.create_order_v2(order).subscribe({
      next: (res) => {
        console.log('Pedido guardado:', res);
        const orderId = res.message?.name; // Asegúrate de que el ID del pedido se obtenga correctamente
         this.pendingOrderId = orderId;
         console.log('orderId', orderId);
        this.spinner.hide();
        toast.success(`Pedido guardado. ${this.paymentMethod === '01' ? 'Cambio: $' + this.change.toFixed(2) : ''}`);
        // setTimeout(() => this.printCombinedTicket(orderId), 500);
        this.openPrintModal(orderId);
      },
      error: () => {
        this.spinner.hide();
        toast.error('Error al guardar el pedido.');
      }
    });

  };


  showKitchenTicket = false;
  showReceipt = false;

  printCombinedTicket(orderId: string) {
    // const order = 'http://207.180.197.160:1012' + this.printService.getOrderPdf(orderId);
    const order = this.url + this.printService.getOrderPdf(orderId);
    console.log('order', order);
    const width = 800;
    const height = 800;

    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'toolbar=no',
      'location=no',
      'directories=no',
      'status=no',
      'menubar=no',
      'scrollbars=yes',
      'resizable=yes',
    ];

    const printWindow = window.open(order, '_blank', features.join(','));

    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }


    // printWindow.document.open();
    // printWindow.document.close();

    // Limpieza final del estado del POS
    this.clearPage();
  }

  printComanda(orderId: string) {
    // const order = 'http://207.180.197.160:1012' + this.printService.getOrderPdf(orderId);
    const order = this.url + this.printService.getComanda(orderId);
    console.log('order', order);
    const width = 800;
    const height = 800;

    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'toolbar=no',
      'location=no',
      'directories=no',
      'status=no',
      'menubar=no',
      'scrollbars=yes',
      'resizable=yes',
    ];

    const printWindow = window.open(order, '_blank', features.join(','));

    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }


    // printWindow.document.open();
    // printWindow.document.close();

    // Limpieza final del estado del POS
    this.clearPage();
  }

  printOrden(orderId: string) {
    // const order = 'http://207.180.197.160:1012' + this.printService.getOrderPdf(orderId);
    const order = this.url + this.printService.getRecibo(orderId);
    console.log('order', order);
    const width = 800;
    const height = 800;

    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'toolbar=no',
      'location=no',
      'directories=no',
      'status=no',
      'menubar=no',
      'scrollbars=yes',
      'resizable=yes',
    ];

    const printWindow = window.open(order, '_blank', features.join(','));

    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }


    // printWindow.document.open();
    // printWindow.document.close();

    // Limpieza final del estado del POS
    this.clearPage();
  }

  onCategorySelected(category: string) {
    this.selectedCategory = category;
    this.applyFilters();
  }

  onSearchTermChanged(term: string) {
    this.searchTerm = term;
    this.applyFilters();
  }

  cerrarModal() {
    this.showCustomerModal = false;
    this.submitted = false;
    this.clienteForm.reset();
  }

  clearPage() {
    this.cart = [];
    this.customer = null;
    this.alias = '';
    this.identificationCustomer = '';
    this.amountReceived = null;
    this.change = 0;
    this.showPaymentModal = false;
    this.showReceipt = false;
    this.showKitchenTicket = false;
    this.orderType = 'Servirse';
    this.deliveryAddress = '';
    this.deliveryPhone = '';
    this.searchTerm = '';
    this.onCategorySelected('');
  }

  identificacionLengthValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const tipo = this.clienteForm?.get('tipo_identificacion')?.value;
      const valor = control.value;
      console.log('tipo', tipo);
      console.log('valor', valor);

      if (!valor) return null;
      if (tipo.slice(0, 2) === '05' && valor?.length !== 10) {
        return { cedulaInvalida: true };
      }

      if (tipo.slice(0, 2) === '04' && valor?.length !== 13) {
        return { rucInvalido: true };
      }

      return null; // válido
    };
  }

  getMaxLength(): number {
    const tipo = this.clienteForm?.get('tipo_identificacion')?.value;
    if (tipo?.slice(0, 2) === '05') {
      return 10; // cédula
    }
    return 13; // RUC u otros
  }

  private toNumber(v: any): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /** Devuelve el % de IVA (0, 15, etc) desde el producto */
  private getTaxPercent(p: any): number {
    // prioriza tax_value; si no, intenta tax.value; si no, tax
    const v = Number(p?.tax_value ?? p?.tax?.value ?? p?.tax ?? 0);
    return Number.isFinite(v) ? v : 0;
  }

  /** Recalcula subtotal, iva y total de un ítem del carrito */
  private recalcItem(item: any): void {
    const qty = this.toNumber(item.quantity);
    const price = this.toNumber(item.price);
    const taxRate = this.toNumber(item.tax_value) / 100; // 0.15 si 15%
    const subtotal = this.round2(qty * price);
    const iva = this.round2(subtotal * taxRate);
    item.subtotal = subtotal;
    item.iva = iva;
    item.total = this.round2(subtotal + iva);
  }

  // Abre el modal después de crear el pedido
  openPrintModal(orderId: string) {
    this.pendingOrderId = orderId;
    this.printOption = 'ambas'; // valor por defecto
    this.showPrintModal = true;
  }

handlePrintSelection(option: 'comanda' | 'recibo' | 'ambas') {
  if (!this.pendingOrderId) return;

  switch (option) {
    case 'comanda':
      this.printComanda(this.pendingOrderId);
      break;
    case 'recibo':
      this.printOrden(this.pendingOrderId);
      break;
    case 'ambas':
      this.printCombinedTicket(this.pendingOrderId);
      break;
  }

  this.showPrintModal = false;
  this.pendingOrderId = null;
}


closePrintModal() {
  this.showPrintModal = false;
  this.pendingOrderId = null;
  this.clearPage();
}
/** Normaliza texto: sin tildes, en minúsculas y trim */
private normalize(txt: any = ''): string {
  return String(txt ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Obtiene el nombre de categoría del producto, tolerando distintas estructuras */
private getProductCategoryName(p: any): string {
  return (
    p?.categoria ||
    p?.category?.name ||
    p?.category?.nombre ||
    ''
  );
}
trackByProductId = (_: number, p: any) => p?.id || p?._id || p?.codigo || p?.name || p?.nombre;


}