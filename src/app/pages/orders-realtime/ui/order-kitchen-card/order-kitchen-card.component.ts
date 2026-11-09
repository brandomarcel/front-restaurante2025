import { Component, EventEmitter, Input, Output, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderVM } from 'src/app/services/realtime-orders.service';
import { KITCHEN_NEXT_ACTION, orderTypeLabel } from '../order-status.utils';

@Component({
  selector: 'app-order-kitchen-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-kitchen-card.component.html',
  styleUrl: './order-kitchen-card.component.css'
})
export class OrderKitchenCardComponent implements OnInit, OnDestroy {

  @Input({ required: true }) order!: OrderVM;
  @Input() allowActions = true;
  @Input() actionPending = false;
  @Input() kitchenStage: 'NEW' | 'PREP' | 'READY' = 'NEW';
  @Input() pendingItemNames: string[] = [];

  @Output() open = new EventEmitter<OrderVM>();
  @Output() toPreparacion = new EventEmitter<OrderVM>();
  @Output() toLista = new EventEmitter<OrderVM>();
  @Output() toEntregado = new EventEmitter<OrderVM>();
  @Output() updateItem = new EventEmitter<{
    order: OrderVM;
    item: any;
    kitchenStatus: 'Pendiente' | 'En preparacion' | 'Listo' | 'Entregado';
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




  urgencyText(): string {
    if (this.minutes >= 20) return 'Urgente';
    if (this.minutes >= 10) return 'En cola';
    return 'A tiempo';
  }


  urgencyPillClass(): string {
    if (this.minutes >= 20) return 'border-danger-500/40 bg-danger-500/15 text-danger-700 ';
    if (this.minutes >= 10) return 'border-warning-500/40 bg-warning-500/15 text-warning-700 ';
    return 'border-success-500/40 bg-success-500/15 text-success-700 ';
  }

  /** Lo primero que cocina necesita leer: mesa o alias del pedido. */
  headline(): string {
    const table = this.tableLabel();
    const alias = String(this.order?.alias || '').trim();
    if (table !== 'Sin mesa') return alias && alias !== table ? `${table} (${alias})` : table;
    return alias || this.order?.customer?.nombre || `#${this.order?.name}`;
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

  /** «Para llevar» / «A domicilio»; vacío si se sirve en el local. */
  get typeLabel(): string {
    return orderTypeLabel(this.order);
  }

  get nextActionLabel(): string {
    return KITCHEN_NEXT_ACTION[this.kitchenStage];
  }

  emitNext(): void {
    if (this.kitchenStage === 'NEW') this.toPreparacion.emit(this.order);
    else if (this.kitchenStage === 'PREP') this.toLista.emit(this.order);
    else this.toEntregado.emit(this.order);
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

  itemStateKey(it: any): 'pending' | 'prep' | 'ready' | 'done' {
    const status = this.normalizedItemStatus(it);
    if (status.includes('entreg') || status.includes('cancel')) return 'done';
    if (status.includes('list')) return 'ready';
    if (status.includes('prepar')) return 'prep';
    return 'pending';
  }

  itemStateLabel(it: any): string {
    const status = this.normalizedItemStatus(it);
    if (status.includes('cancel')) return 'Cancelado';
    return { pending: 'Pendiente', prep: 'Preparando', ready: 'Listo', done: 'Entregado' }[this.itemStateKey(it)];
  }

  /** Texto de lo que hará el próximo toque sobre el producto (para lectores de pantalla). */
  itemActionLabel(it: any): string {
    const action = this.itemAction(it);
    return action === 'En preparacion' ? 'en preparación' : action === 'Listo' ? 'listo' : action === 'Entregado' ? 'entregado' : '';
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



}
