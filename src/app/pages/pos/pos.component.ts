import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { environment } from '../../../environments/environment.prod';

@Component({
  selector: 'app-pos',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FontAwesomeModule, NgSelectModule, OnlyNumbersDirective],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.css'
})

export class PosComponent implements OnInit {
  private apiUrl = 'http://207.180.197.160:1012/'; // Reemplaza con tu URL de API real
  showPaymentModal: boolean = false;
  amountReceived: number | null = null;
  change: number = 0;

  products: any = [];
  filteredProductList: any[] = [];

  categories: any = [];
  payments: any = [];

  identificationCustomer: string = '';
  customer: any = null;
  cart: any[] = [];
  searchTerm: string = '';
  selectedCategory = '';
  //categories = ['Entrada', 'Sopas', 'Adicionales', 'Bebidas', 'Postres', 'Platos_Fuertes', 'Burguers'];


  paymentMethod: string = '01';

  showCustomerModal = false;

  submitted = false;
  clienteForm!: FormGroup;

  today: any;
  constructor(public menuService: MenuService,
    private customersService: CustomersService,
    private productsService: ProductsService,
    private categoryService: CategoryService,
    private paymentsService: PaymentsService,
    private fb: FormBuilder,
    private ordersService: OrdersService,
    private spinner: NgxSpinnerService,
    private printService: PrintService
  ) { }

  ngOnInit(): void {
    const fechaEcuador = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' })
    );
    console.log('📦fechaEcuador', fechaEcuador);

    this.today = fechaEcuador.toISOString();
    console.log('📦this.today', this.today);


    console.log('entro');
    this.clienteForm = this.fb.group({
      nombre: ['', [Validators.required]],
      num_identificacion: ['', [Validators.required]],
      tipo_identificacion: ['04 - Cédula', [Validators.required]],
      correo: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required]],
      direccion: ['', [Validators.required]],
    });

    this.toggleSidebar();

    this.loadProducts();
    this.loadCategory();
    this.loadMethodPayment();
  }
  public toggleSidebar() {
    this.menuService.toggleSidebar();
  }
  get f() {
    return this.clienteForm.controls;
  }
  loadProducts() {
    this.spinner.show();
    this.productsService.getAll().subscribe((res: any) => {
      this.spinner.hide();
      this.products = res.data || [];
      this.applyFilters(); // 🔥 Actualiza lista filtrada
    });
  }

  loadCategory() {
    this.spinner.show();
    this.categoryService.getAll().subscribe((res: any) => {
      this.spinner.hide();
      this.categories = res.data || [];
      console.log(' this.categories', this.categories);
    });
  }

  loadMethodPayment() {
    this.spinner.show();
    this.paymentsService.getAll().subscribe((res: any) => {
      this.spinner.hide();
      this.payments = res.data || [];
      console.log(' this.payments', this.payments);
    });
  }

  findByIdentificationCustomer(): void {
    const identification = this.identificationCustomer?.trim();
    console.log('identification', this.identificationCustomer);

    if (!identification || (identification.length !== 10 && identification.length !== 13)) {
      toast.warning('La identificación debe tener 10');
      return;
    }

    this.spinner.show();
    this.customersService.findByIdentification(identification).subscribe({
      next: (res) => {
        this.customer = res.data;
        console.log('Cliente encontrado:', res);
      },
      error: (err) => {
        console.error('Error al buscar cliente:', err);
        this.customer = null;
        this.clienteForm.patchValue({ identification: this.identificationCustomer });
        this.identificationCustomer = '';
        toast.error('Cliente no encontrado con esa identificación');
        this.spinner.hide();
      },
      complete: () => {
        this.spinner.hide();
      }
    });
  }


  selectFinalConsumer() {
    this.identificationCustomer = '9999999999';

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
      this.customer = res;
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
    this.filteredProductList = this.products.filter((product: any) =>
      (!this.selectedCategory || product.categoria === this.selectedCategory) &&
      (!this.searchTerm || product.name.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }


  addProduct(product: any) {
    console.log('Producto agregado:', product);
    const item = this.cart.find(i => i.name === product.name);
    const price = parseFloat(product.precio);
    const tax = product.tax;

    if (item) {
      item.quantity++;
      item.total = item.quantity * price;
    } else {
      this.cart.push({
        ...product,
        price,
        tax,
        quantity: 1,
        total: price
      });
    }
  }


  increase(item: any) {
    item.quantity++;
    item.total = item.quantity * parseFloat(item.price);
  }

decrease(item: any) {
  if (item.quantity > 1) {
    item.quantity--;
    item.total = item.quantity * item.price;
  } else {
    const index = this.cart.indexOf(item);
    if (index !== -1) {
      this.cart.splice(index, 1);
    }
  }
}



  get subtotal(): number {
    return this.cart.reduce((acc, item) => {
      const price = Number(item.price);
      const quantity = Number(item.quantity);
      return acc + (price * quantity); // precio sin IVA
    }, 0);
  }

  get iva(): number {
    return this.cart.reduce((acc, item) => {
      const price = Number(item.price);
      const quantity = Number(item.quantity);
      let taxRate = 0;

      if (item.tax === 'IVA-15') {
        taxRate = 0.15;
      }

      return acc + (price * quantity * taxRate);
    }, 0);
  }


  get total(): number {
    return this.cart.reduce((acc, item) => acc + Number(item.total), 0);
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
    if (!this.identificationCustomer ) {
      toast.error('Selecciona un cliente.');
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
      if (!isNaN(recibido)) {
        this.change = recibido - this.total;
      }
    }
  }

  confirmarPago() {
    console.log('this.paymentMethod', this.paymentMethod);
    console.log('this.amountReceived', this.amountReceived);
    console.log('this.change', this.change);
    console.log('this.cart', this.cart);
    const payment = this.payments.find((p: any) => p.codigo === this.paymentMethod);
    console.log('paymentCode', payment);

    if (this.paymentMethod === '01' && (this.amountReceived === null || this.change < 0)) {
      toast.warning('Monto recibido insuficiente.');
      return;
    }

    const order = {
      customer: this.customer?.num_identificacion, // o this.customer?.id si estás usando el ID
      items: this.cart.map(item => ({
        product: item.name, // Asegúrate que sea el código tipo "PROD-0012"
        qty: item.quantity,
        rate: item.price // o item.precio si ese es el campo
      })),
      payments: [
        {
          formas_de_pago: payment?.name, // Esto es importante
        }
      ]
    };

    this.spinner.show();

    this.ordersService.create(order).subscribe({
      next: (res) => {
        console.log('Pedido guardado:', res);
        const orderId = res.data.name; // Asegúrate de que el ID del pedido se obtenga correctamente
        this.spinner.hide();
        toast.success(`Pedido guardado. ${this.paymentMethod === '01' ? 'Cambio: $' + this.change.toFixed(2) : ''}`);
        setTimeout(() => this.printCombinedTicket(orderId), 500);


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
    const order = this.apiUrl + this.printService.getOrderPdf(orderId);
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
    this.identificationCustomer = '';
    this.amountReceived = null;
    this.change = 0;
    this.showPaymentModal = false;
    this.showReceipt = false;
    this.showKitchenTicket = false;
  }

  

}