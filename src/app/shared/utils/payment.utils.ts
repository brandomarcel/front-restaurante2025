export interface PaymentMethodLike {
  name?: string;
  codigo?: string;
  description?: string;
  nombre?: string;
}

export interface InvoicePaymentPayload {
  formas_de_pago: string;
  monto: number;
}

export interface PaymentBuildResult {
  payments: InvoicePaymentPayload[];
  payment?: PaymentMethodLike;
  error?: string;
}

export function roundMoney(value: any): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
}

export function findPaymentMethod(
  paymentMethods: PaymentMethodLike[] | null | undefined,
  selectedValue: string | null | undefined
): PaymentMethodLike | undefined {
  const value = String(selectedValue || '').trim();
  if (!value) return undefined;
  return (paymentMethods || []).find((payment) =>
    String(payment?.name || '').trim() === value ||
    String(payment?.codigo || '').trim() === value
  );
}

export function getPaymentValue(payment: PaymentMethodLike | null | undefined): string {
  return String(payment?.name || payment?.codigo || '').trim();
}

export function getDefaultPaymentValue(paymentMethods: PaymentMethodLike[] | null | undefined): string {
  const methods = paymentMethods || [];
  const cash = methods.find((payment) => String(payment?.codigo || '').trim() === '01');
  return getPaymentValue(cash || methods[0]);
}

export function getPaymentDisplayLabel(payment: PaymentMethodLike | null | undefined): string {
  const code = String(payment?.codigo || '').trim();
  const label = String(payment?.description || payment?.nombre || payment?.name || '').trim();
  if (code && label) return `${label} (${code})`;
  return label || code || 'Método de pago';
}

export function isCashPayment(
  paymentMethods: PaymentMethodLike[] | null | undefined,
  selectedValue: string | null | undefined
): boolean {
  const payment = findPaymentMethod(paymentMethods, selectedValue);
  return String(payment?.codigo || selectedValue || '').trim() === '01';
}

export function buildSinglePaymentPayload(
  paymentMethods: PaymentMethodLike[] | null | undefined,
  selectedValue: string | null | undefined,
  totalValue: any
): PaymentBuildResult {
  const total = roundMoney(totalValue);
  const payment = findPaymentMethod(paymentMethods, selectedValue);
  const paymentId = getPaymentValue(payment);

  if (!paymentId) {
    return { payments: [], error: 'Selecciona un método de pago válido.' };
  }

  if (total <= 0) {
    return { payments: [], payment, error: 'El monto del pago debe ser mayor a 0.' };
  }

  return {
    payment,
    payments: [{ formas_de_pago: paymentId, monto: total }]
  };
}

export function validatePaymentsTotal(
  payments: InvoicePaymentPayload[] | null | undefined,
  expectedTotalValue: any
): string | null {
  const rows = payments || [];
  const expectedTotal = roundMoney(expectedTotalValue);

  if (!rows.length) {
    return 'Debes registrar al menos un pago.';
  }

  const invalidRow = rows.some((payment) =>
    !String(payment?.formas_de_pago || '').trim() || roundMoney(payment?.monto) <= 0
  );
  if (invalidRow) {
    return 'Cada pago debe tener método de pago y monto mayor a 0.';
  }

  const paymentsTotal = roundMoney(rows.reduce((acc, payment) => acc + roundMoney(payment?.monto), 0));
  if (paymentsTotal !== expectedTotal) {
    return `La suma de pagos (${paymentsTotal.toFixed(2)}) debe ser igual al total (${expectedTotal.toFixed(2)}).`;
  }

  return null;
}
