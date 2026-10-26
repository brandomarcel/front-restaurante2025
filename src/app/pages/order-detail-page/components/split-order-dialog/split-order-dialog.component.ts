import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  SplitItemRequest,
  SplitOrderPayload,
  SplitPaymentRequest
} from 'src/app/services/order-split.types';
import { findPaymentMethod, getPaymentDisplayLabel, getPaymentValue as getInternalPaymentValue, isPaymentMethodAlreadySelected, isTransferPayment, PAYMENT_REFERENCE_MAX_LENGTH } from 'src/app/shared/utils/payment.utils';
import { DecimalInputDirective } from 'src/app/shared/directives/decimal-input.directive';
import { PosCustomerPickerComponent } from 'src/app/pages/pos/pos-caja/ui/pos-customer-picker.component';
import { FINAL_CONSUMER_IDENTIFICATION } from 'src/app/pages/pos/pos-caja/pos-sale.rules';
import { fromCents, lineTotalsCents, roundQty, splitDiscountShareCents, toCents } from 'src/app/shared/utils/money-cents.utils';

type SplitItemRowForm = {
  order_item: string;
  order_item_label?: string;
  product: string;
  qty: number;
};

type SplitPaymentRowForm = {
  formas_de_pago: string;
  monto: number;
  /** Número de transferencia (opcional). */
  reference?: string;
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
  /** Descuento de la línea aún no asignado a otras subcuentas, en centavos. */
  remainingDiscountCents: number;
};

@Component({
  selector: 'app-split-order-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, DecimalInputDirective, PosCustomerPickerComponent],
  templateUrl: './split-order-dialog.component.html'
})
export class SplitOrderDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() orderName = '';
  @Input() customerDefault = '';
  /** Datos visibles del cliente de la orden (el que se usa si no se elige otro). */
  @Input() customerDefaultName = '';
  @Input() customerDefaultIdentification = '';
  @Input() orderItemsSource: any[] = [];
  @Input() remainingOrderTotal = 0;
  @Input() nextPaymentIndex = 1;
  @Input() paymentOptions: any[] = [];
  @Input() submitting = false;

  @Output() close = new EventEmitter<void>();
  @Output() submitSplit = new EventEmitter<SplitOrderPayload>();

  splitLabel = '';
  customer = '';
  /** Cliente elegido para esta subcuenta; null = el mismo de la orden. */
  selectedCustomer: any = null;
  items: SplitItemRowForm[] = [];
  payments: SplitPaymentRowForm[] = [];
  formError = '';
  orderItemOptions: OrderItemSource[] = [];
  private lastAutoPaymentAmount = 0;
  splitLabelTouched = false;
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

  /** Total de la subcuenta, sumado en centavos con la misma regla que el backend y Lite. */
  get splitTotal(): number {
    return fromCents(this.items.reduce((acc, row) => acc + this.lineTotalCents(row), 0));
  }

  /**
   * Total de una línea en centavos: base con la parte proporcional del descuento
   * (la última parte se lleva el saldo) e IVA redondeado por línea.
   */
  private lineTotalCents(row: SplitItemRowForm): number {
    const selected = this.getSelectedItemSource(row);
    if (!selected) return 0;
    const qty = roundQty(this.toPositive(row.qty, 0));
    const discountCents = splitDiscountShareCents(selected.qty, selected.remainingDiscountCents, qty);
    return lineTotalsCents(qty, selected.unitPrice, fromCents(discountCents), selected.taxRate).total;
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
    const available = this.paymentOptions.find((payment: any) =>
      !isPaymentMethodAlreadySelected(this.paymentOptions, this.payments.map((row) => ({ method: row.formas_de_pago })), this.getPaymentValue(payment))
    );
    if (!available) {
      this.formError = 'No hay más métodos de pago disponibles para agregar.';
      return;
    }
    this.payments.push({
      formas_de_pago: this.getPaymentValue(available),
      monto: 0
    });
  }

  removePaymentRow(i: number): void {
    this.payments.splice(i, 1);
  }

  onPaymentMethodChange(index: number): void {
    const row = this.payments[index];
    if (!row) return;
    const rows = this.payments.map((payment) => ({ method: payment.formas_de_pago }));
    if (isPaymentMethodAlreadySelected(this.paymentOptions, rows, row.formas_de_pago, index)) {
      row.formas_de_pago = '';
      this.formError = 'No puedes repetir el mismo método de pago.';
      return;
    }
    this.formError = '';
  }

  isSplitPaymentMethodUsed(value: string, exceptIndex: number): boolean {
    return isPaymentMethodAlreadySelected(
      this.paymentOptions,
      this.payments.map((payment) => ({ method: payment.formas_de_pago })),
      value,
      exceptIndex
    );
  }

  onCustomerChange(customer: any): void {
    this.selectedCustomer = customer || null;
    this.customer = String(customer?.name || '').trim() || this.customerDefault || '';
  }

  /** El SRI no permite facturar a Consumidor Final por más de USD 50. */
  get finalConsumerOverLimit(): boolean {
    const identification = String(
      this.selectedCustomer?.num_identificacion ?? this.selectedCustomer?.identification_number ?? this.customerDefaultIdentification ?? ''
    ).trim();
    return identification === FINAL_CONSUMER_IDENTIFICATION && this.splitTotal > 50;
  }

  onSplitLabelChange(value: string): void {
    this.splitLabel = value;
    this.splitLabelTouched = true;
  }

  applyPayAllRemaining(): void {
    // Toma todo lo pendiente en items y lo paga completo en una sola linea.
    this.itemSelectionMode = 'auto';
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
    return fromCents(this.lineTotalCents(row));
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

  readonly paymentReferenceMaxLength = PAYMENT_REFERENCE_MAX_LENGTH;

  isTransferRow(row: SplitPaymentRowForm): boolean {
    return isTransferPayment(this.paymentOptions, row?.formas_de_pago);
  }

  getPaymentLabel(payment: any): string {
    return getPaymentDisplayLabel(payment);
  }

  getPaymentValue(payment: any): string {
    return getInternalPaymentValue(payment);
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
      const fallbackProduct = String(it?.item || it?.product || it?.productId || '').trim() || undefined;
      const rowId = orderItemRef || `product:${fallbackProduct || idx + 1}`;
      const rawProductName = String(
        it?.item_name || it?.product_name || it?.productName || it?.description || it?.product || 'Producto'
      );
      const itemCode = String(it?.item_code || it?.product_code || it?.codigo || '').trim();
      const productName = itemCode ? `${rawProductName}` : rawProductName;
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
      // `remaining_discount` viene del backend (descuento aún sin asignar); antes de
      // consultar subcuentas, la fila completa conserva todo su descuento.
      const remainingDiscountCents = toCents(it?.remaining_discount ?? it?.discount_amount ?? 0);
      // Valor unitario aproximado (con descuento e IVA): solo orienta el reparto automático.
      const unitTotalExact = qty > 0
        ? ((qty * price - fromCents(remainingDiscountCents)) / qty) * (1 + taxRate / 100)
        : price * (1 + taxRate / 100);

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
        unitTotalExact,
        remainingDiscountCents
      };
    })
    // Tras repartir en fracciones pueden quedar residuos mínimos: no son pendientes reales.
    .filter((it) => roundQty(it.qty) > 0);
  }

  private resetForm(): void {
    this.splitLabel = this.currentPaymentLabel;
    this.customer = this.customerDefault || '';
    this.selectedCustomer = null;
    this.items = [];
    this.payments = [this.buildDefaultPaymentRow()];
    this.formError = '';
    this.splitLabelTouched = false;
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
      const code = String(payment?.codigo || '').trim();
      return code === '01' || label.includes('efectivo') || value.includes('efectivo');
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

    const normalizedPayments = this.payments.map((p) => {
      const selectedPayment = findPaymentMethod(this.paymentOptions, p.formas_de_pago);
      const paymentMethod = getInternalPaymentValue(selectedPayment) || String(p.formas_de_pago || '').trim();
      const amount = this.round2(this.toPositive(p.monto, 0));
      return {
        // El endpoint restaurante usa los nombres nuevos; se mantienen los
        // aliases para que el diálogo pueda validar pagos con el mismo modelo.
        payment_method: paymentMethod,
        payment_code: String(
          selectedPayment?.codigo
          || (selectedPayment as any)?.payment_code
          || (selectedPayment as any)?.forma_pago
          || ''
        ).trim(),
        amount,
        reference: String(p.reference || '').trim().slice(0, PAYMENT_REFERENCE_MAX_LENGTH),
        formas_de_pago: paymentMethod,
        monto: amount
      };
    });

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

    const duplicatedPayment = cleanedPayments.some((payment, index) =>
      cleanedPayments.findIndex((candidate) =>
        (candidate.payment_code && candidate.payment_code === payment.payment_code)
        || (!candidate.payment_code && !payment.payment_code && candidate.payment_method === payment.payment_method)
      ) !== index
    );
    if (duplicatedPayment) {
      this.formError = 'No puedes repetir el mismo método de pago.';
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
    // Todas las operaciones de pagos y subcuentas se expresan en centavos.
    // EPSILON evita que representaciones binarias como 1.005 pierdan un centavo.
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

}
