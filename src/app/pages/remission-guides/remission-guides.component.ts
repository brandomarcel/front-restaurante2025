import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { EcuadorTimePipe } from 'src/app/core/pipes/ecuador-time-pipe.pipe';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { AppPaginationComponent } from 'src/app/shared/components/pagination/app-pagination.component';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { RemissionGuidesService } from 'src/app/services/remission-guides.service';

@Component({
  selector: 'app-remission-guides',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, EcuadorTimePipe, ButtonComponent, AppPaginationComponent],
  templateUrl: './remission-guides.component.html'
})
export class RemissionGuidesComponent implements OnInit {
  guides: any[] = [];
  page = 1;
  pageSize = 10;
  total = 0;
  totalPages = 1;

  _search = '';
  statusFilter = '';

  constructor(
    private svc: RemissionGuidesService,
    private spinner: NgxSpinnerService,
    public capabilities: CompanyCapabilitiesService
  ) {}

  ngOnInit(): void {
    this.loadGuides();
  }

  get search(): string { return this._search; }
  set search(v: string) {
    this._search = v || '';
    this.page = 1;
    this.loadGuides();
  }

  loadGuides(): void {
    this.spinner.show();
    const offset = (this.page - 1) * this.pageSize;
    this.svc.getAll(this.pageSize, offset, this.statusFilter || undefined, undefined, this._search).subscribe({
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
        this.spinner.hide();
      },
      error: (err: any) => {
        this.spinner.hide();
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

  recipientsSummary(guide: any): string {
    const recipients = Array.isArray(guide?.destinatarios) ? guide.destinatarios : [];
    if (!recipients.length) return '—';
    const first = recipients[0]?.razon_social_destinatario || recipients[0]?.razonSocialDestinatario || '—';
    return recipients.length > 1 ? `${first} (+${recipients.length - 1})` : first;
  }

  documentNumber(guide: any): string {
    return String(guide?.electronic?.document_number || guide?.document_number || guide?.name || '—');
  }

  getStatusLabel(status: string | undefined | null): string {
    const value = String(status || '').trim().toUpperCase();
    if (value === 'AUTORIZADA' || value === 'AUTORIZADO') return 'Autorizada';
    if (value === 'RECHAZADA' || value === 'RECHAZADO') return 'Rechazada';
    if (value === 'ERROR DE ENVIO' || value === 'ERROR DE ENVÍO') return 'Error de envío';
    if (value === 'PENDIENTE EMISION' || value === 'PENDIENTE EMISIÓN') return 'Pendiente emisión';
    if (value === 'EMITIDA') return 'Emitida';
    if (value === 'BORRADOR' || value === 'DRAFT') return 'Borrador';
    return value || '—';
  }

  getStatusBadge(status: string | undefined | null): string {
    const value = String(status || '').trim().toUpperCase();
    if (value === 'AUTORIZADA' || value === 'AUTORIZADO') return 'badge-green';
    if (value === 'RECHAZADA' || value === 'RECHAZADO' || value === 'ERROR DE ENVIO' || value === 'ERROR DE ENVÍO') return 'badge-red';
    if (value === 'BORRADOR' || value === 'DRAFT') return 'badge-gray';
    return 'badge-yellow';
  }

  isDraft(guide: any): boolean {
    return this.getStatusLabel(guide?.status).toUpperCase() === 'BORRADOR';
  }
}
