import { Component, EventEmitter, Input, Output, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderVM } from 'src/app/services/realtime-orders.service';

@Component({
  selector: 'app-order-kitchen-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-kitchen-card.component.html'
})
export class OrderKitchenCardComponent implements OnInit, OnDestroy {

  @Input({ required: true }) order!: OrderVM;
  @Input() allowActions = true;
  @Input() actionPending = false;
  @Input() kitchenStage: 'NEW' | 'PREP' | 'READY' = 'NEW';
  @Input() pendingItemNames: string[] = [];

  @Output() open = new EventEmitter<OrderVM>();
  @Output() toPreparacion = new EventEmitter<OrderVM>();
  @Output() toCerrada = new EventEmitter<OrderVM>();
  @Output() toEntregado = new EventEmitter<OrderVM>();
  @Output() updateItem = new EventEmitter<{
    order: OrderVM;
    item: any;
    kitchenStatus: 'Pendiente' | 'En preparacion' | 'Listo' | 'Entregado' | 'Cancelado';
  }>();

  // minutos transcurridos (se refresca solo)
  minutes = 0;
  private timer: any;

  ngOnInit(): void {
    this.updateMinutes();
    this.timer = setInterval(() => this.updateMinutes(), 15_000); // cada 15s
  }

  ngOnDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  private updateMinutes() {
    const d = this.order.createdAtISO || this.order.createdAt;
    if (!d) { this.minutes = 0; return; }
    const t = new Date(d).getTime();
    if (!Number.isFinite(t)) { this.minutes = 0; return; }
    const diff = Date.now() - t;
    this.minutes = Math.max(0, Math.floor(diff / 60000));
  }

  badgeClass(): string {
    if (this.kitchenStage === 'NEW') return 'bg-rose-100 text-rose-700';
    if (this.kitchenStage === 'PREP') return 'bg-amber-100 text-amber-800';
    if (this.kitchenStage === 'READY') return 'bg-emerald-100 text-emerald-800';
    return 'bg-gray-100 text-gray-700';
  }

  borderClass(): string {
    if (this.kitchenStage === 'NEW') return 'border-rose-300 bg-rose-50';
    if (this.kitchenStage === 'PREP') return 'border-amber-300 bg-amber-50';
    if (this.kitchenStage === 'READY') return 'border-emerald-300 bg-emerald-50';
    return 'border-gray-200 bg-white';
  }

  kitchenStatusLabel(): string {
    if (this.kitchenStage === 'PREP') return 'En preparación';
    if (this.kitchenStage === 'READY') return 'Listo';
    return 'Nuevo';
  }

  urgencyText(): string {
    if (this.minutes >= 20) return 'Urgente';
    if (this.minutes >= 10) return 'En cola';
    return 'A tiempo';
  }

  urgencyClass(): string {
    if (this.minutes >= 20) return 'text-rose-700';
    if (this.minutes >= 10) return 'text-amber-700';
    return 'text-emerald-700';
  }

  urgencyPillClass(): string {
    if (this.minutes >= 20) return 'bg-rose-100 text-rose-700 border-rose-200';
    if (this.minutes >= 10) return 'bg-amber-100 text-amber-700 border-amber-200';
    return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }

  get isDelayed(): boolean {
    return this.minutes >= 20 && this.kitchenStage !== 'READY';
  }

  get isNewOrder(): boolean {
    return this.order._flashType === 'insert';
  }

  tableLabel(): string {
    const row: any = this.order as any;
    return String(row.tableName || row.table_label || row.mesa_name || row.table || row.mesa || '').trim() || 'Sin mesa';
  }

  orderType(): string {
    return String((this.order as any)?.type || (this.order as any)?.type_orden || 'Nota de venta').trim();
  }

  orderNotes(): string {
    return String((this.order as any)?.notes || (this.order as any)?.observaciones || '').trim();
  }

  get showUrgencyPill(): boolean {
    return this.kitchenStage !== 'READY';
  }

  // fallback por si el socket manda items con qty/rate/product
  getItemQty(it: any): number {
    return Number(it?.quantity ?? it?.qty ?? 1);
  }

  getItemName(it: any): string {
    const product = it?.product;
    const value = it?.item_name
      ?? it?.product_name
      ?? it?.productName
      ?? (product && typeof product === 'object' ? product.item_name ?? product.product_name ?? product.name : product)
      ?? '—';
    return String(value);
  }

  getItemImage(it: any): string {
    const product = it?.product;
    return String(it?.image_url
      ?? it?.image
      ?? it?.product_image_url
      ?? it?.product_image
      ?? (product && typeof product === 'object' ? product.image_url ?? product.image : '')
      ?? '').trim();
  }

  getItemNotes(it: any): string {
    return String(it?.notes ?? it?.note ?? it?.observaciones ?? '').trim();
  }

  getItemModifiers(it: any): string {
    const value = it?.modifiers ?? it?.modificadores ?? it?.options ?? '';
    if (Array.isArray(value)) return value.map((item: any) => typeof item === 'string' ? item : item?.name || item?.label || '').filter(Boolean).join(', ');
    return String(value || '').trim();
  }

  getItemKitchenStatus(it: any): string {
    return String(it?.kitchen_status ?? it?.kitchenStatus ?? it?.estado_cocina ?? '').trim();
  }

  itemIdentifier(it: any): string {
    return String(it?.name ?? it?.order_item ?? it?.row_id ?? it?.id ?? '').trim();
  }

  normalizedItemStatus(it: any): string {
    return this.getItemKitchenStatus(it).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  itemAction(it: any): 'En preparacion' | 'Listo' | 'Entregado' | null {
    const status = this.normalizedItemStatus(it);
    if (status.includes('entreg') || status.includes('cancel')) return null;
    if (status.includes('list')) return 'Entregado';
    if (status.includes('prepar')) return 'Listo';
    return 'En preparacion';
  }

  isItemPending(it: any): boolean {
    const id = this.itemIdentifier(it);
    return !!id && this.pendingItemNames.includes(`${this.order?.name}:${id}`);
  }

  emitItemUpdate(it: any): void {
    const kitchenStatus = this.itemAction(it);
    if (!kitchenStatus || this.actionPending || this.isItemPending(it)) return;
    this.updateItem.emit({ order: this.order, item: it, kitchenStatus });
  }

  emitItemCancel(it: any): void {
    if (!this.itemIdentifier(it) || this.actionPending || this.isItemPending(it) || this.normalizedItemStatus(it).includes('cancel')) return;
    this.updateItem.emit({ order: this.order, item: it, kitchenStatus: 'Cancelado' });
  }

  get visibleItems(): any[] {
    return Array.isArray(this.order?.items) ? this.order.items.slice(0, 4) : [];
  }

  get remainingItems(): number {
    const total = Array.isArray(this.order?.items) ? this.order.items.length : 0;
    return Math.max(0, total - this.visibleItems.length);
  }
}
