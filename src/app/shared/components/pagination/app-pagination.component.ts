import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Control de paginación compartido por los listados del portal. */
@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <nav *ngIf="totalPages > 0" class="mt-4 flex flex-col gap-3 border-t border-slate-200 pt-3 text-xs text-slate-600 sm:flex-row sm:items-center sm:justify-between" aria-label="Paginación">
      <span *ngIf="totalItems > 0">Mostrando {{ fromItem }}–{{ toItem }} de {{ totalItems }}</span>
      <span *ngIf="totalItems === 0">Sin registros</span>
      <div class="flex flex-wrap items-center gap-2">
        <label class="flex items-center gap-1 whitespace-nowrap">
          Filas
          <select class="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs" [ngModel]="pageSize" (ngModelChange)="changePageSize($event)" aria-label="Filas por página">
            <option *ngFor="let size of pageSizes" [ngValue]="size">{{ size }}</option>
          </select>
        </label>
        <button type="button" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" (click)="changePage(page - 1)" [disabled]="page <= 1">Anterior</button>
        <span class="min-w-[92px] text-center font-medium text-slate-700">Página {{ page }} de {{ totalPages }}</span>
        <button type="button" class="rounded-md border border-slate-300 bg-white px-3 py-1.5 font-medium transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40" (click)="changePage(page + 1)" [disabled]="page >= totalPages">Siguiente</button>
      </div>
    </nav>
  `
})
export class AppPaginationComponent {
  @Input() page = 1;
  @Input() totalPages = 1;
  @Input() totalItems = 0;
  @Input() pageSize = 10;
  @Input() pageSizes: number[] = [10, 25, 50];
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();

  get fromItem(): number {
    return this.totalItems ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get toItem(): number {
    return Math.min(this.page * this.pageSize, this.totalItems);
  }

  changePage(page: number): void {
    const next = Math.max(1, Math.min(Number(page) || 1, Math.max(1, this.totalPages)));
    if (next !== this.page) this.pageChange.emit(next);
  }

  changePageSize(size: number): void {
    const next = Number(size);
    if (!Number.isFinite(next) || next <= 0 || next === this.pageSize) return;
    this.pageSizeChange.emit(next);
  }
}
