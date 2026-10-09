import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

/**
 * Estados de carga y vacío de un listado paginado. Se muestra solo cuando no hay
 * filas visibles; con filas, la página dibuja su tabla.
 */
@Component({
  selector: 'app-list-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="loading && empty" class="divide-y divide-border" aria-hidden="true">
      <div *ngFor="let _ of skeletonRows" class="flex animate-pulse items-center gap-3 px-3 py-3">
        <div class="h-3 w-28 rounded bg-muted"></div>
        <div class="h-3 flex-1 rounded bg-muted"></div>
        <div class="h-3 w-16 rounded bg-muted"></div>
        <div class="h-5 w-24 rounded-full bg-muted"></div>
      </div>
    </div>

    <div *ngIf="!loading && empty" class="px-4 py-10 text-center">
      <p class="text-sm font-semibold text-foreground">{{ hasFilters ? filteredMessage : emptyMessage }}</p>
      <ng-container *ngIf="hasFilters">
        <p class="mt-1 text-xs text-muted-foreground">Prueba con otro término o estado.</p>
        <button type="button" class="btn btn-outline mt-3 !text-xs" (click)="clear.emit()">Limpiar filtros</button>
      </ng-container>
      <ng-content></ng-content>
    </div>
  `
})
export class ListStateComponent {
  @Input() loading = false;
  @Input() empty = false;
  @Input() hasFilters = false;
  @Input() emptyMessage = 'Todavía no hay registros.';
  @Input() filteredMessage = 'Ningún registro coincide con los filtros.';
  @Output() clear = new EventEmitter<void>();

  readonly skeletonRows = Array.from({ length: 5 });
}
