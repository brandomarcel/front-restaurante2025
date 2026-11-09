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
  new: 'bg-info-500/15 text-info-700 ',
  prep: 'bg-warning-500/15 text-warning-700 ',
  ready: 'bg-success-500/15 text-success-700 ',
  closed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-danger-500/15 text-danger-700 ',
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

/** Etapa de cocina según sus platos (lo que muestra la pantalla de cocina): Nuevos, Preparando o Listos. */
export type KitchenStage = 'NEW' | 'PREP' | 'READY';

export function kitchenStage(order: OrderVM | null | undefined): KitchenStage {
  const norm = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const statuses = ((order?.items || []) as any[])
    .map((item) => norm(item?.kitchen_status ?? item?.kitchenStatus ?? item?.estado_cocina))
    .filter((status) => !!status && !status.includes('cancel'));
  if (statuses.some((status) => status.includes('prepar'))) return 'PREP';
  if (statuses.length && statuses.every((status) => status.includes('list') || status.includes('entreg'))) return 'READY';
  if (statuses.some((status) => status.includes('pend'))) return 'NEW';
  const stage = orderStage(order?.status);
  if (stage === 'prep') return 'PREP';
  if (stage === 'ready' || stage === 'closed') return 'READY';
  return 'NEW';
}

/** Lo que hace el siguiente toque de cocina sobre todo el pedido; el mismo texto en Caja, Cocina y el detalle. */
export const KITCHEN_NEXT_ACTION: Record<KitchenStage, string> = {
  NEW: 'Empezar a preparar',
  PREP: 'Marcar lista',
  READY: 'Entregado',
};

/** «Para llevar» y «A domicilio» cambian cómo se empaca; servirse en el local no necesita marca. */
export function orderTypeLabel(order: OrderVM | null | undefined): string {
  const value = String(order?.orderType ?? '').toLowerCase();
  if (value.includes('llevar')) return 'Para llevar';
  if (value.includes('domicilio')) return 'A domicilio';
  return '';
}

/** Cómo se reconoce el pedido en Caja: mesa (con su alias), si no el alias o el cliente. */
export function orderHeadline(order: OrderVM | null | undefined): string {
  const table = tableLabel(order);
  const alias = String(order?.alias || '').trim();
  if (table) return alias && alias !== table ? `${table} (${alias})` : table;
  return alias || String(order?.customer?.nombre || '').trim() || 'Consumidor final';
}
