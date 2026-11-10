/** Rangos de fecha `YYYY-MM-DD` en la hora local del equipo (filtros de listas y enlaces del dashboard). */
export type DatePreset = 'today' | 'month' | 'lastMonth';

export interface IsoDateRange {
  from: string;
  to: string;
}

export function isoLocalDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** «Hoy», «Este mes» (del 1 a hoy) o «Mes pasado» (completo). */
export function datePresetRange(preset: DatePreset, now = new Date()): IsoDateRange {
  if (preset === 'today') return { from: isoLocalDate(now), to: isoLocalDate(now) };
  if (preset === 'month') return { from: isoLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoLocalDate(now) };
  return {
    from: isoLocalDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    to: isoLocalDate(new Date(now.getFullYear(), now.getMonth(), 0)),
  };
}
