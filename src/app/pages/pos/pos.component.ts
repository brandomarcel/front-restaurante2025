import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgSelectModule } from '@ng-select/ng-select';
import { MenuService } from 'src/app/modules/layout/services/menu.service';
import { CustomersService } from 'src/app/services/customers.service';
import { ProductsService } from 'src/app/services/products.service';

@Component({
  selector: 'app-pos',
  imports: [CommonModule, FormsModule, FontAwesomeModule,NgSelectModule],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.css'
})

export class PosComponent implements OnInit {
  products = [
    { id: 1, name: 'Coca-Cola', price: 1.25, tax: 0.12 },
    { id: 2, name: 'Hamburguesa', price: 4.00, tax: 0.00 },
    { id: 3, name: 'Papas Fritas', price: 2.00, tax: 0.12 },
  ];
  customers:any = [];
  cart: any[] = [];
  searchTerm: string = '';
  selectedCustomerId: string = ''; 
  paymentMethod: string = 'efectivo';

  showCustomerModal = false;
  nuevoCliente = {
    fullName: '',
    identification: '',
    type: 'final',
    email: '',
    phone: '',
  };
  constructor(public menuService: MenuService,
    private customersService: CustomersService,
    private productsService: ProductsService
  ) { }

  ngOnInit(): void {
    console.log('entro');

    this.toggleSidebar();

    this.loadProducts();
    this.loadCustomers();
  }
  public toggleSidebar() {
    this.menuService.toggleSidebar();
  }

  cargarClientes() {
    this.customersService.getAll().subscribe((res) => {
      this.customers = res;
    });
  }


  loadProducts() {
    this.productsService.getAll().subscribe((res) => {
      this.products = res;
    });
  }

  loadCustomers() {
    this.customersService.getAll().subscribe((res) => {
      this.customers = res;
    });
  }
  crearCliente() {
    // this.http.post('/api/customers', this.nuevoCliente).subscribe((res: any) => {
    //   this.customers.push(res);
    //   this.selectedCustomerId = res.id;
    //   this.showCustomerModal = false;
    //   this.nuevoCliente = {
    //     fullName: '',
    //     identification: '',
    //     type: 'final',
    //     email: '',
    //     phone: '',
    //   };
    // });
  }

  filteredProducts() {
    return this.products.filter(p =>
      p.name.toLowerCase().includes(this.searchTerm.toLowerCase())
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
    if (!this.selectedCustomerId || this.cart.length === 0) {
      alert('Selecciona un cliente y agrega productos al carrito.');
      return;
    }

    const order = {
      customerId: this.selectedCustomerId,
      items: this.cart.map(item => ({
        productName: item.name,
        quantity: item.quantity,
        price: item.price
      })),
      type: 'nota' // Solo guardamos como "nota"
    };

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

}