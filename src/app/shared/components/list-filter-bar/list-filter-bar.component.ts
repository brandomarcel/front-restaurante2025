import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePreset, datePresetRange } from 'src/app/shared/utils/date-presets';

/** Pestaña de estado de una lista. `countKey` es la clave en `counts` (por defecto, `value`). */
export interface FilterTab {
  value: string;
  label: string;
  /** Texto en celular cuando `label` es largo. */
  shortLabel?: string;
  /** Clase del punto de color (`bg-success-500`…); sin punto en «Todas». */
  dot?: string;
  /** Explicación al pasar el mouse. */
  hint?: string;
  countKey?: string;
  /** El conteo se muestra en rojo si es mayor que cero (algo para corregir). */
  alert?: boolean;
}

export interface FilterDates {
  from: string;
  to: string;
}

type DateMode = '' | DatePreset | 'custom';

const DATE_OPTIONS: { value: DateMode; label: string }[] = [
  { value: '', label: 'Todas las fechas' },
  { value: 'today', label: 'Hoy' },
  { value: 'month', label: 'Este mes' },
  { value: 'lastMonth', label: 'Mes pasado' },
  { value: 'custom', label: 'Elegir fechas…' },
];

/**
 * Barra de filtros de las listas de documentos (Facturas, Notas de crédito, Guías, Notas de venta, Órdenes):
 * pestañas de estado con conteo, búsqueda, fecha y «Limpiar filtros». Va pegada arriba de la tabla, dentro de la
 * misma tarjeta. No consulta nada: cada pantalla recibe los eventos, recarga y le pasa los conteos.
 * Controles extra de la fila (p. ej. tipo de documento) se proyectan con `<ng-content>`.
 */
@Component({
  selector: 'app-list-filter-bar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './list-filter-bar.component.html',
})
export class ListFilterBarComponent implements OnChanges {
  @Input() tabs: readonly FilterTab[] = [];
  @Input() tabsLabel = 'Filtrar por estado';
  @Input() status = '';
  @Output() statusChange = new EventEmitter<string>();
  /** Conteos por pestaña; `null` cuando el backend no los envía (no se muestran). */
  @Input() counts: Record<string, number> | null = null;

  @Input() search = '';
  @Output() searchChange = new EventEmitter<string>();
  @Input() searchPlaceholder = 'Buscar';
  @Input() searchLabel = 'Buscar';

  /** Filtro de fecha visible (algunas vistas fijan el día y lo ocultan). */
  @Input() showDates = true;
  @Input() dateLabel = 'Fecha';
  @Input() fromDate = '';
  @Input() toDate = '';
  @Output() datesChange = new EventEmitter<FilterDates>();

  @Input() hasActiveFilters = false;
  @Output() clear = new EventEmitter<void>();

  readonly dateOptions = DATE_OPTIONS;
  dateMode: DateMode = '';
  draftFrom = '';
  draftTo = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['fromDate'] && !changes['toDate']) return;
    this.draftFrom = this.fromDate || '';
    this.draftTo = this.toDate || '';
    // «Elegir fechas…» se mantiene aunque el rango coincida con un atajo; si se limpian, vuelve a «Todas».
    if (this.dateMode === 'custom' && (this.draftFrom || this.draftTo)) return;
    this.dateMode = this.presetFor(this.draftFrom, this.draftTo) ?? (this.draftFrom || this.draftTo ? 'custom' : '');
  }

  countFor(tab: FilterTab): number | null {
    const value = this.counts?.[tab.countKey ?? tab.value];
    return typeof value === 'number' ? value : null;
  }

  pillClass(tab: FilterTab, count: number): string {
    if (tab.alert && count > 0) return 'bg-danger-500/10 text-danger-700';
    if (count === 0) return 'bg-muted text-muted-foreground/70';
    return this.status === tab.value ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground';
  }

  selectStatus(value: string): void {
    if (value !== this.status) this.statusChange.emit(value);
  }

  get dateError(): string {
    return this.draftFrom && this.draftTo && this.draftFrom > this.draftTo ? '«Desde» es posterior a «Hasta».' : '';
  }

  onDateModeChange(mode: DateMode): void {
    this.dateMode = mode;
    if (mode === 'custom') {
      // Parte del rango que ya había, o del mes en curso, para que Desde/Hasta no salgan vacíos.
      if (!this.draftFrom && !this.draftTo) this.emitDates(datePresetRange('month'));
      return;
    }
    this.emitDates(mode ? datePresetRange(mode) : { from: '', to: '' });
  }

  onCustomDateChange(): void {
    if (this.dateError) return;
    this.emitDates({ from: this.draftFrom, to: this.draftTo });
  }

  private emitDates(range: FilterDates): void {
    this.draftFrom = range.from;
    this.draftTo = range.to;
    this.datesChange.emit({ ...range });
  }

  private presetFor(from: string, to: string): DatePreset | null {
    if (!from || !to) return null;
    const presets: DatePreset[] = ['today', 'month', 'lastMonth'];
    return presets.find(preset => {
      const range = datePresetRange(preset);
      return range.from === from && range.to === to;
    }) ?? null;
  }
}
