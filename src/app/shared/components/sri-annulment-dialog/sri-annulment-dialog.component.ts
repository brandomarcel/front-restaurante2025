import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Injector, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import {
  InvoicesService, SriAnnulmentOverview, SriAnnulmentRequest, SriAnnulmentResult, SriAnnulmentStockRow
} from 'src/app/services/invoices.service';
import { PurchaseSettlementsService } from 'src/app/services/purchase-settlements.service';
import { WithholdingsService } from 'src/app/services/withholdings.service';

const OTHER = 'Otro';
const MIN_REASON_LENGTH = 5;

/** Comprobantes que se pueden registrar como anulados en el SRI. */
export type SriAnnulmentKind = 'invoice' | 'withholding' | 'purchase-settlement';

interface KindConfig {
  /** Título bajo el encabezado («Factura 001-001-…»). */
  title: string;
  /** «esta factura», para las frases del diálogo. */
  thisDoc: string;
  emissionOf: string;
  success: string;
  reasons: string[];
  detailPlaceholder: string;
  /** Nota sobre lo que pasa después (dinero, contabilidad). La factura muestra además su inventario. */
  note: string;
}

const KINDS: Record<SriAnnulmentKind, KindConfig> = {
  invoice: {
    title: 'Factura', thisDoc: 'esta factura', emissionOf: 'la emisión de la factura',
    success: 'Factura registrada como anulada en el SRI.',
    reasons: ['Error en los datos del cliente', 'Error en precio o cantidad', 'Factura emitida por duplicado',
      'La venta no se concretó', 'Solicitud del cliente', OTHER],
    detailPlaceholder: 'Ej. se facturó a otra persona; se emitió una nueva factura',
    note: 'El dinero no se mueve solo: si devolviste efectivo, regístralo como retiro de caja.',
  },
  withholding: {
    title: 'Retención', thisDoc: 'esta retención', emissionOf: 'la emisión de la retención',
    success: 'Retención registrada como anulada en el SRI.',
    reasons: ['Código o porcentaje de retención equivocado', 'Datos del proveedor equivocados',
      'Factura del proveedor equivocada', 'Retención emitida por duplicado', 'La compra no se concretó', OTHER],
    detailPlaceholder: 'Ej. se retuvo al 2 % y era 3 %; se emitirá una nueva retención',
    note: 'Si llevas contabilidad, la retención contable se cancela sola y la deuda con el proveedor vuelve a su valor sin '
      + 'la retención. Si hace falta, emite una retención nueva.',
  },
  'purchase-settlement': {
    title: 'Liquidación de compra', thisDoc: 'esta liquidación', emissionOf: 'la emisión de la liquidación',
    success: 'Liquidación registrada como anulada en el SRI.',
    reasons: ['Datos del proveedor equivocados', 'Error en precio o cantidad', 'Liquidación emitida por duplicado',
      'La compra no se concretó', OTHER],
    detailPlaceholder: 'Ej. el valor era otro; se emitirá una nueva liquidación',
    note: 'El dinero no se mueve solo: si ya le pagaste al proveedor, eso no se revierte aquí. Si llevas contabilidad, la '
      + 'compra se cancela sola; si su pago ya está registrado, tu contador debe anularlo primero.',
  },
};

/**
 * Registra en el sistema un comprobante autorizado (factura, retención o liquidación de compra) que el negocio ya
 * anuló en el portal del SRI. No envía nada al SRI. Se abre solo si el backend la ofrece (`sri_annulment.available`,
 * Administrador y Gerente con `billing.void`); el backend vuelve a validar todo.
 */
@Component({
  selector: 'app-sri-annulment-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sri-annulment-dialog.component.html',
})
export class SriAnnulmentDialogComponent implements OnInit {
  @Input() kind: SriAnnulmentKind = 'invoice';
  /** Nombre del documento (ID). `invoiceName` se conserva por compatibilidad con la factura. */
  @Input() documentName = '';
  @Input() invoiceName = '';
  @Input() documentNumber = '';
  @Input() invoiceNumber = '';
  /** Fecha de emisión `YYYY-MM-DD`: la anulación no puede ser anterior. */
  @Input() postingDate = '';
  @Input() overview: SriAnnulmentOverview | null = null;
  /** La factura viene de una orden o nota de venta: su inventario no vuelve. */
  @Input() fromSource = false;
  @Output() annulled = new EventEmitter<SriAnnulmentResult>();
  @Output() dismissed = new EventEmitter<void>();

  date = '';
  reason = '';
  detail = '';
  reference = '';
  confirmed = false;
  saving = false;
  readonly today = localIsoDate(new Date());

  // Los servicios de retención y liquidación se piden solo al usarlos: la factura no los necesita.
  private readonly injector = inject(Injector);

  constructor(private invoices: InvoicesService) {}

  ngOnInit(): void {
    this.date = this.today;
  }

  get config(): KindConfig { return KINDS[this.kind] ?? KINDS.invoice; }
  get reasons(): string[] { return this.config.reasons; }
  get name(): string { return this.documentName || this.invoiceName; }
  get number(): string { return this.documentNumber || this.invoiceNumber || this.name; }
  get isInvoice(): boolean { return this.kind === 'invoice'; }

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
    if (this.minDate && this.date < this.minDate) return `No puede ser anterior a ${this.config.emissionOf}.`;
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
    const request: SriAnnulmentRequest = {
      date: this.date,
      reason: this.finalReason,
      reference: this.reference.trim(),
      confirmed: this.confirmed,
    };
    this.register(request)
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: (result) => {
          const returned = result?.stock_returned?.length ?? 0;
          const skipped = result?.stock_skipped?.length ?? 0;
          let message = this.config.success;
          if (returned) message += ' Los productos volvieron al inventario.';
          if (skipped) message += ' Algunos productos no volvieron al inventario: revisa el detalle.';
          toast.success(message);
          this.annulled.emit(result);
        },
        error: (error) => toast.error(readServerError(error, 'No se pudo registrar la anulación.')),
      });
  }

  private register(request: SriAnnulmentRequest): Observable<SriAnnulmentResult> {
    if (this.kind === 'withholding') {
      return this.injector.get(WithholdingsService).registerSriAnnulment(this.name, request) as Observable<SriAnnulmentResult>;
    }
    if (this.kind === 'purchase-settlement') {
      return this.injector.get(PurchaseSettlementsService).registerSriAnnulment(this.name, request) as Observable<SriAnnulmentResult>;
    }
    return this.invoices.registerSriAnnulment(this.name, request);
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
