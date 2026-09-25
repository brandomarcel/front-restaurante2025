export interface PaymentMethodLike {
  name?: string;
  codigo?: string;
  payment_code?: string;
  payment_method?: string;
  forma_pago?: string;
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

/** Fila editable utilizada por Facturación y los POS. */
export interface PaymentRow {
  method: string;
  amount: number;
  reference?: string;
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
    String(payment?.codigo || '').trim() === value ||
    String(payment?.payment_code || '').trim() === value ||
    String(payment?.payment_method || '').trim() === value ||
    String(payment?.forma_pago || '').trim() === value
  );
}

export function getPaymentValue(payment: PaymentMethodLike | null | undefined): string {
  return String(payment?.name || payment?.payment_method || payment?.codigo || payment?.payment_code || payment?.forma_pago || '').trim();
}

export function getDefaultPaymentValue(paymentMethods: PaymentMethodLike[] | null | undefined): string {
  const methods = paymentMethods || [];
  const cash = methods.find((payment) =>
    String(payment?.codigo || payment?.payment_code || '').trim() === '01'
    || /^(cash|efectivo)$/i.test(String(payment?.name || payment?.payment_method || payment?.description || payment?.nombre || '').trim())
  );
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
  const code = String(payment?.codigo || payment?.payment_code || '').trim();
  const label = String(
    payment?.name
      || payment?.payment_method
      || payment?.description
      || payment?.nombre
      || selectedValue
      || ''
  ).trim();
  return code === '01' || /^(cash|efectivo)$/i.test(label);
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

/**
 * Identificador estable para evitar que la misma forma de pago aparezca dos
 * veces. Se prioriza el código SRI porque puede variar la descripción.
 */
export function paymentMethodKey(
  paymentMethods: PaymentMethodLike[] | null | undefined,
  value: string | null | undefined
): string {
  const selected = findPaymentMethod(paymentMethods, value);
  const code = String(selected?.codigo || selected?.payment_code || selected?.forma_pago || '').trim();
  const method = String(
    selected?.name || selected?.payment_method || selected?.description || selected?.nombre || value || ''
  ).trim().toLocaleLowerCase();
  return code ? `code:${code}` : (method ? `method:${method}` : '');
}

export function isPaymentMethodAlreadySelected(
  paymentMethods: PaymentMethodLike[] | null | undefined,
  rows: Array<Pick<PaymentRow, 'method'>> | null | undefined,
  value: string | null | undefined,
  exceptIndex = -1
): boolean {
  const key = paymentMethodKey(paymentMethods, value);
  if (!key) return false;
  return (rows || []).some((row, index) => index !== exceptIndex
    && paymentMethodKey(paymentMethods, row?.method) === key);
}

/** Convierte y valida pagos combinados; el total debe cuadrar exactamente. */
export function buildMultiplePaymentPayload(
  paymentMethods: PaymentMethodLike[] | null | undefined,
  rows: PaymentRow[] | null | undefined,
  totalValue: any
): PaymentBuildResult {
  const sourceRows = rows || [];
  if (!sourceRows.length) return { payments: [], error: 'Debes registrar al menos un método de pago.' };

  const normalized: InvoicePaymentPayload[] = [];
  const seen = new Set<string>();
  for (const row of sourceRows) {
    const payment = findPaymentMethod(paymentMethods, row?.method);
    const paymentId = getPaymentValue(payment);
    const amount = roundMoney(row?.amount);
    if (!paymentId || amount <= 0) {
      return { payments: [], error: 'Cada pago debe tener un método válido y un monto mayor a 0.' };
    }
    const key = paymentMethodKey(paymentMethods, row?.method);
    if (!key || seen.has(key)) {
      return { payments: [], error: 'No puedes repetir el mismo método de pago.' };
    }
    seen.add(key);
    normalized.push({ formas_de_pago: paymentId, monto: amount });
  }

  const error = validatePaymentsTotal(normalized, totalValue);
  return error ? { payments: [], error } : { payments: normalized };
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

  const methods = new Set<string>();
  for (const payment of rows) {
    const method = String(payment?.formas_de_pago || '').trim().toLocaleLowerCase();
    if (methods.has(method)) return 'No puedes repetir el mismo método de pago.';
    methods.add(method);
  }

  const paymentsTotal = roundMoney(rows.reduce((acc, payment) => acc + roundMoney(payment?.monto), 0));
  if (paymentsTotal !== expectedTotal) {
    return `La suma de pagos (${paymentsTotal.toFixed(2)}) debe ser igual al total (${expectedTotal.toFixed(2)}).`;
  }

  return null;
}
