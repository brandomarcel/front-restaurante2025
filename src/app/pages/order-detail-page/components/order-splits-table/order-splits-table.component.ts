import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OrderSplitRow } from 'src/app/services/order-split.types';
import { PosCustomerPickerComponent } from 'src/app/pages/pos/pos-caja/ui/pos-customer-picker.component';

@Component({
  selector: 'app-order-splits-table',
  standalone: true,
  imports: [CommonModule, PosCustomerPickerComponent],
  templateUrl: './order-splits-table.component.html'
})
export class OrderSplitsTableComponent {
  @Input() splits: OrderSplitRow[] = [];
  @Input() loading = false;
  @Input() actionLoadingSplitName = '';
  @Input() deleteLoadingSplitName = '';
  @Input() orderGrandTotal = 0;
  @Input() canInvoice = false;
  @Input() canDelete = false;
  @Output() invoiceSplit = new EventEmitter<OrderSplitRow>();
  @Output() deleteSplit = new EventEmitter<OrderSplitRow>();
  @Output() viewInvoice = new EventEmitter<string>();
  @Input() canChangeCustomer = false;
  @Input() customerChangingSplitName = '';
  @Output() changeCustomer = new EventEmitter<{ row: OrderSplitRow; customer: any }>();
  /** Subcuenta cuyo cliente se está eligiendo. */
  editingCustomerSplit = '';
  expandedSplitName = '';

  onInvoice(row: OrderSplitRow | null | undefined): void {
    if (!row?.name) return;
    if (!this.canInvoice || this.hasInvoice(row)) return;
    if (this.isInvoicing(row) || this.isDeleting(row)) return;
    this.invoiceSplit.emit(row);
  }

  onDelete(row: OrderSplitRow | null | undefined): void {
    if (!row?.name) return;
    if (!this.canDelete || this.hasInvoice(row)) return;
    if (this.isInvoicing(row) || this.isDeleting(row)) return;
    this.deleteSplit.emit(row);
  }

  isInvoicing(row: OrderSplitRow | null | undefined): boolean {
    return !!row?.name && this.actionLoadingSplitName === row.name;
  }

  isDeleting(row: OrderSplitRow | null | undefined): boolean {
    return !!row?.name && this.deleteLoadingSplitName === row.name;
  }

  getSriStatus(row: OrderSplitRow | null | undefined): string {
    return row?.provider_status || row?.sri?.status || 'Sin factura';
  }

  hasInvoice(row: OrderSplitRow | null | undefined): boolean {
    return !!String(row?.lite_invoice || row?.invoice || row?.sri?.invoice || '').trim();
  }

  openInvoice(row: OrderSplitRow): void {
    const invoice = String(row?.lite_invoice || row?.invoice || row?.sri?.invoice || '').trim();
    if (invoice) this.viewInvoice.emit(invoice);
  }

  toggleCustomerEditor(row: OrderSplitRow): void {
    this.editingCustomerSplit = this.editingCustomerSplit === row?.name ? '' : (row?.name || '');
  }

  onCustomerPicked(row: OrderSplitRow, customer: any): void {
    if (!customer?.name) return;
    this.editingCustomerSplit = '';
    this.changeCustomer.emit({ row, customer });
  }

  trackBySplit = (_: number, row: OrderSplitRow) => row?.name;

  getCustomerName(row: OrderSplitRow | null | undefined): string {
    const customer = row?.customer as any;
    return String(row?.customer_name || customer?.customer_name || customer?.nombre || customer?.fullName || customer || 'Consumidor final');
  }

  getStatusClass(row: OrderSplitRow): string {
    const status = String(row?.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (status.includes('PAGADA') || status.includes('FACTURADA') || status.includes('AUTORIZ')) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300';
    if (status.includes('PENDIENTE')) return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
    if (status.includes('RECHAZ') || status.includes('ERROR')) return 'bg-destructive/10 text-destructive';
    if (status.includes('CANCEL')) return 'bg-muted text-muted-foreground';
    return 'bg-sky-500/15 text-sky-700 dark:text-sky-300';
  }

  toggleExpanded(row: OrderSplitRow | null | undefined): void {
    if (!row?.name) return;
    this.expandedSplitName = this.expandedSplitName === row.name ? '' : row.name;
  }

  isExpanded(row: OrderSplitRow | null | undefined): boolean {
    return !!row?.name && this.expandedSplitName === row.name;
  }

  /** Etiqueta de cobro: lo que el cajero necesita saber de la subcuenta. */
  getChargeLabel(row: OrderSplitRow | null | undefined): string {
    if (!this.hasInvoice(row)) return 'Por facturar';
    const sri = this.getSriStatus(row);
    return sri === 'Sin factura' ? 'Facturada' : sri;
  }

  get splitTotalSum(): number {
    return this.round2(this.splits.reduce((acc, row) => acc + this.round2(this.toNumber(row?.total)), 0));
  }

  get pendingToSplitFromOrder(): number {
    return this.round2(this.toNumber(this.orderGrandTotal) - this.splitTotalSum);
  }

  get splitPaymentsSum(): number {
    return this.round2(this.splits.reduce((acc, row) => acc + this.getPaymentsSum(row), 0));
  }

  get hasAnyPayments(): boolean {
    return this.splits.some((row) => (row?.payments || []).length > 0);
  }

  // Suma de subcuentas que SI tienen pagos registrados.
  get splitTotalWithPaymentsSum(): number {
    return this.round2(
      this.splits.reduce((acc, row) => {
        const hasPayments = (row?.payments || []).length > 0;
        if (!hasPayments) return acc;
        return acc + this.round2(this.toNumber(row?.total));
      }, 0)
    );
  }

  get pendingToMatchPayments(): number {
    if (!this.hasAnyPayments) return 0;
    return this.round2(this.splitTotalWithPaymentsSum - this.splitPaymentsSum);
  }

  get hasGlobalMismatch(): boolean {
    return this.hasAnyPayments && this.pendingToMatchPayments !== 0;
  }

  get globalDifferenceLabel(): string {
    if (!this.hasAnyPayments) return 'Sin pagos registrados';
    if (this.pendingToMatchPayments > 0) return 'Faltante por cuadrar';
    if (this.pendingToMatchPayments < 0) return 'Excedente en pagos';
    return 'Pagos cuadrados';
  }

  getPaymentsSum(row: OrderSplitRow | null | undefined): number {
    const payments = Array.isArray(row?.payments) ? row.payments : [];
    return this.round2(payments.reduce((acc, p: any) => {
      const amount = this.toNumber(p?.monto ?? p?.amount);
      return acc + this.round2(amount);
    }, 0));
  }

  hasPaymentMismatch(row: OrderSplitRow | null | undefined): boolean {
    const payments = Array.isArray(row?.payments) ? row.payments : [];
    if (!payments.length) return false;
    return this.round2(this.round2(this.toNumber(row?.total)) - this.getPaymentsSum(row)) !== 0;
  }

  getPaymentDifference(row: OrderSplitRow | null | undefined): number {
    return this.round2(this.round2(this.toNumber(row?.total)) - this.getPaymentsSum(row));
  }

  getPaymentDifferenceLabel(row: OrderSplitRow | null | undefined): string {
    const diff = this.getPaymentDifference(row);
    if (diff > 0) return `Faltante: $${diff.toFixed(2)}`;
    if (diff < 0) return `Excedente: $${Math.abs(diff).toFixed(2)}`;
    return 'Pago cuadrado';
  }

  getItemName(item: any): string {
    const name = String(item?.item_name || item?.productName || item?.product_name || item?.productId || item?.product || item?.item || 'Producto');
    const code = String(item?.item_code || item?.product_code || item?.codigo || '').trim();
    return code ? `${code} · ${name}` : name;
  }

  getItemQty(item: any): number {
    return this.toNumber(item?.qty ?? item?.quantity);
  }

  getItemPrice(item: any): number {
    return this.toNumber(item?.rate ?? item?.price);
  }

  getPaymentMethod(payment: any): string {
    return String(payment?.payment_method || payment?.formas_de_pago || payment?.method || 'Metodo');
  }

  getPaymentAmount(payment: any): number {
    return this.toNumber(payment?.monto ?? payment?.amount);
  }

  private toNumber(value: any): number {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

}
