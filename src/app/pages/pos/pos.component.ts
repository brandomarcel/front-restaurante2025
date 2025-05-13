import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgSelectModule } from '@ng-select/ng-select';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { OnlyNumbersDirective } from 'src/app/core/directives/only-numbers.directive';
import { MenuService } from 'src/app/modules/layout/services/menu.service';
import { CustomersService } from 'src/app/services/customers.service';
import { OrdersService } from 'src/app/services/orders.service';
import { ProductsService } from 'src/app/services/products.service';

@Component({
  selector: 'app-pos',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FontAwesomeModule, NgSelectModule, OnlyNumbersDirective],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.css'
})

export class PosComponent implements OnInit {
  showPaymentModal: boolean = false;
  amountReceived: number | null = null;
  change: number = 0;

  products: any = [];

  identificationCustomer: string = '';
  customer: any = null;
  cart: any[] = [];
  searchTerm: string = '';
  selectedCategory = '';
  categories = ['Entrada', 'Sopas', 'Adicionales', 'Bebidas', 'Postres', 'Platos_Fuertes', 'Burguers'];


  paymentMethod: string = 'efectivo';

  showCustomerModal = false;

  submitted = false;
  clienteForm!: FormGroup;

  today: any;
  constructor(public menuService: MenuService,
    private customersService: CustomersService,
    private productsService: ProductsService,
    private fb: FormBuilder,
    private ordersService: OrdersService,
    private spinner: NgxSpinnerService
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
      fullName: ['', [Validators.required]],
      identification: ['', [Validators.required]],
      identificationType: ['04', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required]],
      address: ['', [Validators.required]],
    });

    this.toggleSidebar();

    this.loadProducts();
  }
  public toggleSidebar() {
    this.menuService.toggleSidebar();
  }
  get f() {
    return this.clienteForm.controls;
  }
  loadProducts() {
    this.spinner.show();
    this.productsService.getAll().subscribe((res) => {
      this.spinner.hide();
      this.products = res || [];
      console.log(' this.products', this.products);
    });
  }

  findByIdentificationCustomer(): void {
    const identification = this.identificationCustomer?.trim();
    console.log('identification', this.identificationCustomer);

    if (!identification || (identification.length !== 10 && identification.length !== 13)) {
      alert('La identificación debe tener 10');
      return;
    }

    this.spinner.show();
    this.customersService.findByIdentification(identification).subscribe({
      next: (res) => {
        this.customer = res;
        console.log('Cliente encontrado:', res);
      },
      error: (err) => {
        console.error('Error al buscar cliente:', err);
        this.customer = null;
        this.clienteForm.patchValue({ identification: this.identificationCustomer });
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
    this.submitted = true
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
        toast.error('Error:' + err.error.message);
        console.error('Error al crear cliente:', err);
      }
    });
  }

  filteredProducts() {
    return this.products.filter((product: any) =>
      (!this.selectedCategory || product.category === this.selectedCategory) &&
      (!this.searchTerm || product.name.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }

  addProduct(product: any) {
    const item = this.cart.find(i => i.id === product.id);
    const price = parseFloat(product.price);
    const tax = parseFloat(product.tax);

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
      item.total = item.quantity * parseFloat(item.price);
    } else {
      this.cart = this.cart.filter(i => i.id !== item.id);
    }
  }

  get subtotal(): number {
    return this.cart.reduce((acc, item) => {
      const total = Number(item.total);
      const tax = Number(item.tax);

      if (tax > 0) {
        return acc + total / (1 + tax); // divide para quitar IVA incluido
      } else {
        return acc + total; // no tiene IVA
      }
    }, 0);
  }

  get iva(): number {
    return this.cart.reduce((acc, item) => {
      const total = Number(item.total);
      const tax = Number(item.tax);

      if (tax > 0) {
        return acc + (total - total / (1 + tax)); // parte correspondiente al IVA
      } else {
        return acc; // sin IVA
      }
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
    if (!this.identificationCustomer || this.cart.length === 0) {
      alert('Selecciona un cliente y agrega productos al carrito.');
      return;
    }

    this.amountReceived = null;
    this.change = 0;
    this.showPaymentModal = true;
  }

  calcularCambio() {
    if (this.paymentMethod === 'efectivo') {
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

    if (this.paymentMethod === 'efectivo' && (this.amountReceived === null || this.change < 0)) {
      toast.warning('Monto recibido insuficiente.');
      return;
    }

    const order = {
      customerId: this.customer.id,
      items: this.cart.map(item => ({
        productId: item.id,
        quantity: item.quantity
      })),
      type: 'nota',
      createdAt: this.today,
      paymentMethod: this.paymentMethod,
      amountReceived: this.amountReceived,
      change: this.change
    };

    this.spinner.show();

    this.ordersService.create(order).subscribe({
      next: () => {
        this.spinner.hide();
        toast.success(`Pedido guardado. ${this.paymentMethod === 'efectivo' ? 'Cambio: $' + this.change.toFixed(2) : ''}`);
        this.showReceipt = true;
        this.showPaymentModal = false;

        // Imprimir nota + comanda juntas
        //setTimeout(() => this.printCombinedTicket(), 500);
        setTimeout(() => this.printCombinedTicketWithPageBreak(), 500);

      },
      error: () => {
        this.spinner.hide();
        toast.error('Error al guardar el pedido.');
      }
    });

  }


  showKitchenTicket = false;
  showReceipt = false;

  printCombinedTicket() {
    const nota = document.getElementById('print-area');
    const cocina = document.getElementById('kitchen-area');

    if (!nota || !cocina) {
      toast.error('No se encontraron los contenidos de impresión');
      return;
    }

    // Clonar y limpiar ambos bloques
    const notaClone = nota.cloneNode(true) as HTMLElement;
    const cocinaClone = cocina.cloneNode(true) as HTMLElement;

    notaClone.querySelectorAll('.no-print').forEach(el => el.remove());
    cocinaClone.querySelectorAll('.no-print').forEach(el => el.remove());

    const combinedHTML = `
    <div>
      ${notaClone.innerHTML}
      <hr style="margin: 20px 0; border-top: 1px dashed #000;" />
      <div class="text-center" style="margin-bottom: 10px;">
        <strong>--- COMANDA DE COCINA ---</strong>
      </div>
      ${cocinaClone.innerHTML}
    </div>
  `;

    const printWindow = window.open('', '_blank', 'width=400,height=800');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }

    const html = `
    <html>
      <head>
        <title>Nota de Venta + Comanda</title>
        <style>
          body { font-family: monospace; font-size: 12px; padding: 10px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { text-align: left; padding: 4px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          hr { margin: 10px 0; }
          .no-print { display: none !important; }
          @media print {
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        ${combinedHTML}
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
    </html>
  `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    // Limpieza final del estado del POS
    this.cart = [];
    this.customer = null;
    this.identificationCustomer = '';
    this.amountReceived = null;
    this.change = 0;
    this.showReceipt = false;
    this.showKitchenTicket = false;
  }




  printCombinedTicketWithPageBreak() {
  const nota = document.getElementById('print-area');
  const cocina = document.getElementById('kitchen-area');

  if (!nota || !cocina) {
    toast.error('No se encontraron los contenidos de impresión');
    return;
  }

  // Clonar y limpiar
  const notaClone = nota.cloneNode(true) as HTMLElement;
  const cocinaClone = cocina.cloneNode(true) as HTMLElement;

  notaClone.querySelectorAll('.no-print').forEach(el => el.remove());
  cocinaClone.querySelectorAll('.no-print').forEach(el => el.remove());

  // Envolver cada sección en contenedores separados
  const combinedHTML = `
    <div class="nota-section">
      ${notaClone.innerHTML}
    </div>
    <div class="page-break"></div>
    <div class="cocina-section">
      <div class="text-center" style="margin-bottom: 10px;">
        <strong>--- COMANDA DE COCINA ---</strong>
      </div>
      ${cocinaClone.innerHTML}
    </div>
  `;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    toast.error('No se pudo abrir la ventana de impresión');
    return;
  }

  const html = `
    <html>
      <head>
        <title>Nota + Comanda</title>
        <style>
          body { font-family: monospace; font-size: 12px; padding: 10px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { text-align: left; padding: 4px; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          hr { margin: 10px 0; }
          .no-print { display: none !important; }

          /* 🔥 Esto fuerza una hoja nueva entre secciones */
          .page-break {
            page-break-after: always;
            break-after: page;
          }

          @media print {
            .no-print { display: none !important; }
            .page-break {
              page-break-after: always;
              break-after: page;
            }
          }
        </style>
      </head>
      <body>
        ${combinedHTML}
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  // Limpieza del estado del POS
  this.cart = [];
  this.customer = null;
  this.identificationCustomer = '';
  this.amountReceived = null;
  this.change = 0;
  this.showReceipt = false;
  this.showKitchenTicket = false;
}



  cerrarComprobante() {
    this.showReceipt = false;
  }

  cerrarModal() {
    this.showCustomerModal = false;
    this.submitted = false;
    this.clienteForm.reset();
  }

}