/**
 * Utilidades compartidas por Apertura, Retiros, Cierre y Gestión de caja.
 * Antes estaban copiadas en cada pantalla; el comportamiento es el mismo.
 */

export const CLOSED_CASH_STATUSES = ['CERRADA', 'CLOSED', 'CANCELADA', 'CANCELLED'];

/** Mayúsculas y sin tildes, para comparar estados que llegan en español o inglés. */
export function normalizeCashStatus(value: unknown): string {
  return String(value || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
}

export function isClosedCashStatus(value: unknown): boolean {
  return CLOSED_CASH_STATUSES.includes(normalizeCashStatus(value));
}

export function cashNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function cashNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Id de una apertura, venga como texto o como registro. */
export function cashOpeningName(opening: any): string {
  if (typeof opening === 'string') return opening.trim();
  return String(opening?.name || opening?.cash_opening || opening?.apertura || '').trim();
}

/** Mensaje legible de un error de Frappe (message, msg o _server_messages). */
export function readCashBackendMessage(error: any): string {
  const payload = error?.error ?? error;
  const direct = payload?.message ?? payload?.msg ?? payload?._server_messages;
  if (Array.isArray(direct)) return direct.map((item: any) => String(item?.message || item)).join(' ');
  if (direct && typeof direct === 'object') return String(direct.message || direct.error || direct.msg || '');
  if (typeof direct === 'string') {
    try {
      const parsed = JSON.parse(direct);
      if (Array.isArray(parsed)) return parsed.map((item: any) => String(item?.message || item)).join(' ');
    } catch { /* mensaje plano */ }
    return direct;
  }
  return error?.message || '';
}

export function isForbidden(error: any): boolean {
  return Number(error?.status ?? error?.error?.status ?? 0) === 403;
}

/** Usuario de la sesión guardado al iniciar sesión. */
export function currentSessionEmail(): string {
  try {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return String(user?.email || '').trim();
  } catch {
    return '';
  }
}

/** Billetes y monedas de dólar para el conteo guiado del cierre. */
export const CASH_DENOMINATIONS: ReadonlyArray<{ value: number; label: string; kind: 'bill' | 'coin' }> = [
  { value: 100, label: '$100', kind: 'bill' },
  { value: 50, label: '$50', kind: 'bill' },
  { value: 20, label: '$20', kind: 'bill' },
  { value: 10, label: '$10', kind: 'bill' },
  { value: 5, label: '$5', kind: 'bill' },
  { value: 1, label: '$1', kind: 'bill' },
  { value: 1, label: '$1', kind: 'coin' },
  { value: 0.5, label: '50¢', kind: 'coin' },
  { value: 0.25, label: '25¢', kind: 'coin' },
  { value: 0.1, label: '10¢', kind: 'coin' },
  { value: 0.05, label: '5¢', kind: 'coin' },
  { value: 0.01, label: '1¢', kind: 'coin' }
];

/** Suma del conteo por denominación, redondeada a centavos. */
export function sumDenominations(quantities: ReadonlyArray<number>): number {
  const cents = CASH_DENOMINATIONS.reduce((total, denomination, index) => {
    const quantity = Math.max(0, Math.floor(cashNumber(quantities[index])));
    return total + Math.round(denomination.value * 100) * quantity;
  }, 0);
  return cents / 100;
}

/** Faltante, sobrante o cuadrado, con tolerancia de medio centavo. */
export function cashDifferenceKind(difference: number): 'short' | 'over' | 'even' {
  if (Math.abs(difference) < 0.005) return 'even';
  return difference < 0 ? 'short' : 'over';
}
