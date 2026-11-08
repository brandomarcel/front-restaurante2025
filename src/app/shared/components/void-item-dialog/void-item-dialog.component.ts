import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { finalize } from 'rxjs/operators';
import { OrdersService, VoidItemReason } from 'src/app/services/orders.service';

interface ReasonOption {
  value: VoidItemReason;
  label: string;
}

/** Renglón de la orden que se va a anular. */
export interface VoidItemTarget {
  rowName: string;
  productName: string;
  quantity: number;
  kitchenStatus: string;
}

/**
 * Anulación de un producto ya enviado. Solo se abre para quien tiene
 * `restaurant.orders.void_item` (Administrador/Gerente); el backend vuelve a validar.
 */
@Component({
  selector: 'app-void-item-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './void-item-dialog.component.html',
})
export class VoidItemDialogComponent implements OnInit {
  @Input({ required: true }) orderName!: string;
  @Input({ required: true }) item!: VoidItemTarget;
  /** El negocio lleva inventario: el aviso explica si vuelve o no. */
  @Input() inventoryEnabled = false;
  @Output() voided = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();

  readonly reasons: ReasonOption[] = [
    { value: 'customer_changed', label: 'El cliente ya no lo quiere' },
    { value: 'wrong_entry', label: 'Error al tomar el pedido' },
    { value: 'unavailable', label: 'Se acabó o no está disponible' },
    { value: 'quality', label: 'Devuelto por calidad' },
    { value: 'other', label: 'Otro motivo' },
  ];

  reason: VoidItemReason | null = null;
  comment = '';
  qty = 1;
  saving = false;

  constructor(private orders: OrdersService) {}

  ngOnInit(): void {
    this.qty = this.maxQty;
  }

  /** Cantidades enteras: el stepper anula de a una unidad (una fracción se anula completa). */
  get maxQty(): number {
    return Number(this.item?.quantity) || 1;
  }

  get canChooseQty(): boolean {
    return Number.isInteger(this.maxQty) && this.maxQty > 1;
  }

  /** Mismo criterio que el backend: solo lo que cocina no empezó vuelve al inventario. */
  get returnsStock(): boolean {
    return (this.item?.kitchenStatus || 'Pendiente') === 'Pendiente';
  }

  get canConfirm(): boolean {
    return !!this.reason && !this.saving && this.qty >= 1 && this.qty <= this.maxQty
      && (this.reason !== 'other' || this.comment.trim().length >= 3);
  }

  step(delta: number): void {
    this.qty = Math.min(this.maxQty, Math.max(1, this.qty + delta));
  }

  confirm(): void {
    if (!this.canConfirm || !this.reason) return;
    this.saving = true;
    const qty = this.canChooseQty ? this.qty : this.maxQty;
    this.orders.voidItem(this.orderName, this.item.rowName, qty, this.reason, this.comment)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (res: any) => {
          const returned = !!(res?.voided_item?.stock_returned ?? res?.message?.voided_item?.stock_returned);
          toast.success(`${qty} × ${this.item.productName} anulado.${returned ? ' Los insumos volvieron al inventario.' : ''}`);
          window.dispatchEvent(new CustomEvent('facturada:restaurant-data-changed'));
          this.voided.emit();
        },
        error: (error) => {
          const body = error?.error;
          toast.error(body?._server_messages ? this.readServerMessage(body._server_messages) : (error?.message || 'No se pudo anular el producto.'));
        },
      });
  }

  private readServerMessage(raw: string): string {
    try {
      const first = JSON.parse(JSON.parse(raw)[0]);
      return String(first?.message || 'No se pudo anular el producto.').replace(/<[^>]+>/g, '');
    } catch { return 'No se pudo anular el producto.'; }
  }
}
