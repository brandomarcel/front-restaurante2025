import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { finalize } from 'rxjs/operators';
import { ForceCloseReason, OrdersService } from 'src/app/services/orders.service';

interface ReasonOption {
  value: ForceCloseReason;
  label: string;
  hint: string;
}

/**
 * Diálogo del cierre administrativo de una orden. Solo se abre para quien tiene
 * `restaurant.orders.force_close`; el backend vuelve a validar el permiso.
 */
@Component({
  selector: 'app-force-close-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './force-close-dialog.component.html',
})
export class ForceCloseDialogComponent {
  @Input({ required: true }) orderName!: string;
  @Output() closed = new EventEmitter<void>();
  @Output() dismissed = new EventEmitter<void>();

  readonly reasons: ReasonOption[] = [
    { value: 'unpaid', label: 'El cliente se fue sin pagar', hint: 'Se registra como pérdida; no cuenta como venta.' },
    { value: 'paid_outside', label: 'Se cobró fuera del sistema', hint: 'Cobrada en efectivo o por otro medio; no genera comprobante.' },
    { value: 'duplicate', label: 'Pedido duplicado o de prueba', hint: 'Se cierra sin contar como venta.' },
    { value: 'other', label: 'Otro motivo', hint: 'Describe qué pasó.' },
  ];

  reason: ForceCloseReason | null = null;
  comment = '';
  saving = false;

  constructor(private orders: OrdersService) {}

  get canConfirm(): boolean {
    return !!this.reason && !this.saving && (this.reason !== 'other' || this.comment.trim().length >= 3);
  }

  confirm(): void {
    if (!this.canConfirm || !this.reason) return;
    this.saving = true;
    this.orders.forceClose(this.orderName, this.reason, this.comment)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => {
          toast.success('Orden cerrada manualmente. La mesa quedó libre.');
          window.dispatchEvent(new CustomEvent('facturada:restaurant-data-changed'));
          this.closed.emit();
        },
        error: (error) => {
          const body = error?.error;
          toast.error(body?._server_messages ? this.readServerMessage(body._server_messages) : (error?.message || 'No se pudo cerrar la orden.'));
        },
      });
  }

  private readServerMessage(raw: string): string {
    try {
      const first = JSON.parse(JSON.parse(raw)[0]);
      return String(first?.message || 'No se pudo cerrar la orden.').replace(/<[^>]+>/g, '');
    } catch { return 'No se pudo cerrar la orden.'; }
  }
}
