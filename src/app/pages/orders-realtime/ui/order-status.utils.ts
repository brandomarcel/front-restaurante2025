import { OrderVM } from 'src/app/services/realtime-orders.service';

/** Etapa operativa de una orden de restaurante, independiente de cómo venga escrito el estado. */
export type OrderStage = 'new' | 'prep' | 'ready' | 'closed' | 'cancelled';

export function orderStage(status?: string): OrderStage {
  const value = String(status ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (value.includes('cancel')) return 'cancelled';
  if (value.includes('prepar')) return 'prep';
  if (value.includes('list')) return 'ready';
  if (value.includes('cerr') || value.includes('entreg')) return 'closed';
  return 'new';
}

export const ORDER_STAGE_LABEL: Record<OrderStage, string> = {
  new: 'Nueva',
  prep: 'En cocina',
  ready: 'Lista',
  closed: 'Cerrada',
  cancelled: 'Cancelada',
};

/** Clases de la etiqueta de estado; usan opacidad para verse bien en tema claro y oscuro. */
export const ORDER_STAGE_BADGE: Record<OrderStage, string> = {
  new: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  prep: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  ready: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  closed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

/** Minutos desde la creación de la orden (0 si la fecha no es válida). */
export function orderAgeMinutes(order: Pick<OrderVM, 'createdAt' | 'createdAtISO'> | null | undefined, now = Date.now()): number {
  const raw = order?.createdAtISO || order?.createdAt;
  const time = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(time) ? Math.max(0, Math.floor((now - time) / 60_000)) : 0;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 1) return 'Recién';
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ''}`;
}

/** Color del tiempo de espera: a tiempo (<10), en cola (10–19), demorada (20+). */
export function waitTone(minutes: number): 'ok' | 'warn' | 'late' {
  if (minutes >= 20) return 'late';
  if (minutes >= 10) return 'warn';
  return 'ok';
}

export function tableLabel(order: OrderVM | null | undefined): string {
  const row: any = order || {};
  return String(row.tableName || row.table_label || row.mesa_name || row.table || row.mesa || '').trim();
}

/** Una orden ya facturada no se vuelve a cobrar: se abre para consultarla. */
export function isInvoiced(order: OrderVM | null | undefined): boolean {
  // El enlace a la factura llega en cada evento; el estado SRI no siempre.
  if (order?.sri?.invoice) return true;
  const status = String(order?.sri?.status ?? '').toLowerCase();
  return !!status && !status.includes('sin factura');
}
