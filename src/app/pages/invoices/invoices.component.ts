import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';
import { InvoiceDateRange, InvoicesService } from 'src/app/services/invoices.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { AppPaginationComponent } from 'src/app/shared/components/pagination/app-pagination.component';
import { ElectronicStatusBadgeComponent } from 'src/app/shared/components/electronic-status-badge/electronic-status-badge.component';
import { ListStateComponent } from 'src/app/shared/components/list-state/list-state.component';
import { isCancelledInvoice } from 'src/app/core/utils/electronic-document';
import { debouncedCallback } from 'src/app/shared/utils/debounced-callback';
import { FilterDates, ListFilterBarComponent } from 'src/app/shared/components/list-filter-bar/list-filter-bar.component';
import { readListQuery, writeListQuery } from 'src/app/shared/utils/list-query';
import { ELECTRONIC_STATUS_GROUPS, electronicStatusFromQuery, electronicStatusParam, electronicStatusTabs } from 'src/app/core/constants/electronic-status-tabs';

/** Compatibilidad: los grupos viven en `core/constants/electronic-status-tabs.ts`. */
export const INVOICE_STATUS_FILTERS = ELECTRONIC_STATUS_GROUPS;
const STATUS_TABS = electronicStatusTabs('Todas las facturas');

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AppPaginationComponent, ElectronicStatusBadgeComponent, ListStateComponent, ListFilterBarComponent],
  templateUrl: './invoices.component.html',
  styleUrls: ['./invoices.component.css']
})
export class InvoicesComponent implements OnInit {
  readonly isCancelled = isCancelledInvoice;
  invoices: any[] = [];
  invoicesFiltradas: any[] = [];
  page = 1;
  pageSize = 10;
  total = 0;
  totalPages = 1;
  loading = false;

  _search = '';
  statusFiltro = '';
  /** Fecha de emisión `YYYY-MM-DD` (vacío = sin límite). */
  fromDate = '';
  toDate = '';
  readonly statusOptions = INVOICE_STATUS_FILTERS;
  readonly statusTabs = STATUS_TABS;
  /** Cuántas hay en cada pestaña con la búsqueda y las fechas actuales (`status_counts`); null si el backend no lo envía. */
  statusCounts: Record<string, number> | null = null;

  private readonly searchBackend: () => void;
  private request?: Subscription;

  constructor(
    private svc: InvoicesService,
    public capabilities: CompanyCapabilitiesService,
    destroyRef: DestroyRef,
    private route: ActivatedRoute,
    private router: Router
  ) {
    this.searchBackend = debouncedCallback(destroyRef, () => {
      this.page = 1;
      this.loadInvoices();
    });
    destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  ngOnInit(): void {
    // Los filtros viven en la dirección (`?estado=&q=&desde=&hasta=&pagina=`): al volver del detalle la lista sigue
    // igual, y el dashboard enlaza ya filtrado. Solo se aceptan estados y fechas válidos.
    const query = readListQuery(this.route);
    this.statusFiltro = electronicStatusFromQuery(query.estado);
    this._search = query.q;
    this.fromDate = query.desde;
    this.toDate = query.hasta;
    this.page = query.pagina;
    this.loadInvoices();
  }

  loadInvoices(): void {
    // Cancela la petición anterior para que una respuesta lenta no pise un filtro más reciente.
    this.request?.unsubscribe();
    this.loading = true;
    this.syncUrl();
    const offset = (this.page - 1) * this.pageSize;
    const dates = this.dateRange;
    const args: Parameters<InvoicesService['getAllInvoices']> = [this.pageSize, offset, this.statusParam, this._search];
    if (dates) args.push(dates);
    this.request = this.svc.getAllInvoices(...args).subscribe({
      next: (res: any) => {
        const msg = res.message || res;
        this.invoices = msg.data || [];
        const counts = msg.status_counts ?? res?.status_counts;
        this.statusCounts = counts && typeof counts === 'object' ? counts : null;
        this.pageSize = Number(res?.limit ?? msg?.limit ?? this.pageSize) || this.pageSize;
        const responseOffset = Number(res?.offset ?? msg?.offset);
        if (Number.isFinite(responseOffset) && responseOffset >= 0) {
          this.page = Math.floor(responseOffset / this.pageSize) + 1;
        }
        this.total = Number(msg.total ?? msg.total_count ?? msg.count ?? this.invoices.length) || 0;
        const hasNext = Boolean(res?.hasNext ?? msg?.has_next ?? msg?.hasNext);
        this.totalPages = Math.max(1, Math.ceil(this.total / this.pageSize) || 1, hasNext ? this.page + 1 : 1);
        this.aplicarFiltros();
        this.loading = false;
      },
      error: (err: any) => {
        this.loading = false;
        toast.error(String(err?.error?.message || err?.message || 'No se pudieron cargar las facturas.'));
      }
    });
  }

  get search(): string { return this._search; }
  set search(v: string) {
    this._search = v || '';
    // Filtra al instante la página visible y consulta al backend al terminar de escribir.
    this.aplicarFiltros();
    this.searchBackend();
  }

  get hasActiveFilters(): boolean {
    return !!this._search.trim() || !!this.statusFiltro || !!this.fromDate || !!this.toDate;
  }

  /** Rango para el backend; `undefined` sin fechas. */
  get dateRange(): InvoiceDateRange | undefined {
    if (!this.fromDate && !this.toDate) return undefined;
    return { ...(this.fromDate ? { from: this.fromDate } : {}), ...(this.toDate ? { to: this.toDate } : {}) };
  }

  /** Desde la barra de filtros (atajo, «Elegir fechas…» o «Todas las fechas»); ya validado. */
  onDatesChange(range: FilterDates): void {
    this.fromDate = range.from;
    this.toDate = range.to;
    this.page = 1;
    this.loadInvoices();
  }

  /** Valor para el backend: grupo elegido o, por compatibilidad, un estado exacto. */
  get statusParam(): string | undefined {
    return electronicStatusParam(this.statusFiltro);
  }

  setStatus(value: string): void {
    if (value === this.statusFiltro) return;
    this.statusFiltro = value;
    this.onStatusChange();
  }

  onStatusChange(): void {
    this.page = 1;
    this.loadInvoices();
  }

  aplicarFiltros(): void {
    const term = (this._search || '').trim().toLowerCase();
    const lista = Array.isArray(this.invoices) ? this.invoices : [];
    this.invoicesFiltradas = !term ? [...lista] : lista.filter(inv => [
      inv?.name,
      inv?.sri?.number,
      inv?.document_number,
      inv?.access_key,
      inv?.sri?.access_key,
      inv?.customer?.fullName,
      inv?.customer?.num_identificacion,
      inv?.customer_name,
      inv?.customer_identification_number,
      inv?.status,
      inv?.sri?.status,
      inv?.sri?.provider_status,
      inv?.email_status
    ].some(value => String(value ?? '').toLowerCase().includes(term)));
  }

  limpiarFiltros(): void {
    this._search = '';
    this.statusFiltro = '';
    this.fromDate = '';
    this.toDate = '';
    this.page = 1;
    this.loadInvoices();
  }

  onPaginationPage(page: number): void {
    if (page === this.page) return;
    this.page = page;
    this.loadInvoices();
  }

  onPaginationPageSize(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.loadInvoices();
  }

  /** Refleja los filtros en la dirección sin agregar entradas al historial. */
  private syncUrl(): void {
    writeListQuery(this.router, this.route,
      { estado: this.statusFiltro, q: this._search, desde: this.fromDate, hasta: this.toDate, pagina: this.page });
  }

  trackByName(_: number, invoice: any): string {
    return String(invoice?.name ?? '');
  }

  documentNumber(invoice: any): string {
    return String(invoice?.document_number ?? invoice?.sri?.number ?? '—');
  }

  accessKey(invoice: any): string {
    return String(invoice?.access_key ?? invoice?.sri?.access_key ?? invoice?.electronic?.access_key ?? '');
  }

  postingDate(invoice: any): string {
    return String(invoice?.posting_date ?? invoice?.createdAt ?? invoice?.creation ?? '—');
  }

  customerName(invoice: any): string {
    return String(invoice?.customer?.fullName ?? invoice?.customer?.customer_name ?? invoice?.customer_name ?? invoice?.nombre_cliente ?? '—');
  }

  customerIdentification(invoice: any): string {
    return String(invoice?.customer?.num_identificacion ?? invoice?.customer?.identification_number ?? invoice?.customer_identification_number ?? invoice?.identificacion_cliente ?? '—');
  }

  invoiceTotal(invoice: any): number {
    return Number(invoice?.total ?? invoice?.grand_total ?? 0) || 0;
  }

  providerStatus(invoice: any): string {
    return String(invoice?.sri?.provider_status ?? invoice?.electronic?.provider_status ?? invoice?.provider_status ?? '');
  }

  sriMessage(invoice: any): string {
    return String(invoice?.sri?.sri_message ?? invoice?.electronic?.sri_message ?? invoice?.sri_message ?? invoice?.emission_error ?? '');
  }

  emailStatus(invoice: any): string {
    return String(invoice?.email?.status ?? invoice?.email_status ?? 'No enviado');
  }
}
