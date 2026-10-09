/**
 * Reglas de venta del POS, sin dependencias de Angular. Se extrajeron tal cual
 * de PosCajaComponent para poder probarlas de forma aislada; cualquier cambio
 * aquí altera cómo se emiten facturas, notas de venta y órdenes.
 */

/** El SRI no permite facturar a Consumidor Final por más de este valor (IVA incluido). */
export const FINAL_CONSUMER_INVOICE_LIMIT = 50;
export const FINAL_CONSUMER_IDENTIFICATION = '9999999999999';
const FINAL_CONSUMER_TYPE = '07 - Consumidor Final';

export type LitePaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
export type LitePaymentCode = '01' | '19' | '20';
export interface LitePayment {
  payment_method: LitePaymentMethod;
  payment_code: LitePaymentCode;
}

export function isFinalConsumer(customer: any): boolean {
  const type = String(customer?.tipo_identificacion || customer?.identification_type || '').trim();
  const number = String(customer?.num_identificacion || customer?.identification_number || '').trim();
  return type === FINAL_CONSUMER_TYPE || /consumidor final/i.test(type) || number === FINAL_CONSUMER_IDENTIFICATION;
}

/** true si la factura a Consumidor Final supera el límite permitido. */
export function exceedsFinalConsumerLimit(customer: any, total: number, documentType: 'Nota Venta' | 'Factura'): boolean {
  return documentType === 'Factura' && isFinalConsumer(customer) && total > FINAL_CONSUMER_INVOICE_LIMIT;
}

/**
 * El catálogo de métodos puede llegar con nombres en español, códigos SRI o
 * aliases del DocType. El contrato de FacturADA Lite espera siempre el par
 * canónico payment_method/payment_code.
 */
export function mapLitePayment(payment: any, fallback = ''): LitePayment | null {
  const raw = payment || {};
  const value = [raw.payment_method, raw.method, raw.nombre, raw.description, raw.name, fallback]
    .filter(Boolean).join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const code = String(raw.payment_code || raw.codigo || raw.forma_pago || '').trim();

  if (/(^|\s)(CASH|EFECTIVO)(\s|$)/.test(value) || code === '01') {
    // OTHER también utiliza el código 01, por eso se comprueba explícitamente
    // antes de aplicar el fallback por código.
    if (/(^|\s)(OTHER|OTRO|OTROS)(\s|$)/.test(value)) return { payment_method: 'OTHER', payment_code: '01' };
    return { payment_method: 'CASH', payment_code: '01' };
  }
  if (/(CARD|TARJETA|CREDITO|CREDIT|DEBITO|DEBIT)/.test(value) || code === '19') {
    return { payment_method: 'CARD', payment_code: '19' };
  }
  if (/(TRANSFER|TRANSFERENCIA|DEPOSITO|DEPOSIT)/.test(value) || code === '20') {
    return { payment_method: 'TRANSFER', payment_code: '20' };
  }
  if (/(OTHER|OTRO|OTROS)/.test(value)) return { payment_method: 'OTHER', payment_code: '01' };
  return null;
}

/** Líneas del carrito con el formato de create_order_v2 (POS restaurante). */
export function orderItemsFromCart(cart: any[]): any[] {
  return cart.map((item) => ({
    product: item.name ?? item.nombre,
    qty: item.quantity,
    rate: item.price,
    discount_percentage: Number(item.discount_percentage || 0),
    discount_amount: Number(item.discount_amount || 0),
    tax_rate: item.tax_value
  }));
}

/** Líneas del carrito con el formato del contrato Lite (factura y nota de venta). */
export function liteItemsFromCart(cart: any[]): any[] {
  return cart.map((item) => ({
    item: item.name ?? item.nombre,
    item_code: item.codigo ?? item.item_code ?? item.name ?? item.nombre,
    qty: Number(item.quantity || 0),
    rate: Number(item.price || 0),
    discount_percentage: Number(item.discount_percentage || 0),
    discount_amount: Number(item.discount_amount || 0),
    tax_rate: Number(item.tax_value || 0)
  }));
}

/** Ambiente del perfil tributario en el formato que espera el backend ('Produccion' | 'Pruebas' | ''). */
export function normalizeBackendEnvironment(value: unknown): string {
  const normalized = String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
  if (normalized.includes('PROD')) return 'Produccion';
  if (normalized.includes('PRUEB') || normalized === 'TEST') return 'Pruebas';
  return '';
}

/** Nombre de la apertura de caja vigente, en cualquiera de las formas en que responde el backend. */
export function extractCashOpeningName(response: any): string {
  const message = response?.message ?? response ?? {};
  const data = message?.data ?? response?.data ?? message;
  const opening = data?.cash_opening ?? data?.apertura ?? data?.opening ?? (data?.name ? data : null);
  return typeof opening === 'string' ? opening.trim() : String(opening?.name || '').trim();
}

/** Factura generada dentro de create_order_v2, si la hubo. */
export function extractOrderInvoice(response: any): string | null {
  const raw = response?.message?.data?.invoice
    ?? response?.message?.invoice
    ?? response?.data?.invoice
    ?? response?.message?.data?.lite_invoice
    ?? response?.message?.lite_invoice
    ?? response?.data?.lite_invoice
    ?? null;
  const name = typeof raw === 'string' ? raw : (raw?.name ?? raw?.invoice_name ?? raw?.id ?? '');
  return String(name || '').trim() || null;
}

export function extractOrderId(response: any): string {
  return String(response?.message?.data?.name ?? response?.message?.name ?? response?.data?.name ?? '').trim();
}

/** Partes relevantes de la respuesta de create_and_emit_from_ui_v2. */
export function readLiteInvoiceResponse(response: any): { body: any; data: any; emission: any; invoiceName: string } {
  const body = response?.message ?? response ?? {};
  const data = body?.data ?? response?.data ?? {};
  const emission = body?.emission ?? data?.emission ?? response?.emission ?? data;
  const invoiceName = String(
    response?.invoiceName
      || body?.invoiceName
      || data?.name
      || data?.invoice_name
      || data?.invoice?.name
      || (typeof data?.invoice === 'string' ? data.invoice : '')
      || data?.lite_invoice?.name
      || (typeof data?.lite_invoice === 'string' ? data.lite_invoice : '')
      || emission?.invoice_name
      || body?.invoice_name
      || ''
  ).trim();
  return { body, data, emission, invoiceName };
}

/** Mensaje legible de un error de Frappe (`_server_messages` o `message`). */
export function extractApiError(err: any): string | null {
  if (err?.error?._server_messages) {
    try {
      const messages = JSON.parse(err.error._server_messages);
      const message = JSON.parse(messages[0]);
      return stripHtml(message.message);
    } catch {
      return null;
    }
  }
  if (err?.error?.message) return err.error.message;
  return null;
}

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}
