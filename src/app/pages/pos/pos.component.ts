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

    this.customersService.findByIdentification(identification).subscribe({
      next: (res) => {
        this.customer = res;
        console.log('Cliente encontrado:', res);
      },
      error: (err) => {
        console.error('Error al buscar cliente:', err);
        this.customer = null;
        this.clienteForm.patchValue({ identification: this.identificationCustomer });
        alert('Cliente no encontrado con esa identificación');
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
        toast.error('Error:'+err.error.message);
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



  finalizarVenta() {
    if (!this.identificationCustomer || this.cart.length === 0) {
      alert('Selecciona un cliente y agrega productos al carrito.');
      return;
    }

    const order = {
      customerId: this.customer.id,
      items: this.cart.map(item => ({
        productId: item.id,
        quantity: item.quantity
      })),
      type: 'nota', // Solo guardamos como "nota"
      createdAt: this.today
    };

    console.log('order', order);

    this.ordersService.create(order).subscribe(() => {
      alert('Pedido guardado exitosamente. Puedes facturarlo más tarde.');
      this.cart = [];
      this.customer = null;
      this.identificationCustomer = '';
    });

    // this.http.post('/api/orders', order).subscribe({
    //   next: (res) => {
    //     alert('Pedido guardado exitosamente. Puedes facturarlo más tarde.');
    //     this.cart = [];
    //   },
    //   error: (err) => {
    //     console.error(err);
    //     alert('Ocurrió un error al guardar el pedido.');
    //   }
    // });
  }


  cerrarModal() {
    this.showCustomerModal = false;
    this.submitted = false;
    this.clienteForm.reset();
  }

}