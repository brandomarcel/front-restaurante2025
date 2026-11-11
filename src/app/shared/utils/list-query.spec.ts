import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { readListQuery, readListQueryExtra, writeListQuery } from './list-query';
import { datePresetRange, isoLocalDate } from './date-presets';
import {
  electronicStatusFromQuery,
  electronicStatusParam,
  electronicStatusTabs,
} from 'src/app/core/constants/electronic-status-tabs';

describe('List query and date presets', () => {
  const route = (params: Record<string, string> = {}) =>
    ({ snapshot: { queryParamMap: convertToParamMap(params) } } as ActivatedRoute);

  it('defaults malformed dates/pages and limits search length', () => {
    expect(readListQuery(route({ desde: '10/11/2026', hasta: 'bad', pagina: '-4', q: 'a'.repeat(120) }))).toEqual({
      estado: '',
      desde: '',
      hasta: '',
      pagina: 1,
      q: 'a'.repeat(100),
    });
    expect(readListQuery(route({ pagina: '2.5' })).pagina).toBe(1);
  });

  it('preserves a valid range and page and validates screen-specific filters', () => {
    const current = route({ desde: '2026-10-01', hasta: '2026-10-31', pagina: '3', tipo: 'Factura' });
    expect(readListQuery(current)).toEqual({ estado: '', q: '', desde: '2026-10-01', hasta: '2026-10-31', pagina: 3 });
    expect(readListQueryExtra(current, 'tipo', ['Factura'])).toBe('Factura');
    expect(readListQueryExtra(current, 'tipo', ['Nota Venta'])).toBe('');
  });

  it('merges filters with replaceUrl and removes empty values', () => {
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const current = route({ pagina: '5', tipo: 'Factura' });
    writeListQuery(router, current, {
      estado: 'con-error',
      q: ' Ana ',
      desde: '',
      hasta: '',
      pagina: 1,
      extra: { tipo: '' },
    });
    expect(router.navigate).toHaveBeenCalledOnceWith([], {
      relativeTo: current,
      queryParams: { estado: 'con-error', q: 'Ana', desde: null, hasta: null, pagina: null, tipo: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('does not navigate when canonical filters match the address', () => {
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    writeListQuery(router, route({ estado: 'anuladas', pagina: '2' }), {
      estado: 'anuladas',
      q: '',
      desde: '',
      hasta: '',
      pagina: 2,
    });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('calculates local day, month-to-date and previous month across year/leap boundaries', () => {
    const day = new Date(2026, 0, 3, 23, 30);
    expect(isoLocalDate(day)).toBe('2026-01-03');
    expect(datePresetRange('today', day)).toEqual({ from: '2026-01-03', to: '2026-01-03' });
    expect(datePresetRange('month', day)).toEqual({ from: '2026-01-01', to: '2026-01-03' });
    expect(datePresetRange('lastMonth', day)).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(datePresetRange('lastMonth', new Date(2024, 2, 1))).toEqual({ from: '2024-02-01', to: '2024-02-29' });
  });

  it('maps old links to the current groups and excludes annulled guides', () => {
    for (const status of ['Emitida', 'Pendiente Emision', 'En Revision'])
      expect(electronicStatusFromQuery(status)).toBe('en-proceso');
    expect(electronicStatusFromQuery('Rechazada')).toBe('con-error');
    expect(electronicStatusFromQuery('Anulada', false)).toBe('');
    expect(electronicStatusFromQuery('unknown')).toBe('');
    expect(electronicStatusParam('con-error')).toBe('CON_ERROR');
    expect(electronicStatusParam('')).toBeUndefined();
    expect(electronicStatusTabs('Todas', false).map((tab) => tab.value)).toEqual([
      '',
      'autorizadas',
      'en-proceso',
      'con-error',
    ]);
  });
});
