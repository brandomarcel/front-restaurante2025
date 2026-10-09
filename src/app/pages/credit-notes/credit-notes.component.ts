import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { CreditNoteService } from 'src/app/services/credit-note.service';
import { AppPaginationComponent } from 'src/app/shared/components/pagination/app-pagination.component';
import { ElectronicStatusBadgeComponent } from 'src/app/shared/components/electronic-status-badge/electronic-status-badge.component';
import { ListStateComponent } from 'src/app/shared/components/list-state/list-state.component';
import { ELECTRONIC_STATUS_FILTERS, electronicStatusFilterOptions } from 'src/app/core/utils/electronic-document';
import { debouncedCallback } from 'src/app/shared/utils/debounced-callback';

@Component({
  selector: 'app-credit-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, RouterModule, AppPaginationComponent, ElectronicStatusBadgeComponent, ListStateComponent],
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
  statusFilter = '';

  /** Las notas de crédito siempre se leen con el contrato electrónico Lite. */
  readonly statusOptions = electronicStatusFilterOptions(ELECTRONIC_STATUS_FILTERS, true);
  private readonly searchBackend: () => void;
  private request?: Subscription;

  constructor(private svc: CreditNoteService, destroyRef: DestroyRef) {
    this.searchBackend = debouncedCallback(destroyRef, () => {
      this.page = 1;
      this.loadInvoices();
    });
    destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  ngOnInit(): void {
    this.loadInvoices();
  }

  loadInvoices(): void {
    // Cancela la petición anterior para que una respuesta lenta no pise un filtro más reciente.
    this.request?.unsubscribe();
    this.loading = true;
    const offset = (this.page - 1) * this.pageSize;
    this.request = this.svc.getAllCreditNotes(this.pageSize, offset, this.statusFilter || undefined, this._search).subscribe({
      next: (res: any) => {
        const msg = res.message || res;
        this.invoices = msg.data || [];
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
    return !!this._search.trim() || !!this.statusFilter;
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
