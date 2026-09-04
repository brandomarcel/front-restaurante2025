import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { NgxSpinnerService } from 'ngx-spinner';
import { EcuadorTimePipe } from '../../core/pipes/ecuador-time-pipe.pipe';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { RouterModule } from '@angular/router';
import { PrintService } from 'src/app/services/print.service';
import { environment } from 'src/environments/environment';
import { toast } from 'ngx-sonner';
import { CreditNoteService } from 'src/app/services/credit-note.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-credit-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxPaginationModule, EcuadorTimePipe, ButtonComponent,RouterModule],
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

  _search = '';
  statusFilter = '';

  mostrarModal = false;
  invoiceSelected: any | null = null;
  activeTab: 'info' | 'sri' | 'items' = 'info';
  documentLoading = false;

  private url = environment.URL; // si usas URL (como en orders); si usas apiUrl para imprimir, ajusta

  constructor(
    private svc: CreditNoteService,           // o InvoicesService
    private spinner: NgxSpinnerService,
    private printService: PrintService,
    public capabilities: CompanyCapabilitiesService
  ) {}
  ngOnInit(): void {
    this.loadInvoices();
  }

  loadInvoices(): void {
    this.spinner.show();
    const offset = (this.page - 1) * this.pageSize;
    this.svc.getAllCreditNotes(this.pageSize, offset, this.statusFilter || undefined).subscribe({
      next: (res: any) => {
        const msg = res.message || res; // depende de tu proxy
        this.invoices = msg.data || [];
        this.total = msg.total || 0;
        this.totalPages = Math.ceil(this.total / this.pageSize) || 1;
        this.aplicarFiltros();
        this.spinner.hide();
      },
      error: (err: any) => {
        this.spinner.hide();
        toast.error(String(err?.error?.message || err?.message || 'No se pudieron cargar las notas de crédito.'));
      }
    });
  }

  get search(): string { return this._search; }
  set search(v: string) {
    this._search = v || '';
    this.aplicarFiltros();
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

  providerStatus(invoice: any): string {
    return String(invoice?.electronic?.provider_status ?? invoice?.sri?.provider_status ?? '—');
  }

  sriMessage(invoice: any): string {
    return String(invoice?.electronic?.sri_message ?? invoice?.sri?.sri_message ?? '—');
  }

  emailStatus(invoice: any): string {
    return String(invoice?.email?.status ?? invoice?.email_status ?? 'No enviado');
  }

  invoiceStatus(invoice: any): string {
    return String(invoice?.status ?? invoice?.sri?.status ?? '');
  }

  aplicarFiltros(): void {
    const term = (this._search || '').toLowerCase();
    let lista = Array.isArray(this.invoices) ? [...this.invoices] : [];

    lista = lista.filter(inv => {
      const byText = [
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
      ].map(x => (x ?? '').toString().toLowerCase()).some(x => x.includes(term));

      return byText;
    });

    this.invoicesFiltradas = lista;
  }

  limpiarFiltros(): void {
    this._search = '';
    this.statusFilter = '';
    this.aplicarFiltros();
    this.page = 1;
    this.loadInvoices();
  }

  onStatusChange(): void {
    this.page = 1;
    this.loadInvoices();
  }

  nextPage(): void { if (this.page < this.totalPages) { this.page++; this.loadInvoices(); } }
  prevPage(): void { if (this.page > 1) { this.page--; this.loadInvoices(); } }

 // Abrir/Cerrar modal
  openInvoiceDetail(inv: any) {
    this.invoiceSelected = inv || null;
    this.activeTab = 'info';
    this.mostrarModal = true;
  }
  closeModal() { this.mostrarModal = false; }

  // PDF de factura (usa tu PrintService)
  getFacturaPdf() {
    const invoiceName = this.invoiceSelected?.name || this.invoiceSelected?.sri?.invoice;
    if (!invoiceName) {
      toast.error('Factura no disponible');
      return;
    }
    if (this.capabilities.isLiteMode) {
      if (this.documentLoading) return;
      this.documentLoading = true;
      this.printService.downloadLiteInvoicePdf(invoiceName, 'Credit Note').pipe(
        finalize(() => { this.documentLoading = false; })
      ).subscribe({
        next: (blob) => {
          const url = window.URL.createObjectURL(blob);
          const w = window.open(url, '_blank');
          if (!w) toast.error('No se pudo abrir la ventana de impresión');
          window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
        },
        error: () => toast.error('No se pudo descargar la nota de crédito.')
      });
      return;
    }
    const url = this.url + this.printService.getCreditNotePdf(invoiceName);
    const w = window.open(url, '_blank');
    if (!w) toast.error('No se pudo abrir la ventana de impresión');
  }

  getSriStatusLabel(status: string | undefined | null): string {
    const value = String(status || '').trim().toUpperCase();
    if (value === 'AUTORIZADO' || value === 'AUTORIZADA' || value === 'AUTHORIZED') return 'AUTORIZADA';
    if (value === 'REJECTED' || value === 'RECHAZADO' || value === 'RECHAZADA' || value === 'NOT_AUTHORIZED') return 'Rechazada';
    if (value === 'ERROR') return 'Error';
    if (value === 'QUEUED' || value === 'EN COLA') return 'En cola';
    if (value === 'PROCESSING') return 'Procesando';
    if (value === 'EMITIDA') return 'Emitida';
    if (value === 'DRAFT' || value === 'BORRADOR') return 'Borrador';
    if (value === 'PENDIENTE EMISION' || value === 'PENDIENTE EMISIÓN') return 'Pendiente emisión';
    if (value === 'ERROR DE ENVIO' || value === 'ERROR DE ENVÍO') return 'Error de envío';
    if (value === 'REEMPLAZADA' || value === 'REPLACED') return 'Reemplazada';
    return value || '—';
  }

  getSriStatusBadge(status: string | undefined | null): string {
    const value = String(status || '').trim().toUpperCase();
    if (value === 'AUTORIZADO' || value === 'AUTORIZADA' || value === 'AUTHORIZED') return 'badge-green';
    if (value === 'REJECTED' || value === 'RECHAZADO' || value === 'RECHAZADA' || value === 'ERROR' || value === 'ERROR DE ENVIO' || value === 'ERROR DE ENVÍO' || value === 'ANULADA') return 'badge-red';
    if (value === 'REEMPLAZADA' || value === 'REPLACED') return 'badge-gray';
    return 'badge-yellow';
  }
}
