import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CartService } from '../services/cart.service';
import { ProductsService } from 'src/app/services/products.service';
import { CategoryService } from 'src/app/services/category.service';
import { OrdersService } from 'src/app/services/orders.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { AlertService } from 'src/app/core/services/alert.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pos-mesero',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pos-mesero.component.html'
})
export class PosMeseroComponent implements OnInit {

  @ViewChild('productContainer') productContainer!: ElementRef;

  products: any[] = [];
  filteredProductList: any[] = [];

  alias: string = '';
  searchTerm: string = '';

  constructor(
    public cartService: CartService,
    private productsService: ProductsService,
    private categoryService: CategoryService,
    private ordersService: OrdersService,
    private spinner: NgxSpinnerService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.loadProducts();
  }

  loadProducts() {
    this.productsService.getAll(1).subscribe((res: any) => {
      this.products = res.message.data || [];
      this.filteredProductList = this.products;
    });
  }

  clearSearch() {
    this.searchTerm = '';
    this.filteredProductList = this.products;
  }

  applyFilters() {
    const term = this.normalize(this.searchTerm);

    this.filteredProductList = (this.products || []).filter((product: any) => {
      const name = this.normalize(product?.nombre ?? product?.name);
      const desc = this.normalize(product?.description ?? product?.descripcion);
      return name.includes(term) || desc.includes(term);
    });
  }

  addProduct(product: any) {
    this.cartService.addProduct(product);

    // Vibración en dispositivos compatibles
    if (navigator.vibrate) {
      navigator.vibrate(50);
    }

    // Scroll suave hacia abajo
    setTimeout(() => {
      this.productContainer?.nativeElement?.scrollTo({
        top: this.productContainer.nativeElement.scrollHeight,
        behavior: 'smooth'
      });
    }, 100);
  }

  async saveOrderMesero() {

    if (!this.alias) {
      toast.error('Ingresa un alias.');
      return;
    }

    const order = {
      alias: this.alias,
      estado: 'Nota Venta',
      total: this.cartService.total.toFixed(2),
      items: this.cartService.cart.map(item => ({
        product: item.name ?? item.nombre,
        qty: item.quantity,
        rate: item.price,
        tax_rate: item.tax_value
      })),
    };

    const result = await this.alertService.confirm(
      '¿Desea crear la orden?',
      'Confirmación'
    );

    if (!result.isConfirmed) return;

    this.spinner.show();

    this.ordersService.create_order_v2(order).subscribe({
      next: () => {
        toast.success('Orden creada correctamente');
        this.cartService.clear();
        this.alias = '';
      },
      error: () => toast.error('Error al enviar la comanda.'),
      complete: () => this.spinner.hide()
    });
  }

  private normalize(txt: any = ''): string {
    return String(txt ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
