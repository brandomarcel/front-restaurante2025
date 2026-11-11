import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SriAnnulmentOverview } from 'src/app/services/invoices.service';
import { SriAnnulmentDialogComponent, SriAnnulmentKind } from '../sri-annulment-dialog/sri-annulment-dialog.component';

const LABELS: Record<Exclude<SriAnnulmentKind, 'invoice'>, { title: string; annulled: string; effect: string }> = {
  withholding: {
    title: 'Anular retención',
    annulled: 'Retención anulada en el SRI',
    effect: 'Ya no cuenta como retención emitida; si llevas contabilidad, la retención contable se cancela sola.',
  },
  'purchase-settlement': {
    title: 'Anular liquidación',
    annulled: 'Liquidación anulada en el SRI',
    effect: 'Ya no cuenta como compra; si llevas contabilidad, la compra contable se cancela sola.',
  },
};

/**
 * Anulación en el SRI de una retención o liquidación de compra, en su detalle:
 * - `mode="banner"`: franja con la constancia (fecha, motivo, quién y cuándo) si el comprobante está anulado.
 * - `mode="action"`: sección «Anular …» con el botón «Ya la anulé en el SRI», o el motivo si no se puede.
 *   Solo la ve quien tiene `billing.void` (`sri_annulment.allowed` del detalle). El backend vuelve a validar.
 */
@Component({
  selector: 'app-sri-annulment-section',
  standalone: true,
  imports: [CommonModule, SriAnnulmentDialogComponent],
  templateUrl: './sri-annulment-section.component.html',
})
export class SriAnnulmentSectionComponent {
  @Input({ required: true }) kind!: Exclude<SriAnnulmentKind, 'invoice'>;
  @Input({ required: true }) mode!: 'banner' | 'action';
  /** Detalle serializado por Lite (`status`, `annulled_at`, `sri_annulment`…). */
  @Input() document: any = null;
  @Input() documentNumber = '';
  @Output() annulled = new EventEmitter<void>();

  showDialog = false;

  get labels() { return LABELS[this.kind]; }
  get isAnnulled(): boolean { return String(this.document?.status || '').trim().toUpperCase() === 'ANULADA'; }
  get overview(): SriAnnulmentOverview | null { return this.document?.sri_annulment ?? null; }
  /** Solo sobre un comprobante autorizado: en borrador o en proceso no hay nada que anular en el SRI. */
  get allowed(): boolean {
    return !!this.overview?.allowed && String(this.document?.status || '').trim().toUpperCase() === 'AUTORIZADA';
  }
  get available(): boolean { return this.allowed && !!this.overview?.available; }
  get blockReason(): string { return this.allowed ? this.overview?.block_reason || '' : ''; }

  formatDate(value: any): string {
    const text = String(value || '').trim();
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(text);
    if (!match) return text || '—';
    const date = `${match[3]}/${match[2]}/${match[1]}`;
    return match[4] ? `${date} ${match[4]}:${match[5]}` : date;
  }

  onAnnulled(): void {
    this.showDialog = false;
    this.annulled.emit();
  }
}
