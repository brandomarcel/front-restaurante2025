import { Component, OnInit } from '@angular/core';
import { CartService } from '../services/cart.service';
import { ProductsService } from 'src/app/services/products.service';
import { CategoryService } from 'src/app/services/category.service';
import { OrdersService } from 'src/app/services/orders.service';
import { NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { AlertService } from 'src/app/core/services/alert.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

type OrderType = 'Servirse' | 'Llevar' | 'Domicilio';

@Component({
  selector: 'app-pos-mesero',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pos-mesero.component.html',
  styles: [':host { display: block; height: 100%; min-height: 0; }']
})
export class PosMeseroComponent implements OnInit {

  products: any[] = [];
  filteredProductList: any[] = [];
  categories: any[] = [];
  selectedCategory = '';

  alias = '';
  searchTerm = '';
  orderType: OrderType = 'Servirse';
  deliveryAddress = '';
  deliveryPhone = '';
  cartExpanded = false;
  isSubmittingOrder = false;
  isLoadingProducts = false;
  private readonly favoritesStorageKey = 'pos_mesero_favorites_v1';
  private favoriteProductKeys = new Set<string>();

  constructor(
    public cartService: CartService,
    private productsService: ProductsService,
    private categoryService: CategoryService,
    private ordersService: OrdersService,
    private spinner: NgxSpinnerService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.loadFavorites();
    this.loadProducts();
    this.loadCategories();
  }

  get totalItems(): number {
    return this.cartService.cart.reduce((acc, item) => acc + Number(item?.quantity ?? 0), 0);
  }

  get canSubmitOrder(): boolean {
    if (!this.alias.trim()) return false;
    if (this.cartService.cart.length === 0) return false;
    if (this.orderType === 'Domicilio' && (!this.deliveryAddress.trim() || !this.deliveryPhone.trim())) return false;
    return !this.isSubmittingOrder;
  }

  get subtotal(): number {
    return this.cartService.subtotal;
  }

  get iva(): number {
    return this.cartService.iva;
  }

  get total(): number {
    return this.cartService.total;
  }

  loadProducts(): void {
    this.isLoadingProducts = true;
    this.productsService.getAll(1).pipe(
      finalize(() => this.isLoadingProducts = false)
    ).subscribe((res: any) => {
      this.products = res?.message?.data || [];
      this.applyFilters();
    });
  }

  loadCategories(): void {
    this.categoryService.getAll(1).subscribe({
      next: (res: any) => {
        this.categories = res?.message?.data || [];
      }
    });
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.applyFilters();
  }

  onCategorySelected(categoryName: string): void {
    this.selectedCategory = categoryName;
    this.applyFilters();
  }

  setOrderType(type: OrderType): void {
    this.orderType = type;
    if (type !== 'Domicilio') {
      this.deliveryAddress = '';
      this.deliveryPhone = '';
    }
  }

  applyFilters(): void {
    const term = this.normalize(this.searchTerm);
    const selectedCat = this.normalize(this.selectedCategory);

    const filtered = (this.products || []).filter((product: any) => {
      const productCategory = this.normalize(this.getProductCategoryName(product));
      const matchCategory = !selectedCat || productCategory === selectedCat;

      if (!matchCategory) return false;
      if (!term) return true;

      const name = this.normalize(product?.nombre ?? product?.name);
      const desc = this.normalize(product?.description ?? product?.descripcion);
      return name.includes(term) || desc.includes(term);
    });

    this.filteredProductList = filtered
      .map((product: any, index: number) => ({ product, index }))
      .sort((a, b) => {
        const aFav = this.isFavorite(a.product) ? 1 : 0;
        const bFav = this.isFavorite(b.product) ? 1 : 0;
        if (bFav !== aFav) {
          return bFav - aFav;
        }
        return a.index - b.index;
      })
      .map((entry) => entry.product);
  }

  addProduct(product: any): void {
    if (product?.is_out_of_stock) return;

    this.cartService.addProduct(product);

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }

  toggleFavorite(product: any): void {
    const key = this.getProductKey(product);
    if (!key) return;

    if (this.favoriteProductKeys.has(key)) {
      this.favoriteProductKeys.delete(key);
    } else {
      this.favoriteProductKeys.add(key);
    }

    this.persistFavorites();
    this.applyFilters();
  }

  isFavorite(product: any): boolean {
    const key = this.getProductKey(product);
    return !!key && this.favoriteProductKeys.has(key);
  }

  increase(item: any): void {
    this.cartService.increase(item);
  }

  decrease(item: any): void {
    this.cartService.decrease(item);
  }

  remove(item: any): void {
    const index = this.cartService.cart.indexOf(item);
    if (index !== -1) this.cartService.cart.splice(index, 1);
  }

  toggleCartDetails(): void {
    this.cartExpanded = !this.cartExpanded;
  }

  async clearCart(): Promise<void> {
    if (this.cartService.cart.length === 0) return;

    const result = await this.alertService.confirm(
      '¿Vaciar comanda actual?',
      'Confirmación'
    );
    if (!result.isConfirmed) return;

    this.cartService.clear();
    this.cartExpanded = false;
  }

  async saveOrderMesero(): Promise<void> {
    if (this.isSubmittingOrder) return;

    if (this.cartService.cart.length === 0) {
      toast.error('Agrega productos a la comanda.');
      return;
    }

    if (!this.alias) {
      toast.error('Ingresa la mesa o alias.');
      return;
    }

    if (this.orderType === 'Domicilio' && (!this.deliveryAddress.trim() || !this.deliveryPhone.trim())) {
      toast.error('Completa direccion y telefono para domicilio.');
      return;
    }

    const order = {
      alias: this.alias.trim().toUpperCase(),
      estado: 'Nota Venta',
      total: this.cartService.total.toFixed(2),
      type_orden: this.orderType,
      delivery_address: this.deliveryAddress.trim(),
      delivery_phone: this.deliveryPhone.trim(),
      fecha: this.buildEcuadorIsoDate(),
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

    this.isSubmittingOrder = true;
    this.spinner.show();

    this.ordersService.create_order_v2(order).pipe(
      finalize(() => {
        this.isSubmittingOrder = false;
        this.spinner.hide();
      })
    ).subscribe({
      next: () => {
        toast.success('Orden creada correctamente');
        this.resetOrderForm();
      },
      error: () => toast.error('Error al enviar la comanda.')
    });
  }

  trackByProduct = (_: number, p: any) => p?.name || p?.nombre;
  trackByCart = (_: number, it: any) => `${it?.name || it?.nombre}-${it?.price}`;

  private buildEcuadorIsoDate(): string {
    const date = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' }));
    return date.toISOString();
  }

  private resetOrderForm(): void {
    this.cartService.clear();
    this.alias = '';
    this.orderType = 'Servirse';
    this.deliveryAddress = '';
    this.deliveryPhone = '';
    this.cartExpanded = false;
  }

  private normalize(txt: any = ''): string {
    return String(txt ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private getProductCategoryName(p: any): string {
    return p?.categoria || p?.category?.name || p?.category?.nombre || '';
  }

  private loadFavorites(): void {
    try {
      const raw = JSON.parse(localStorage.getItem(this.favoritesStorageKey) || '[]');
      if (!Array.isArray(raw)) return;
      this.favoriteProductKeys = new Set(
        raw.map((x: any) => String(x || '').trim()).filter((x: string) => !!x)
      );
    } catch {
      this.favoriteProductKeys = new Set<string>();
    }
  }

  private persistFavorites(): void {
    localStorage.setItem(this.favoritesStorageKey, JSON.stringify(Array.from(this.favoriteProductKeys)));
  }

  private getProductKey(product: any): string {
    return String(product?.name || product?.id || product?.codigo || product?.nombre || '').trim();
  }
}

