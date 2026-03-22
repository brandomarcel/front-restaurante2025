import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SplitItemRequest,
  SplitOrderPayload,
  SplitPaymentRequest
} from 'src/app/services/order-split.types';

type SplitItemRowForm = {
  order_item: string;
  order_item_label?: string;
  product: string;
  qty: number;
};

type SplitPaymentRowForm = {
  formas_de_pago: string;
  monto: number;
};

type OrderItemSource = {
  rowId: string;
  orderItemRef?: string;
  product?: string;
  productName: string;
  qty: number;
  originalQty?: number;
  allocatedQty?: number;
  remainingQty?: number;
  unitPrice: number;
  taxRate: number;
  unitTotalExact: number;
};

@Component({
  selector: 'app-split-order-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './split-order-dialog.component.html'
})
export class SplitOrderDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() orderName = '';
  @Input() customerDefault = '';
  @Input() orderItemsSource: any[] = [];
  @Input() remainingOrderTotal = 0;
  @Input() nextPaymentIndex = 1;
  @Input() paymentOptions: any[] = [];
  @Input() submitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() submitSplit = new EventEmitter<SplitOrderPayload>();

  splitLabel = '';
  customer = '';
  items: SplitItemRowForm[] = [];
  payments: SplitPaymentRowForm[] = [];
  formError = '';
  orderItemOptions: OrderItemSource[] = [];
  private lastAutoPaymentAmount = 0;
  splitLabelTouched = false;
  quickSplitParts = 0;
  quickSplitPlan: number[] = [];
  itemSelectionMode: 'manual' | 'auto' = 'manual';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orderItemsSource']) {
      this.rebuildOrderItemOptions();
      this.syncDefaultPaymentFromSplit();
    }
    if (changes['paymentOptions']) {
      this.syncDefaultPaymentFromSplit();
    }
    if (changes['open'] && this.open) {
      this.resetForm();
    }
  }

  get splitTotal(): number {
    const sourceByRow = new Map(this.orderItemOptions.map((it) => [it.rowId, it]));
    const total = this.items.reduce((acc, row) => {
      const selected = sourceByRow.get(row.order_item);
      if (selected) {
        const qty = this.toPositive(row.qty, 0);
        // Alineado al backend: subtotal línea + iva línea, con redondeo por línea.
        const lineSubtotal = this.round2(qty * selected.unitPrice);
        const lineIva = this.round2(lineSubtotal * (selected.taxRate / 100));
        const lineTotal = this.round2(lineSubtotal + lineIva);
        return acc + lineTotal;
      }
      return acc;
    }, 0);

    return this.round2(total);
  }

  get paymentsTotal(): number {
    return this.round2(this.payments.reduce((acc, p) => acc + this.toPositive(p.monto, 0), 0));
  }

  get availableItemsCount(): number {
    return this.availableOrderItems.length;
  }

  get totalOrderItemsCount(): number {
    return this.orderItemOptions.length;
  }

  get selectedItemsCount(): number {
    return this.items.filter((row) => !!String(row.order_item || '').trim() || !!String(row.product || '').trim()).length;
  }

  get selectedUnitsCount(): number {
    return this.items.reduce((acc, row) => acc + this.toPositive(row.qty, 0), 0);
  }

  get hasPaymentMismatch(): boolean {
    if (!this.payments.length) return false;
    return this.round2(this.paymentsTotal) !== this.round2(this.splitTotal);
  }

  get paymentDifference(): number {
    return this.round2(this.splitTotal - this.paymentsTotal);
  }

  get remainingOrderToSplit(): number {
    return Math.max(0, this.round2(this.remainingOrderTotal));
  }

  get currentPaymentIndex(): number {
    const idx = Number(this.nextPaymentIndex);
    return Number.isFinite(idx) && idx > 0 ? Math.floor(idx) : 1;
  }

  get currentPaymentLabel(): string {
    return `PAGO ${this.currentPaymentIndex}`;
  }

  get isAutoItemMode(): boolean {
    return this.itemSelectionMode === 'auto';
  }

  get availableOrderItems(): OrderItemSource[] {
    const selectedIds = new Set(
      this.items
        .map((row) => String(row.order_item || '').trim())
        .filter((value) => !!value)
    );

    return this.orderItemOptions.filter((item) => !selectedIds.has(item.rowId));
  }

  addSourceItem(item: OrderItemSource): void {
    if (!item || this.items.some((row) => row.order_item === item.rowId)) return;

    this.itemSelectionMode = 'manual';
    this.items.push({
      order_item: item.rowId,
      order_item_label: item.productName,
      product: '',
      qty: Math.min(1, this.toPositive(item.qty, 1))
    });
    this.syncDefaultPaymentFromSplit();
  }

  addItemRow(): void {
    this.itemSelectionMode = 'manual';
    this.items.push({
      order_item: '',
      order_item_label: '',
      product: '',
      qty: 1
    });
    this.syncDefaultPaymentFromSplit();
  }

  removeItemRow(i: number): void {
    this.itemSelectionMode = 'manual';
    this.items.splice(i, 1);
    this.syncDefaultPaymentFromSplit();
  }

  addPaymentRow(): void {
    this.payments.push({
      formas_de_pago: this.getDefaultCashPaymentValue(),
      monto: 0
    });
  }

  removePaymentRow(i: number): void {
    this.payments.splice(i, 1);
  }

  onSplitLabelChange(value: string): void {
    this.splitLabel = value;
    this.splitLabelTouched = true;
  }

  configureQuickSplit(parts: number): void {
    if (parts < 2) return;

    const total = this.remainingOrderToSplit;
    const totalCents = this.toCents(total);
    const base = Math.floor(totalCents / parts);
    const remainder = totalCents % parts;

    this.quickSplitParts = parts;
    this.quickSplitPlan = Array.from({ length: parts }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);

    const currentPlanIndex = Math.min(parts, Math.max(1, this.currentPaymentIndex)) - 1;
    const suggestedAmount = this.quickSplitPlan[currentPlanIndex] ?? 0;
    const defaultMethod = this.getDefaultCashPaymentValue();
    this.itemSelectionMode = 'auto';

    this.applyItemsForTargetAmount(suggestedAmount);
    const computedAmount = this.round2(this.splitTotal);
    this.payments = [{
      formas_de_pago: defaultMethod,
      monto: computedAmount
    }];
    this.lastAutoPaymentAmount = computedAmount;

    if (!this.splitLabelTouched || !String(this.splitLabel || '').trim()) {
      this.splitLabel = this.currentPaymentLabel;
      this.splitLabelTouched = false;
    }
  }

  applyPayAllRemaining(): void {
    // Toma todo lo pendiente en items y lo paga completo en una sola linea.
    this.itemSelectionMode = 'auto';
    this.quickSplitParts = 0;
    this.quickSplitPlan = [];
    this.selectAllRemainingItems();
    this.setSinglePaymentToCurrentSplit();
  }

  enableManualItems(): void {
    this.itemSelectionMode = 'manual';
  }

  onSelectOrderItem(row: SplitItemRowForm): void {
    this.itemSelectionMode = 'manual';
    const selected = this.orderItemOptions.find((it) => it.rowId === row.order_item);
    row.order_item_label = selected?.productName || '';
    if (row.order_item) {
      row.product = '';
      row.qty = Math.min(this.toPositive(row.qty, 1), this.getItemMaxQty(row));
    }
    this.syncDefaultPaymentFromSplit();
  }

  getSelectedItemName(row: SplitItemRowForm): string {
    const selected = this.orderItemOptions.find((it) => it.rowId === row.order_item);
    return selected?.productName || row.order_item_label || '';
  }

  getSelectedItemSource(row: SplitItemRowForm): OrderItemSource | undefined {
    return this.orderItemOptions.find((it) => it.rowId === row.order_item);
  }

  getItemLineTotal(row: SplitItemRowForm): number {
    const selected = this.getSelectedItemSource(row);
    if (!selected) return 0;

    const qty = this.toPositive(row.qty, 0);
    const lineSubtotal = this.round2(qty * selected.unitPrice);
    const lineIva = this.round2(lineSubtotal * (selected.taxRate / 100));
    return this.round2(lineSubtotal + lineIva);
  }

  onWriteProduct(row: SplitItemRowForm): void {
    this.itemSelectionMode = 'manual';
    if (row.product?.trim()) {
      row.order_item = '';
      row.order_item_label = '';
    }
    this.syncDefaultPaymentFromSplit();
  }

  incrementQty(row: SplitItemRowForm): void {
    this.itemSelectionMode = 'manual';
    row.qty = this.toPositive(row.qty, 1) + 1;
    this.clampQty(row);
    this.syncDefaultPaymentFromSplit();
  }

  decrementQty(row: SplitItemRowForm): void {
    this.itemSelectionMode = 'manual';
    row.qty = Math.max(1, this.toPositive(row.qty, 1) - 1);
    this.clampQty(row);
    this.syncDefaultPaymentFromSplit();
  }

  clampQty(row: SplitItemRowForm): void {
    this.itemSelectionMode = 'manual';
    const current = this.toPositive(row.qty, 1);
    const max = this.getItemMaxQty(row);
    row.qty = Math.min(current, max);
    this.syncDefaultPaymentFromSplit();
  }

  getItemMaxQty(row: SplitItemRowForm): number {
    if (!row.order_item) return 999999;
    const selected = this.orderItemOptions.find((it) => it.rowId === row.order_item);
    return Math.max(1, Number(selected?.qty || 1));
  }

  canIncrementQty(row: SplitItemRowForm): boolean {
    return this.toPositive(row.qty, 1) < this.getItemMaxQty(row);
  }

  getPaymentLabel(payment: any): string {
    return String(payment?.description || payment?.nombre || payment?.codigo || payment?.name || 'Pago');
  }

  getPaymentValue(payment: any): string {
    return String(payment?.name || '');
  }

  submit(): void {
    if (this.submitting) return;
    this.formError = '';

    const payload = this.buildPayload();
    if (!payload) return;

    this.submitSplit.emit(payload);
  }

  handleClose(): void {
    if (this.submitting) return;
    this.close.emit();
  }

  private rebuildOrderItemOptions(): void {
    this.orderItemOptions = (this.orderItemsSource || []).map((it: any, idx: number) => {
      const orderItemRef = String(it?.order_item || it?.name || '').trim() || undefined;
      const fallbackProduct = String(it?.product || it?.productId || '').trim() || undefined;
      const rowId = orderItemRef || `product:${fallbackProduct || idx + 1}`;
      const productName = String(
        it?.product_name || it?.productName || it?.description || it?.product || 'Producto'
      );
      const remainingQty = this.toPositive(it?.remaining_qty, 0);
      const quantity = this.toPositive(it?.quantity ?? it?.qty, 0);
      const originalQty = this.toPositive(it?.original_qty, 0);
      const allocatedQty = this.toPositive(it?.allocated_qty, 0);
      const qty = this.toPositive(
        remainingQty || quantity || (originalQty - allocatedQty),
        0
      );
      const price = this.toPositive(it?.price ?? it?.rate, 0);
      const taxRate = Number(it?.tax_rate ?? it?.tax_value ?? 0) || 0;
      const sourceTotal = Number(it?.total);
      const sourceQtyForUnit =
        this.toPositive(it?.quantity ?? it?.qty, 0) ||
        this.toPositive(it?.original_qty, 0) ||
        qty;
      const unitTotalExact =
        Number.isFinite(sourceTotal) && sourceQtyForUnit > 0
          ? (sourceTotal / sourceQtyForUnit)
          : (price * (1 + taxRate / 100));

      return {
        rowId,
        orderItemRef,
        product: fallbackProduct,
        productName,
        qty,
        originalQty,
        allocatedQty,
        remainingQty,
        unitPrice: price,
        taxRate,
        unitTotalExact
      };
    })
    .filter((it) => it.qty > 0);
  }

  private resetForm(): void {
    this.splitLabel = this.currentPaymentLabel;
    this.customer = this.customerDefault || '';
    this.items = [];
    this.payments = [this.buildDefaultPaymentRow()];
    this.formError = '';
    this.splitLabelTouched = false;
    this.quickSplitParts = 0;
    this.quickSplitPlan = [];
    this.itemSelectionMode = 'manual';
  }

  private selectAllRemainingItems(): void {
    if (!this.orderItemOptions.length) return;
    this.items = this.orderItemOptions.map((it) => ({
      order_item: it.rowId,
      order_item_label: it.productName,
      product: '',
      qty: Math.max(1, this.toPositive(it.qty, 1))
    }));
  }

  private setSinglePaymentToCurrentSplit(): void {
    const total = this.round2(this.splitTotal);
    this.payments = [{
      formas_de_pago: this.getDefaultCashPaymentValue(),
      monto: total
    }];
    this.lastAutoPaymentAmount = total;
  }

  private applyItemsForTargetAmount(targetAmount: number): void {
    const source = this.orderItemOptions || [];
    if (!source.length) return;

    const positiveTarget = Math.max(0, this.round2(targetAmount));
    if (positiveTarget <= 0) return;

    const remainingTotal = this.round2(
      source.reduce((acc, it) => acc + this.round2(this.toPositive(it.qty, 0) * this.toPositive(it.unitTotalExact, 0)), 0)
    );
    if (remainingTotal <= 0) return;

    const ratio = Math.min(1, positiveTarget / remainingTotal);
    const draftItems: SplitItemRowForm[] = source
      .map((it) => ({
        order_item: it.rowId,
        order_item_label: it.productName,
        product: '',
        qty: this.round4(this.toPositive(it.qty, 0) * ratio)
      }))
      .filter((it) => it.qty > 0);

    if (!draftItems.length) return;
    this.items = draftItems;

    const first = this.items[0];
    const firstSrc = source.find((x) => x.rowId === first.order_item);
    if (!firstSrc) return;

    // Ajuste fino para acercar el total al objetivo.
    const current = this.round2(this.splitTotal);
    const diff = this.round2(positiveTarget - current);
    if (diff === 0) return;

    const unit = this.toPositive(firstSrc.unitTotalExact, 0);
    if (unit <= 0) return;

    const deltaQty = this.round4(diff / unit);
    const maxQty = this.toPositive(firstSrc.qty, 0);
    first.qty = this.clampNumber(this.round4(first.qty + deltaQty), 0.0001, maxQty);
  }

  private buildDefaultPaymentRow(): SplitPaymentRowForm {
    const monto = this.round2(this.splitTotal);
    this.lastAutoPaymentAmount = monto;
    return {
      formas_de_pago: this.getDefaultCashPaymentValue(),
      monto
    };
  }

  private syncDefaultPaymentFromSplit(): void {
    if (!this.shouldAutoSyncSinglePayment()) return;
    const monto = this.round2(this.splitTotal);
    this.payments[0].formas_de_pago = this.getDefaultCashPaymentValue() || this.payments[0].formas_de_pago;
    this.payments[0].monto = monto;
    this.lastAutoPaymentAmount = monto;
  }

  private shouldAutoSyncSinglePayment(): boolean {
    if (!this.payments.length) return false;
    if (this.payments.length > 1) return false;

    const row = this.payments[0];
    const defaultMethod = this.getDefaultCashPaymentValue();
    const sameMethod = !row.formas_de_pago || row.formas_de_pago === defaultMethod;
    const currentAmount = this.round2(this.toPositive(row.monto, 0));
    const sameAmount = currentAmount === 0 || currentAmount === this.lastAutoPaymentAmount;

    return sameMethod && sameAmount;
  }

  private getDefaultCashPaymentValue(): string {
    if (!Array.isArray(this.paymentOptions) || !this.paymentOptions.length) {
      return '';
    }

    const efectivo = this.paymentOptions.find((payment) => {
      const label = this.getPaymentLabel(payment).toLowerCase();
      const value = this.getPaymentValue(payment).toLowerCase();
      return label.includes('efectivo') || value.includes('efectivo');
    });

    if (efectivo) return this.getPaymentValue(efectivo);
    return this.getPaymentValue(this.paymentOptions[0]);
  }

  private buildPayload(): SplitOrderPayload | null {
    const splitLabel = String(this.splitLabel || '').trim();
    if (!splitLabel) {
      this.formError = 'Debes ingresar la etiqueta de la subcuenta.';
      return null;
    }

    const sourceById = new Map(this.orderItemOptions.map((it) => [it.rowId, it]));
    const cleanedItems: SplitItemRequest[] = this.items
      .map((it) => {
        const selectedSource = sourceById.get(String(it.order_item || '').trim());
        const manualProduct = String(it.product || '').trim() || undefined;
        const order_item = selectedSource?.orderItemRef;
        const product = !order_item
          ? (manualProduct || selectedSource?.product || undefined)
          : undefined;

        return {
          order_item,
          product,
          qty: this.toPositive(it.qty, 0)
        };
      })
      .filter((it) => !!it.order_item || !!it.product);

    if (!cleanedItems.length) {
      this.formError = 'Debes agregar al menos 1 item.';
      return null;
    }

    const invalidQty = cleanedItems.some((it) => !it.qty || it.qty <= 0);
    if (invalidQty) {
      this.formError = 'La cantidad (qty) debe ser mayor a 0 en todos los items.';
      return null;
    }

    const byOrderItem = cleanedItems.filter((it) => !!it.order_item);
    const duplicatedOrderItem = byOrderItem.some((it, idx) =>
      byOrderItem.findIndex((x) => x.order_item === it.order_item) !== idx
    );
    if (duplicatedOrderItem) {
      this.formError = 'No puedes repetir la misma fila de orden en mas de un item de subcuenta.';
      return null;
    }

    const exceedsAvailable = cleanedItems.some((it) => {
      if (!it.order_item) return false;
      const source = this.orderItemOptions.find((x) => x.rowId === it.order_item);
      if (!source) return false;
      return Number(it.qty) > Number(source.qty || 0);
    });
    if (exceedsAvailable) {
      this.formError = 'La cantidad de un item supera lo disponible en la orden original.';
      return null;
    }

    const normalizedPayments = this.payments.map((p) => ({
      formas_de_pago: String(p.formas_de_pago || '').trim(),
      monto: this.round2(this.toPositive(p.monto, 0))
    }));

    const hasIncompletePayments = normalizedPayments.some((p) => {
      const hasMethod = !!p.formas_de_pago;
      const hasAmount = p.monto > 0;
      return hasMethod !== hasAmount;
    });
    if (hasIncompletePayments) {
      this.formError = 'Cada pago debe tener forma de pago y monto mayor a 0.';
      return null;
    }

    const cleanedPayments: SplitPaymentRequest[] = normalizedPayments.filter((p) => !!p.formas_de_pago && p.monto > 0);
    if (!cleanedPayments.length) {
      this.formError = 'Debes registrar al menos 1 pago para crear la subcuenta.';
      return null;
    }

    const expectedTotal = this.round2(this.splitTotal);
    const paymentsSum = this.round2(cleanedPayments.reduce((acc, p) => acc + this.toPositive(p.monto, 0), 0));
    if (paymentsSum !== expectedTotal) {
      this.formError =
        `La suma de pagos (${paymentsSum.toFixed(2)}) debe ser igual al total de la subcuenta (${expectedTotal.toFixed(2)}).`;
      return null;
    }

    const payload: SplitOrderPayload = {
      order_name: this.orderName,
      split_label: splitLabel,
      customer: String(this.customer || '').trim() || undefined,
      items: cleanedItems,
      payments: cleanedPayments
    };

    return payload;
  }

  private toPositive(value: any, fallback = 0): number {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return n > 0 ? n : fallback;
  }

  private round2(n: number): number {
    const value = Number(n);
    if (!Number.isFinite(value)) return 0;
    // Sin EPSILON para no forzar el 0.5 hacia arriba y alinearnos al comportamiento observado del backend.
    return Math.round(value * 100) / 100;
  }

  private toCents(n: number): number {
    return Math.round(this.round2(n) * 100);
  }

  private round4(n: number): number {
    const value = Number(n);
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 10000) / 10000;
  }

  private clampNumber(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }
}
