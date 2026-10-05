import { CommonModule } from '@angular/common';
import { Component, DoCheck, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { InvoiceCollectionsService } from 'src/app/services/invoice-collections.service';
import { AppPaginationComponent } from 'src/app/shared/components/pagination/app-pagination.component';

@Component({
  selector: 'app-receivables',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AppPaginationComponent],
  templateUrl: './receivables.component.html'
})
export class ReceivablesComponent implements OnInit, DoCheck {
  rows: any[] = [];
  customer = '';
  collectionStatus: '' | 'Pendiente' | 'Abonada' | 'Pagada' = '';
  onlyOpen = true;
  page = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;
  loading = false;
  private loadedBusiness = '';

  constructor(
    private readonly collections: InvoiceCollectionsService,
    private readonly spinner: NgxSpinnerService,
    public readonly capabilities: CompanyCapabilitiesService
  ) {}

  ngOnInit(): void { this.load(); }

  ngDoCheck(): void {
    const business = String(this.capabilities.activeBusinessId || '').trim();
    if (business && business !== this.loadedBusiness && !this.loading) {
      this.rows = [];
      this.total = 0;
      this.page = 1;
      this.load();
    } else if (business && business !== this.loadedBusiness) {
      // No dejamos en pantalla documentos del negocio anterior mientras la
      // petición anterior termina. Su respuesta se descarta en `next`.
      this.rows = [];
      this.total = 0;
    }
  }

  load(): void {
    const business = String(this.capabilities.activeBusinessId || '').trim();
    if (!business || this.loading) return;
    const requestedBusiness = business;
    this.loadedBusiness = business;
    this.loading = true;
    this.spinner.show();
    this.collections.getReceivables({
      customer: this.customer.trim() || undefined,
      collection_status: this.collectionStatus,
      only_open: this.onlyOpen,
      limit: this.pageSize,
      offset: (this.page - 1) * this.pageSize
    }).pipe(finalize(() => {
      this.loading = false;
      this.spinner.hide();
    })).subscribe({
      next: (response: any) => {
        if (requestedBusiness !== String(this.capabilities.activeBusinessId || '').trim()) return;
        const message = response?.message ?? response ?? {};
        this.rows = Array.isArray(message?.data) ? message.data : [];
        this.total = Number(message?.total ?? this.rows.length) || 0;
        this.pageSize = Number(message?.limit ?? this.pageSize) || this.pageSize;
        const offset = Number(message?.offset ?? (this.page - 1) * this.pageSize);
        this.page = Math.floor(Math.max(0, offset) / this.pageSize) + 1;
        const hasNext = Boolean(message?.has_next);
        this.totalPages = Math.max(1, Math.ceil(this.total / this.pageSize), hasNext ? this.page + 1 : 1);
      },
      error: (error: any) => toast.error(this.errorMessage(error))
    });
  }

  applyFilters(): void { this.page = 1; this.load(); }
  clearFilters(): void {
    this.customer = '';
    this.collectionStatus = '';
    this.onlyOpen = true;
    this.page = 1;
    this.load();
  }
  onPageChange(page: number): void { if (page !== this.page) { this.page = page; this.load(); } }
  onPageSizeChange(size: number): void { this.pageSize = size; this.page = 1; this.load(); }

  outstanding(row: any): number { return Number(row?.totals?.outstanding_amount ?? row?.outstanding_amount ?? 0) || 0; }
  collected(row: any): number { return Number(row?.totals?.total_collected ?? row?.total_collected ?? 0) || 0; }
  grandTotal(row: any): number { return Number(row?.totals?.grand_total ?? row?.grand_total ?? row?.total ?? 0) || 0; }
  collectionLabel(row: any): string { return String(row?.collection_status || row?.totals?.collection_status || 'Pendiente'); }
  collectionClass(row: any): string {
    const status = this.collectionLabel(row).toLowerCase();
    return status.includes('pagada') ? 'bg-emerald-100 text-emerald-700' : status.includes('abonada') ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700';
  }

  private errorMessage(error: any): string {
    if (error?.status === 403) return 'No tienes permiso para consultar la cartera.';
    return String(error?.error?.message || error?.error?.message?.message || error?.message || 'No se pudo cargar la cartera.');
  }
}
