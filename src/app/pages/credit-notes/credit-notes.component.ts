import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CreditNoteService } from 'src/app/services/credit-note.service';
import { AppPaginationComponent } from 'src/app/shared/components/pagination/app-pagination.component';
import { ElectronicStatusBadgeComponent } from 'src/app/shared/components/electronic-status-badge/electronic-status-badge.component';
import { ListStateComponent } from 'src/app/shared/components/list-state/list-state.component';
import { ELECTRONIC_STATUS_GROUPS, electronicStatusFromQuery, electronicStatusParam, electronicStatusTabs } from 'src/app/core/constants/electronic-status-tabs';
import { FilterDates, ListFilterBarComponent } from 'src/app/shared/components/list-filter-bar/list-filter-bar.component';
import { readListQuery, writeListQuery } from 'src/app/shared/utils/list-query';
import { debouncedCallback } from 'src/app/shared/utils/debounced-callback';

@Component({
  selector: 'app-credit-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AppPaginationComponent, ElectronicStatusBadgeComponent, ListStateComponent, ListFilterBarComponent],
  templateUrl: './credit-notes.component.html',
  styleUrl: './credit-notes.component.css'
})
export class CreditNotesComponent implements OnInit {
  invoices: any[] = [];
  invoicesFiltradas: any[] = [];
  page = 1;
  pageSize = 10;
  total = 0;
  totalPages = 1;
  loading = false;

  _search = '';
  /** Grupo de estado (`autorizadas`, `en-proceso`, `con-error`, `anuladas`) o vacío. */
  statusFilter = '';
  /** Fecha de emisión `YYYY-MM-DD` (vacío = sin límite). */
  fromDate = '';
  toDate = '';
  /** Conteos por pestaña (`status_counts`); null si el backend no los envía. */
  statusCounts: Record<string, number> | null = null;

  readonly statusOptions = ELECTRONIC_STATUS_GROUPS;
  readonly statusTabs = electronicStatusTabs('Todas las notas de crédito');
  private readonly searchBackend: () => void;
  private request?: Subscription;

  constructor(private svc: CreditNoteService, destroyRef: DestroyRef, private route: ActivatedRoute, private router: Router) {
    this.searchBackend = debouncedCallback(destroyRef, () => {
      this.page = 1;
      this.loadInvoices();
    });
    destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  ngOnInit(): void {
    // Filtros y página en la dirección: al volver del detalle la lista sigue igual.
    const query = readListQuery(this.route);
    this.statusFilter = electronicStatusFromQuery(query.estado);
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
    writeListQuery(this.router, this.route,
      { estado: this.statusFilter, q: this._search, desde: this.fromDate, hasta: this.toDate, pagina: this.page });
    const offset = (this.page - 1) * this.pageSize;
    const args: Parameters<CreditNoteService['getAllCreditNotes']> = [this.pageSize, offset, electronicStatusParam(this.statusFilter), this._search];
    if (this.fromDate || this.toDate) args.push({ from: this.fromDate, to: this.toDate });
    this.request = this.svc.getAllCreditNotes(...args).subscribe({
      next: (res: any) => {
        const msg = res.message || res;
        this.invoices = msg.data || [];
        const counts = msg.status_counts;
        this.statusCounts = counts && typeof counts === 'object' ? counts : null;
        this.pageSize = Number(msg?.limit ?? this.pageSize) || this.pageSize;
        const responseOffset = Number(msg?.offset);
        if (Number.isFinite(responseOffset) && responseOffset >= 0) {
          this.page = Math.floor(responseOffset / this.pageSize) + 1;
        }
        this.total = Number(msg.total ?? msg.total_count ?? msg.count ?? this.invoices.length) || 0;
        const hasNext = Boolean(msg?.has_next ?? msg?.hasNext);
        this.totalPages = Math.max(1, Math.ceil(this.total / this.pageSize) || 1, hasNext ? this.page + 1 : 1);
        this.aplicarFiltros();
        this.loading = false;
      },
      error: (err: any) => {
        this.loading = false;
        toast.error(String(err?.error?.message || err?.message || 'No se pudieron cargar las notas de crédito.'));
      }
    });
  }

  get search(): string { return this._search; }
  set search(v: string) {
    this._search = v || '';
    this.aplicarFiltros();
    this.searchBackend();
  }

  get hasActiveFilters(): boolean {
    return !!this._search.trim() || !!this.statusFilter || !!this.fromDate || !!this.toDate;
  }

  setStatus(value: string): void {
    this.statusFilter = value;
    this.onStatusChange();
  }

  onDatesChange(range: FilterDates): void {
    this.fromDate = range.from;
    this.toDate = range.to;
    this.page = 1;
    this.loadInvoices();
  }

  customerName(invoice: any): string {
    return String(invoice?.customer?.customer_name ?? invoice?.customer?.fullName ?? invoice?.customer_name ?? '—');
  }

  customerIdentification(invoice: any): string {
    return String(invoice?.customer?.identification_number ?? invoice?.customer?.num_identificacion ?? invoice?.customer_identification_number ?? '—');
  }

  documentNumber(invoice: any): string {
    return String(invoice?.document_number ?? invoice?.sri?.number ?? '—');
  }

  relatedDocumentNumber(invoice: any): string {
    return String(invoice?.related_document_number ?? invoice?.invoice_modified?.invoice_reference ?? '—');
  }

  noteTotal(invoice: any): number {
    return Number(invoice?.grand_total ?? invoice?.total ?? 0) || 0;
  }

  providerStatus(invoice: any): string {
    return String(invoice?.electronic?.provider_status ?? invoice?.sri?.provider_status ?? '');
  }

  sriMessage(invoice: any): string {
    return String(invoice?.electronic?.sri_message ?? invoice?.sri?.sri_message ?? '');
  }

  emailStatus(invoice: any): string {
    return String(invoice?.email?.status ?? invoice?.email_status ?? 'No enviado');
  }

  trackByName(_: number, invoice: any): string {
    return String(invoice?.name ?? '');
  }

  aplicarFiltros(): void {
    const term = (this._search || '').trim().toLowerCase();
    const lista = Array.isArray(this.invoices) ? this.invoices : [];
    this.invoicesFiltradas = !term ? [...lista] : lista.filter(inv => [
      inv?.name,
      inv?.sri?.number,
      inv?.sri?.access_key,
      inv?.document_number,
      inv?.related_document_number,
      inv?.related_access_key,
      inv?.customer?.fullName,
      inv?.customer?.num_identificacion,
      inv?.customer_name,
      inv?.customer_identification_number,
      inv?.status,
      inv?.provider_status,
      inv?.email_status
    ].some(value => String(value ?? '').toLowerCase().includes(term)));
  }

  limpiarFiltros(): void {
    this._search = '';
    this.statusFilter = '';
    this.fromDate = '';
    this.toDate = '';
    this.page = 1;
    this.loadInvoices();
  }

  onStatusChange(): void {
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
}
