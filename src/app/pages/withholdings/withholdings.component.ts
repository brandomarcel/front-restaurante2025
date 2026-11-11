import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';
import { EcuadorTimePipe } from 'src/app/core/pipes/ecuador-time-pipe.pipe';
import { AppPaginationComponent } from 'src/app/shared/components/pagination/app-pagination.component';
import { ElectronicStatusBadgeComponent } from 'src/app/shared/components/electronic-status-badge/electronic-status-badge.component';
import { ListStateComponent } from 'src/app/shared/components/list-state/list-state.component';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { WithholdingsService } from 'src/app/services/withholdings.service';
import { electronicStatusFromQuery, electronicStatusParam, electronicStatusTabs } from 'src/app/core/constants/electronic-status-tabs';
import { FilterDates, ListFilterBarComponent } from 'src/app/shared/components/list-filter-bar/list-filter-bar.component';
import { readListQuery, writeListQuery } from 'src/app/shared/utils/list-query';
import { debouncedCallback } from 'src/app/shared/utils/debounced-callback';

/** Lista de comprobantes de retención. Mismo esquema que Guías de remisión (filtros en la dirección, sin «Anuladas»). */
@Component({
  selector: 'app-withholdings',
  standalone: true,
  imports: [CommonModule, RouterModule, EcuadorTimePipe, AppPaginationComponent, ElectronicStatusBadgeComponent, ListStateComponent, ListFilterBarComponent],
  templateUrl: './withholdings.component.html'
})
export class WithholdingsComponent implements OnInit {
  withholdings: any[] = [];
  page = 1;
  pageSize = 10;
  total = 0;
  totalPages = 1;
  loading = false;

  _search = '';
  /** Grupo de estado (`autorizadas`, `en-proceso`, `con-error`) o vacío. */
  statusFilter = '';
  fromDate = '';
  toDate = '';
  statusCounts: Record<string, number> | null = null;

  /** Una retención autorizada no se anula desde FacturADA: sin pestaña «Anuladas». */
  readonly statusTabs = electronicStatusTabs('Todas las retenciones', true);
  private readonly searchBackend: () => void;
  private request?: Subscription;

  constructor(
    private svc: WithholdingsService,
    public capabilities: CompanyCapabilitiesService,
    private frappeError: FrappeErrorService,
    destroyRef: DestroyRef,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.searchBackend = debouncedCallback(destroyRef, () => {
      this.page = 1;
      this.load();
    });
    destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  ngOnInit(): void {
    const query = readListQuery(this.route);
    this.statusFilter = electronicStatusFromQuery(query.estado, false);
    this._search = query.q;
    this.fromDate = query.desde;
    this.toDate = query.hasta;
    this.page = query.pagina;
    this.load();
  }

  get search(): string { return this._search; }
  set search(v: string) {
    this._search = v || '';
    this.searchBackend();
  }

  get hasActiveFilters(): boolean {
    return !!this._search.trim() || !!this.statusFilter || !!this.fromDate || !!this.toDate;
  }

  get canCreate(): boolean {
    return this.capabilities.canCreateInModule('withholdings', 'billing.create');
  }

  setStatus(value: string): void {
    this.statusFilter = value;
    this.page = 1;
    this.load();
  }

  onDatesChange(range: FilterDates): void {
    this.fromDate = range.from;
    this.toDate = range.to;
    this.page = 1;
    this.load();
  }

  load(): void {
    this.request?.unsubscribe();
    this.loading = true;
    writeListQuery(this.router, this.route,
      { estado: this.statusFilter, q: this._search, desde: this.fromDate, hasta: this.toDate, pagina: this.page });
    const offset = (this.page - 1) * this.pageSize;
    const dates = this.fromDate || this.toDate ? { from: this.fromDate, to: this.toDate } : undefined;
    this.request = this.svc.getAll(this.pageSize, offset, electronicStatusParam(this.statusFilter), this._search, dates).subscribe({
      next: (res: any) => {
        const msg = res?.message || res;
        this.withholdings = msg?.data || [];
        const counts = msg?.status_counts;
        this.statusCounts = counts && typeof counts === 'object' ? counts : null;
        this.pageSize = Number(msg?.limit ?? this.pageSize) || this.pageSize;
        const responseOffset = Number(msg?.offset);
        if (Number.isFinite(responseOffset) && responseOffset >= 0) {
          this.page = Math.floor(responseOffset / this.pageSize) + 1;
        }
        this.total = Number(msg?.total ?? this.withholdings.length) || 0;
        const hasNext = Boolean(msg?.has_next);
        this.totalPages = Math.max(1, Math.ceil(this.total / this.pageSize) || 1, hasNext ? this.page + 1 : 1);
        this.loading = false;
      },
      error: (err: any) => {
        this.loading = false;
        toast.error(this.frappeError.handle(err) || 'No se pudieron cargar las retenciones.');
      }
    });
  }

  limpiarFiltros(): void {
    this._search = '';
    this.statusFilter = '';
    this.fromDate = '';
    this.toDate = '';
    this.page = 1;
    this.load();
  }

  onPaginationPage(page: number): void {
    if (page === this.page) return;
    this.page = page;
    this.load();
  }

  onPaginationPageSize(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.load();
  }

  trackByName(_: number, row: any): string {
    return String(row?.name ?? '');
  }

  documentNumber(row: any): string {
    return String(row?.electronic?.document_number || row?.document_number || row?.name || '—');
  }

  supplierName(row: any): string {
    return String(row?.supplier?.supplier_name || row?.supplier_name || '—');
  }

  supportNumber(row: any): string {
    return String(row?.support?.num_doc_sustento || row?.num_doc_sustento || '—');
  }

  totalWithheld(row: any): number {
    return Number(row?.total_retenido) || 0;
  }

  isDraft(row: any): boolean {
    return ['BORRADOR', 'DRAFT'].includes(String(row?.status || '').trim().toUpperCase());
  }
}
