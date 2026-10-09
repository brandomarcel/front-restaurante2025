import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { toast } from 'ngx-sonner';
import { EcuadorTimePipe } from 'src/app/core/pipes/ecuador-time-pipe.pipe';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { AppPaginationComponent } from 'src/app/shared/components/pagination/app-pagination.component';
import { ElectronicStatusBadgeComponent } from 'src/app/shared/components/electronic-status-badge/electronic-status-badge.component';
import { ListStateComponent } from 'src/app/shared/components/list-state/list-state.component';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { RemissionGuidesService } from 'src/app/services/remission-guides.service';
import { REMISSION_GUIDE_STATUS_FILTERS, electronicStatusFilterOptions } from 'src/app/core/utils/electronic-document';
import { debouncedCallback } from 'src/app/shared/utils/debounced-callback';

@Component({
  selector: 'app-remission-guides',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, EcuadorTimePipe, ButtonComponent, AppPaginationComponent, ElectronicStatusBadgeComponent, ListStateComponent],
  templateUrl: './remission-guides.component.html'
})
export class RemissionGuidesComponent implements OnInit {
  guides: any[] = [];
  page = 1;
  pageSize = 10;
  total = 0;
  totalPages = 1;
  loading = false;

  _search = '';
  statusFilter = '';

  /** Las guías se leen con el contrato electrónico Lite y no usan Reemplazada ni Anulada. */
  readonly statusOptions = electronicStatusFilterOptions(REMISSION_GUIDE_STATUS_FILTERS, true);
  private readonly searchBackend: () => void;
  private request?: Subscription;

  constructor(
    private svc: RemissionGuidesService,
    public capabilities: CompanyCapabilitiesService,
    destroyRef: DestroyRef
  ) {
    this.searchBackend = debouncedCallback(destroyRef, () => {
      this.page = 1;
      this.loadGuides();
    });
    destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  ngOnInit(): void {
    this.loadGuides();
  }

  get search(): string { return this._search; }
  set search(v: string) {
    this._search = v || '';
    this.searchBackend();
  }

  get hasActiveFilters(): boolean {
    return !!this._search.trim() || !!this.statusFilter;
  }

  get canCreate(): boolean {
    return this.capabilities.hasPermission('billing.create');
  }

  loadGuides(): void {
    // Cancela la petición anterior para que una respuesta lenta no pise un filtro más reciente.
    this.request?.unsubscribe();
    this.loading = true;
    const offset = (this.page - 1) * this.pageSize;
    this.request = this.svc.getAll(this.pageSize, offset, this.statusFilter || undefined, undefined, this._search).subscribe({
      next: (res: any) => {
        const msg = res?.message || res;
        this.guides = msg?.data || [];
        this.pageSize = Number(msg?.limit ?? this.pageSize) || this.pageSize;
        const responseOffset = Number(msg?.offset);
        if (Number.isFinite(responseOffset) && responseOffset >= 0) {
          this.page = Math.floor(responseOffset / this.pageSize) + 1;
        }
        this.total = Number(msg?.total ?? this.guides.length) || 0;
        const hasNext = Boolean(msg?.has_next ?? msg?.hasNext);
        this.totalPages = Math.max(1, Math.ceil(this.total / this.pageSize) || 1, hasNext ? this.page + 1 : 1);
        this.loading = false;
      },
      error: (err: any) => {
        this.loading = false;
        toast.error(String(err?.error?.message || err?.message || 'No se pudieron cargar las guías de remisión.'));
      }
    });
  }

  limpiarFiltros(): void {
    this._search = '';
    this.statusFilter = '';
    this.page = 1;
    this.loadGuides();
  }

  onStatusChange(): void {
    this.page = 1;
    this.loadGuides();
  }

  onPaginationPage(page: number): void {
    if (page === this.page) return;
    this.page = page;
    this.loadGuides();
  }

  onPaginationPageSize(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.loadGuides();
  }

  trackByName(_: number, guide: any): string {
    return String(guide?.name ?? '');
  }

  recipientsSummary(guide: any): string {
    const recipients = Array.isArray(guide?.destinatarios) ? guide.destinatarios : [];
    if (!recipients.length) return '—';
    const first = recipients[0]?.razon_social_destinatario || recipients[0]?.razonSocialDestinatario || '—';
    return recipients.length > 1 ? `${first} (+${recipients.length - 1})` : first;
  }

  documentNumber(guide: any): string {
    return String(guide?.electronic?.document_number || guide?.document_number || guide?.name || '—');
  }

  guideDate(guide: any): string {
    return guide?.posting_date || guide?.createdAt || guide?.creation || '';
  }

  isDraft(guide: any): boolean {
    return ['BORRADOR', 'DRAFT'].includes(String(guide?.status || '').trim().toUpperCase());
  }
}
