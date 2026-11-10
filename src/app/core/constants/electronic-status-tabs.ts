import { FilterTab } from 'src/app/shared/components/list-filter-bar/list-filter-bar.component';

/**
 * Estados de las listas de comprobantes electrónicos agrupados como los entiende el negocio. `backend` es el valor
 * de `status` que aceptan `get_all_invoices`, `get_all_credit_notes` y `get_all_remission_guides` (también es la
 * clave de `status_counts`). «En proceso» = Pendiente Emision, Emitida, En Revision; «Con error» = Rechazada,
 * Error de Envio.
 */
export const ELECTRONIC_STATUS_GROUPS = [
  { value: 'autorizadas', label: 'Autorizadas', backend: 'Autorizada', dot: 'bg-success-500',
    hint: 'Autorizadas por el SRI y vigentes' },
  { value: 'en-proceso', label: 'En proceso', backend: 'EN_PROCESO', dot: 'bg-info-500',
    hint: 'Pendientes de emisión, esperando autorización o en revisión' },
  { value: 'con-error', label: 'Rechazadas o con error', shortLabel: 'Con error', backend: 'CON_ERROR', dot: 'bg-danger-500',
    hint: 'Rechazadas por el SRI o con error de envío: hay que corregirlas o reintentarlas' },
  { value: 'anuladas', label: 'Anuladas', backend: 'Anulada', dot: 'bg-muted-foreground/50',
    hint: 'Anuladas con nota de crédito o en el SRI' },
] as const;

export type ElectronicStatusGroup = (typeof ELECTRONIC_STATUS_GROUPS)[number]['value'];

/** Enlaces antiguos (`?estado=Rechazada`) llevan al grupo que contiene ese estado. */
const LEGACY_STATUS: Record<string, ElectronicStatusGroup> = {
  Autorizada: 'autorizadas',
  'Pendiente Emision': 'en-proceso', Emitida: 'en-proceso', 'En Revision': 'en-proceso',
  Rechazada: 'con-error', 'Error de Envio': 'con-error',
  Anulada: 'anuladas',
};

/** Pestañas «Todas» + grupos. `withCancelled = false` para documentos que no se anulan (guías). */
export function electronicStatusTabs(allHint: string, withCancelled = true): FilterTab[] {
  const groups = ELECTRONIC_STATUS_GROUPS.filter(group => withCancelled || group.value !== 'anuladas');
  return [
    { value: '', label: 'Todas', countKey: 'ALL', hint: allHint },
    ...groups.map(group => ({ ...group, countKey: group.backend, alert: group.value === 'con-error' })),
  ];
}

/** Grupo válido desde la dirección (acepta estados exactos antiguos); vacío si no se reconoce. */
export function electronicStatusFromQuery(value: string, withCancelled = true): string {
  const group = ELECTRONIC_STATUS_GROUPS.some(option => option.value === value) ? value : (LEGACY_STATUS[value] ?? '');
  return !withCancelled && group === 'anuladas' ? '' : group;
}

/** Valor de `status` para el backend: grupo elegido o, por compatibilidad, un estado exacto. */
export function electronicStatusParam(value: string): string | undefined {
  if (!value) return undefined;
  return ELECTRONIC_STATUS_GROUPS.find(option => option.value === value)?.backend ?? value;
}
