import { ActivatedRoute, Params, Router } from '@angular/router';

/** Filtros de una lista guardados en la dirección: `?estado=&q=&desde=&hasta=&pagina=`. */
export interface ListQueryState {
  estado: string;
  q: string;
  desde: string;
  hasta: string;
  pagina: number;
  /** Filtros propios de una pantalla (p. ej. `tipo` en Órdenes); vacío = se quita de la dirección. */
  extra?: Record<string, string>;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Lee y valida los filtros (fechas `YYYY-MM-DD`, página ≥ 1, búsqueda ≤ 100 caracteres). */
export function readListQuery(route: ActivatedRoute): ListQueryState {
  const query = route.snapshot.queryParamMap;
  const desde = query.get('desde') || '';
  const hasta = query.get('hasta') || '';
  const pagina = Number(query.get('pagina'));
  return {
    estado: query.get('estado') || '',
    q: (query.get('q') || '').slice(0, 100),
    desde: ISO_DATE.test(desde) ? desde : '',
    hasta: ISO_DATE.test(hasta) ? hasta : '',
    pagina: Number.isInteger(pagina) && pagina > 1 ? pagina : 1,
  };
}

/** Un filtro propio de la pantalla, solo si está entre los valores permitidos. */
export function readListQueryExtra(route: ActivatedRoute, key: string, allowed: readonly string[]): string {
  const value = route.snapshot.queryParamMap.get(key) || '';
  return allowed.includes(value) ? value : '';
}

/** Escribe los filtros sin agregar entradas al historial (al volver del detalle la lista sigue igual). */
export function writeListQuery(router: Router, route: ActivatedRoute, state: ListQueryState): void {
  const queryParams: Params = {
    estado: state.estado || null,
    q: state.q.trim() || null,
    desde: state.desde || null,
    hasta: state.hasta || null,
    pagina: state.pagina > 1 ? state.pagina : null,
  };
  for (const [key, value] of Object.entries(state.extra ?? {})) queryParams[key] = value || null;
  const current = route.snapshot.queryParamMap;
  const same = Object.entries(queryParams)
    .every(([key, value]) => (current.get(key) ?? null) === (value === null ? null : String(value)));
  if (same) return;
  router.navigate([], { relativeTo: route, queryParams, queryParamsHandling: 'merge', replaceUrl: true });
}
