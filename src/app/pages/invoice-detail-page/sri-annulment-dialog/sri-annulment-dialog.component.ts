import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { finalize } from 'rxjs/operators';
import { InvoicesService, SriAnnulmentOverview, SriAnnulmentResult, SriAnnulmentStockRow } from 'src/app/services/invoices.service';

const OTHER = 'Otro';
const MIN_REASON_LENGTH = 5;

/**
 * Registra en el sistema una factura autorizada que el negocio ya anuló en el portal del SRI.
 * No envía nada al SRI. Se abre solo si el backend la ofrece (`sri_annulment.available`,
 * Administrador y Gerente con `billing.void`); el backend vuelve a validar todo.
 */
@Component({
  selector: 'app-sri-annulment-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sri-annulment-dialog.component.html',
})
export class SriAnnulmentDialogComponent implements OnInit {
  @Input({ required: true }) invoiceName!: string;
  @Input() invoiceNumber = '';
  /** Fecha de emisión `YYYY-MM-DD`: la anulación no puede ser anterior. */
  @Input() postingDate = '';
  @Input() overview: SriAnnulmentOverview | null = null;
  /** La factura viene de una orden o nota de venta: su inventario no vuelve. */
  @Input() fromSource = false;
  @Output() annulled = new EventEmitter<SriAnnulmentResult>();
  @Output() dismissed = new EventEmitter<void>();

  readonly reasons = [
    'Error en los datos del cliente',
    'Error en precio o cantidad',
    'Factura emitida por duplicado',
    'La venta no se concretó',
    'Solicitud del cliente',
    OTHER,
  ];

  date = '';
  reason = '';
  detail = '';
  reference = '';
  confirmed = false;
  saving = false;
  readonly today = localIsoDate(new Date());

  constructor(private invoices: InvoicesService) {}

  ngOnInit(): void {
    this.date = this.today;
  }

  get minDate(): string {
    return /^\d{4}-\d{2}-\d{2}/.test(this.postingDate) ? this.postingDate.slice(0, 10) : '';
  }

  get stockRows(): SriAnnulmentStockRow[] {
    return this.overview?.stock_to_return ?? [];
  }

  get finalReason(): string {
    const detail = this.detail.trim();
    if (this.reason === OTHER) return detail;
    return detail ? `${this.reason}: ${detail}` : this.reason;
  }

  get dateError(): string {
    if (!this.date) return 'Indica la fecha.';
    if (this.date > this.today) return 'No puede ser posterior a hoy.';
    if (this.minDate && this.date < this.minDate) return 'No puede ser anterior a la emisión de la factura.';
    return '';
  }

  get canConfirm(): boolean {
    return !this.saving && this.confirmed && !this.dateError && this.finalReason.length >= MIN_REASON_LENGTH;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.saving) this.dismissed.emit();
  }

  quantity(value: number): string {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(6)));
  }

  confirm(): void {
    if (!this.canConfirm) return;
    this.saving = true;
    this.invoices
      .registerSriAnnulment(this.invoiceName, {
        date: this.date,
        reason: this.finalReason,
        reference: this.reference.trim(),
        confirmed: this.confirmed,
      })
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (result) => {
          const returned = result?.stock_returned?.length ?? 0;
          const skipped = result?.stock_skipped?.length ?? 0;
          let message = 'Factura registrada como anulada en el SRI.';
          if (returned) message += ' Los productos volvieron al inventario.';
          if (skipped) message += ' Algunos productos no volvieron al inventario: revisa el detalle.';
          toast.success(message);
          this.annulled.emit(result);
        },
        error: (error) => toast.error(readServerError(error, 'No se pudo registrar la anulación.')),
      });
  }
}

function localIsoDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function readServerError(error: any, fallback: string): string {
  const raw = error?.error?._server_messages;
  if (raw) {
    try {
      const first = JSON.parse(JSON.parse(raw)[0]);
      return String(first?.message || fallback).replace(/<[^>]+>/g, '');
    } catch { /* usa el mensaje general */ }
  }
  const message = error?.error?.message ?? error?.error?._error_message;
  return typeof message === 'string' && message ? message : fallback;
}
