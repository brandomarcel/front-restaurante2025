import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgSelectModule } from '@ng-select/ng-select';
import { toast } from 'ngx-sonner';

import { EcuadorTimePipe } from 'src/app/core/pipes/ecuador-time-pipe.pipe';
import { PrintService } from 'src/app/services/print.service';
import { InvoicesService } from 'src/app/services/invoices.service';
import { ProductsService } from 'src/app/services/products.service';
import { environment } from 'src/environments/environment';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { OrdersService } from 'src/app/services/orders.service';

type Product = any; // usa tu modelo si lo tienes
type OrderItem = {
  productId?: string;
  productName?: string;
  description?: string;
  quantity: number;
  price: number;
  tax?: string | null;
  tax_value?: number;  // 0 o 15
  total?: number;      // subtotal SIN IVA (como haces en invoicing)
};

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    NgSelectModule,
    EcuadorTimePipe,
    FontAwesomeModule,
    ButtonComponent
  ],
  templateUrl: './order-detail-page.component.html'
})
export class OrderDetailPageComponent implements OnInit {
  loading = true;
  error = '';
  order: any | null = null;

  // UI/estado
  products: Product[] = [];
  orderItems: OrderItem[] = [];
  showCustomerModal = false;
  customerForm!: FormGroup;

  private baseUrl = environment.URL;

  constructor(
    private route: ActivatedRoute,
    private invoicesSvc: InvoicesService,
    private productsSvc: ProductsService,
    private printSvc: PrintService,
    private router: Router,
    private fb: FormBuilder,
    private ordersSvc: OrdersService,
  ) { }

  ngOnInit(): void {
    // modal cliente opcional
    this.customerForm = this.fb.group({
      nombre: [''],
      num_identificacion: [''],
      tipo_identificacion: ['05 - Cedula'],
      correo: [''],
      telefono: [''],
      direccion: ['']
    });

    const id = this.route.snapshot.paramMap.get('id')!;
    this.fetch(id);
    this.loadProducts();
  }

  // =============== Cargar Orden y Productos ===============
  fetch(id: string) {
    this.loading = true; this.error = ''; this.order = null;
    this.invoicesSvc.getOrderDetail(id).subscribe({
      next: (res: any) => {
        this.order = (res?.message?.data || res?.data);
        console.log('Orden cargada:', this.order);
        this.loading = false;
        if (!this.order) {
          this.error = 'Orden no encontrada';
          return;
        }
        this.hydrateOrderItems(this.order);
      },
      error: (err) => {
        this.loading = false;
        this.error = 'No se pudo cargar la orden';
        console.error(err);
      }
    });
  }

  loadProducts(): void {
    this.productsSvc.getAll(1).subscribe({
      next: (res: any) => {
        const all = (res?.message?.data || []) as Product[];
        this.products = all.filter((p: any) => Number((p as any).isactive) === 1);
      },
      error: () => toast.error('Error al cargar la lista de productos.')
    });
  }

  private hydrateOrderItems(order: any): void {
    // Tu JSON ya trae por ítem: quantity, price, tax_rate, subtotal (SIN IVA), iva, total (CON IVA)
    // Para edición homogénea con invoicing, trabajamos con total = subtotal SIN IVA y tax_value = tax_rate.
    const items = order?.items || [];
    this.orderItems = items.map((it: any): OrderItem => ({
      productId: it.productId,
      productName: it.productName,
      description: it.productName,
      quantity: this.safeNumber(it.quantity, 1),
      price: this.safeMoney(it.price),
      tax: null,
      tax_value: it.tax_rate ?? 0,
      total: this.round2(this.safeNumber(it.subtotal, this.safeNumber(it.quantity, 1) * this.safeMoney(it.price)))
    }));
    this.recalculateOrder();
  }

  // =================== Acciones PDF ===================
  getComandaPdf() {
    if (!this.order?.name) {
      toast.error('Orden inválida');
      return
    }
    const url = this.baseUrl + this.printSvc.getComandaPdf(this.order.name);
    const w = window.open(url, '_blank'); if (!w) toast.error('No se pudo abrir la impresión');
  }
  getNotaVentaPdf() {
    if (!this.order?.name) {
      toast.error('Orden inválida');
      return
    }
    const url = this.baseUrl + this.printSvc.getNotaVentaPdf(this.order.name);
    const w = window.open(url, '_blank'); if (!w) toast.error('No se pudo abrir la impresión');
  }
  getFacturaPdf(): void {
    const inv = this.order?.sri?.invoice;
    if (!inv) {
      toast.error('Factura no disponible');
      return
    }
    const url = this.baseUrl + this.printSvc.getFacturaPdf(inv);
    const w = window.open(url, '_blank'); if (!w) toast.error('No se pudo abrir la impresión');
  }

  // =================== Navegación ===================
  get sriStatus(): string {
    const st = this.order?.sri?.status;
    return st === 'AUTORIZADO' ? 'AUTORIZADO' :
      st === 'Rejected' ? 'Rechazada' :
        st === 'Error' ? 'Error' :
          st === 'Queued' ? 'En cola' :
            st === 'Processing' ? 'En proceso' :
              st === 'Draft' ? 'Borrador' :
                (st || 'Sin factura');
  }

  goBack() {
    if (window.history.length > 2) history.back();
    else this.router.navigate(['/orders']);
  }

  goToInvoice(invName?: string) {
    if (!invName) return;
    this.router.navigate(['/invoices', invName]);
  }

  facturarDesdeOrden(order: any) {
    if (!order?.name) return;
    this.router.navigate(['/dashboard/invoicing', order.name]);
  }

  // =================== Edición de Ítems ===================
  addProductToOrder(product: Product | null): void {
    if (!product) return;

    const existing = this.orderItems.find(oi => oi.productId === product.name);
    if (existing) {
      existing.quantity = this.safeNumber(existing.quantity, 0) + 1;
    } else {
      const price = this.safeMoney(product.precio);
      const inferredTaxValue = product.tax_value ?? (product.tax === 'IVA-15' ? 15 : 0);

      this.orderItems.push({
        productId: product.name,
        productName: product.nombre,
        description: product.nombre,
        quantity: 1,
        price,
        tax: product.tax ?? product.tax_id ?? null,
        tax_value: inferredTaxValue,
        total: this.round2(price) // subtotal sin IVA
      });
    }
    this.recalculateOrder();
  }

  incrementOrderQty(i: number): void {
    const it = this.orderItems[i];
    it.quantity = this.safeNumber(it.quantity, 0) + 1;
    this.recalculateOrder();
  }

  decrementOrderQty(i: number): void {
    const it = this.orderItems[i];
    it.quantity = Math.max(1, this.safeNumber(it.quantity, 1) - 1);
    this.recalculateOrder();
  }

  removeProductFromOrder(i: number): void {
    if (i < 0 || i >= this.orderItems.length) return;
    this.orderItems.splice(i, 1);
    this.recalculateOrder();
  }

  recalculateOrder(): void {
    this.orderItems.forEach(it => {
      const qty = Math.max(1, this.safeNumber(it.quantity, 1));
      const rate = Math.max(0, this.safeMoney(it.price));
      const lineSubtotal = qty * rate; // SIN IVA
      it.quantity = qty;
      it.price = rate;
      it.total = this.round2(lineSubtotal);
    });
  }

  // =================== Totales ===================
  get orderSubtotal(): number {
    return this.round2(this.orderItems.reduce((acc, it) => acc + (it.total ?? 0), 0));
  }

  get orderIva(): number {
    return this.round2(this.orderItems.reduce((acc, it) => {
      const pct = this.getTaxPct(it);
      return acc + (it.total ?? 0) * pct;
    }, 0));
  }

  get orderTotal(): number {
    return this.round2(this.orderSubtotal + this.orderIva);
  }

  // =================== Guardado ===================
 saveOrderChanges(): void {
  if (this.isLocked) { toast.error('La orden ya está facturada.'); return; }
  if (!this.order?.name) { toast.error('Orden no válida'); return; }

  const items = this.orderItems.map(it => {
    const qty = this.safeNumber(it.quantity, 1);
    const rate = this.safeMoney(it.price);
    const lineSubtotal = this.round2(qty * rate);       // SIN IVA
    const taxRate = Number.isFinite(it.tax_value as number)
      ? (it.tax_value as number)
      : (it.tax === 'IVA-15' ? 15 : 0);

    return {
      product:   it.productId || 'ADHOC',         // 👈 fieldname del child
      qty,                                        // 👈
      rate:      this.round2(rate),               // 👈
      tax:       it.tax ?? null,                  // 👈 Link a "taxes" (ej. 'IVA-15'), opcional
      total:     lineSubtotal,                    // 👈 subtotal SIN IVA
      tax_rate:  taxRate                          // 👈 0 o 15
    };
  });

  const payload = {
    name: this.order.name,              // requerido por tu endpoint
    items,
    subtotal: this.orderSubtotal,       // totales de cabecera
    iva:      this.orderIva,
    total:    this.orderTotal
    // alias/email/estado/payments si también los actualizas desde la UI
  };

  this.ordersSvc.update(payload).subscribe({
    next: () => toast.success('Orden actualizada.'),
    error: () => toast.error('Error al actualizar la orden.')
  });

  console.log('payload actualizar orden =>', payload);
}



  // =================== Helpers ===================
  trackByIndex = (i: number) => i;

  private getTaxPct(it: OrderItem): number {
    if (Number.isFinite(it.tax_value as number)) {
      return Math.max(0, (it.tax_value as number) / 100); // 15 -> 0.15
    }
    return it.tax === 'IVA-15' ? 0.15 : 0;
  }

  private safeNumber(v: any, def = 0): number {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  }

  private safeMoney(v: any): number {
    const n = typeof v === 'string' ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? this.round2(n) : 0;
  }

  private round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  // ====== Modal Cliente (opc) ======
  closeCustomerModal(): void {
    this.showCustomerModal = false;
  }
  saveCustomerForOrder(): void {
    // Hook si decides permitir cambiar el cliente de la orden
    this.showCustomerModal = false;
    toast.info('Conecta aquí el servicio para actualizar el cliente de la orden.');
  }

  get isLocked(): boolean {
  // Elige la condición que prefieras:
  // A) bloquear si es de tipo Factura
  // return this.order?.type === 'Factura';
  // B) bloquear si ya fue AUTORIZADA en SRI (recomendado)
  return (this.order?.sri?.status === 'AUTORIZADO') || (this.order?.type === 'Factura');
}
}
