import { formatDisplayDate, toNumber } from './dashboard-values';

export interface InvoiceRow {
  name: string;
  date: string;
  customer: string;
  status: string;
  total: number;
}

/** Filas de `recent_invoices` del dashboard Lite (últimos comprobantes del negocio). */
export function toInvoiceRows(invoices: unknown[] | undefined | null): InvoiceRow[] {
  return (invoices ?? []).map((raw: any) => ({
    name: String(raw?.document_number || raw?.name || '—'),
    date: formatDisplayDate(raw?.posting_date || raw?.date || raw?.issue_date),
    customer: String(raw?.customer_name || raw?.customer || 'Consumidor final'),
    status: String(raw?.status || raw?.einvoice_status || '—'),
    total: toNumber(raw?.grand_total ?? raw?.total)
  }));
}
