import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { OrderSplitRow } from 'src/app/services/order-split.types';

@Component({
  selector: 'app-order-splits-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-splits-table.component.html'
})
export class OrderSplitsTableComponent {
  @Input() splits: OrderSplitRow[] = [];
  @Input() loading = false;
  @Input() actionLoadingSplitName = '';
  @Input() deleteLoadingSplitName = '';
  @Input() orderGrandTotal = 0;
  @Output() invoiceSplit = new EventEmitter<OrderSplitRow>();
  @Output() deleteSplit = new EventEmitter<OrderSplitRow>();
  expandedSplitName = '';
  showDetailModal = false;
  detailRow: OrderSplitRow | null = null;

  onInvoice(row: OrderSplitRow | null | undefined): void {
    if (!row?.name) return;
    if (this.isInvoicing(row) || this.isDeleting(row)) return;
    this.invoiceSplit.emit(row);
  }

  onDelete(row: OrderSplitRow | null | undefined): void {
    if (!row?.name) return;
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
    return row?.sri?.status || 'Sin factura';
  }

  toggleExpanded(row: OrderSplitRow | null | undefined): void {
    if (!row?.name) return;
    this.expandedSplitName = this.expandedSplitName === row.name ? '' : row.name;
  }

  isExpanded(row: OrderSplitRow | null | undefined): boolean {
    return !!row?.name && this.expandedSplitName === row.name;
  }

  onDetail(row: OrderSplitRow | null | undefined): void {
    if (!row?.name) return;
    if (this.isMobileViewport()) {
      this.detailRow = row;
      this.showDetailModal = true;
      return;
    }
    this.toggleExpanded(row);
  }

  closeDetailModal(): void {
    this.showDetailModal = false;
    this.detailRow = null;
  }

  getDetailButtonLabel(row: OrderSplitRow | null | undefined): string {
    if (this.isMobileViewport()) return 'Detalle';
    return this.isExpanded(row) ? 'Ocultar' : 'Detalle';
  }

  get splitTotalSum(): number {
    return this.round2(this.splits.reduce((acc, row) => acc + this.toNumber(row?.total), 0));
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

    console.log('this.splits',this.splits);
    return this.round2(
      this.splits.reduce((acc, row) => {
        const hasPayments = (row?.payments || []).length > 0;
        if (!hasPayments) return acc;
        return acc + this.toNumber(row?.total);
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
      return acc + amount;
    }, 0));
  }

  hasPaymentMismatch(row: OrderSplitRow | null | undefined): boolean {
    const payments = Array.isArray(row?.payments) ? row.payments : [];
    if (!payments.length) return false;
    return this.round2(this.toNumber(row?.total) - this.getPaymentsSum(row)) !== 0;
  }

  getPaymentDifference(row: OrderSplitRow | null | undefined): number {
    return this.round2(this.toNumber(row?.total) - this.getPaymentsSum(row));
  }

  getPaymentDifferenceLabel(row: OrderSplitRow | null | undefined): string {
    const diff = this.getPaymentDifference(row);
    if (diff > 0) return `Faltante: $${diff.toFixed(2)}`;
    if (diff < 0) return `Excedente: $${Math.abs(diff).toFixed(2)}`;
    return 'Pago cuadrado';
  }

  getItemName(item: any): string {
    return String(item?.productName || item?.product_name || item?.productId || item?.product || 'Producto');
  }

  getItemQty(item: any): number {
    return this.toNumber(item?.qty ?? item?.quantity);
  }

  getItemPrice(item: any): number {
    return this.toNumber(item?.rate ?? item?.price);
  }

  getPaymentMethod(payment: any): string {
    return String(payment?.formas_de_pago || payment?.method || 'Metodo');
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

  private isMobileViewport(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  }
}
