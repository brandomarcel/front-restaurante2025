import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { NgxSpinnerService } from 'ngx-spinner';
import { EcuadorTimePipe } from '../../core/pipes/ecuador-time-pipe.pipe';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { Router, RouterModule } from '@angular/router';
import { InvoicesService } from 'src/app/services/invoices.service';
import { PrintService } from 'src/app/services/print.service';
import { environment } from 'src/environments/environment';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { liteEmissionMessages } from 'src/app/core/utils/lite-invoice-emission';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxPaginationModule, EcuadorTimePipe, ButtonComponent,RouterModule],
  templateUrl: './invoices.component.html',
  styleUrls: ['./invoices.component.css']
})
export class InvoicesComponent implements OnInit {
  invoices: any[] = [];
  invoicesFiltradas: any[] = [];
  page = 1;
  pageSize = 10;
  total = 0;
  totalPages = 1;

  _search = '';
  statusFiltro = '';
  conOrdenFiltro: '' | 'con' | 'sin' = ''; // filtro por enlace a orden

  mostrarModal = false;
  invoiceSelected: any | null = null;
  activeTab: 'info' | 'sri' | 'items' = 'info';
  actionRunning = false;

  private url = environment.URL; // si usas URL (como en orders); si usas apiUrl para imprimir, ajusta

  constructor(
    private svc: InvoicesService,           // o InvoicesService
    private spinner: NgxSpinnerService,
    private router: Router,
    private printService: PrintService,
    public capabilities: CompanyCapabilitiesService
  ) {}
  ngOnInit(): void {
    this.loadInvoices();
  }

  loadInvoices(): void {
    this.spinner.show();
    const offset = (this.page - 1) * this.pageSize;
    this.svc.getAllInvoices(this.pageSize, offset, this.statusFiltro || undefined).subscribe({
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
        console.error('Error al cargar facturas:', err);
      }
    });
  }

  get search(): string { return this._search; }
  set search(v: string) {
    this._search = v || '';
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    const term = (this._search || '').toLowerCase();
    let lista = Array.isArray(this.invoices) ? [...this.invoices] : [];

    lista = lista.filter(inv => {
      const byText = [
        inv?.name,
        inv?.sri?.number,
        inv?.sri?.access_key,
        inv?.customer?.fullName,
        inv?.customer?.num_identificacion,
        inv?.sri?.status
      ].map(x => (x ?? '').toString().toLowerCase()).some(x => x.includes(term));

      const hasOrder = !!inv?.order;
      const byOrden =
        this.conOrdenFiltro === '' ? true :
        this.conOrdenFiltro === 'con' ? hasOrder :
        !hasOrder;

      return byText && byOrden;
    });
    console.log('lista filtrada:', lista  );

    this.invoicesFiltradas = lista;
  }

  limpiarFiltros(): void {
    this._search = '';
    this.statusFiltro = '';
    this.conOrdenFiltro = '';
    this.aplicarFiltros();
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
    const status = String(this.invoiceSelected?.sri?.status || this.invoiceSelected?.status || '').trim().toUpperCase();
    const providerStatus = String(this.invoiceSelected?.sri?.provider_status || this.invoiceSelected?.provider_status || '').trim().toUpperCase();
    if (this.capabilities.isLiteMode && !['AUTORIZADO', 'AUTORIZADA', 'AUTHORIZED'].includes(status) && providerStatus !== 'AUTHORIZED') {
      toast.info('El RIDE oficial estará disponible cuando la factura sea autorizada.');
      return;
    }
    if (this.capabilities.isLiteMode) {
      this.printService.downloadLiteInvoicePdf(invoiceName, 'FACTURADA RIDE').subscribe({
        next: (blob) => this.openPdfBlob(blob),
        error: () => toast.error('No se pudo descargar el documento Lite.')
      });
      return;
    }
    const w = window.open(this.url + this.printService.getFacturaPdf(invoiceName), '_blank');
    if (!w) toast.error('No se pudo abrir la ventana de impresión');
  }

  getTicketPdf() {
    const invoiceName = this.invoiceSelected?.name || this.invoiceSelected?.sri?.invoice;
    if (!invoiceName) return;
    if (this.capabilities.isLiteMode) {
      this.printService.downloadLiteInvoicePdf(invoiceName, 'FacturADA Lite Ticket').subscribe({
        next: (blob) => this.openPdfBlob(blob),
        error: () => toast.error('No se pudo descargar el documento Lite.')
      });
      return;
    }
    const w = window.open(this.url + this.printService.getFacturaPdf(invoiceName), '_blank');
    if (!w) toast.error('No se pudo abrir la ventana de impresión');
  }

  private openPdfBlob(blob: Blob): void {
    const url = window.URL.createObjectURL(blob);
    const popup = window.open(url, '_blank');
    if (!popup) toast.error('No se pudo abrir el documento descargado.');
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  }

  // Reenviar/Regenerar factura (opcional, si tienes endpoint)
  reenviarFactura() {
    if (this.actionRunning) return;
    const invoiceName = this.invoiceSelected?.name || this.invoiceSelected?.sri?.invoice;
    if (!invoiceName) {
      toast.error('Factura no disponible');
      return;
    }

    if (this.capabilities.isLiteMode && !this.isLiteRetryable(this.invoiceSelected) && !this.isLiteProcessing(this.invoiceSelected)) {
      toast.info('Esta factura no está disponible para reintento ni consulta de estado.');
      return;
    }

    this.actionRunning = true;
    this.spinner.show();
    const request$ = this.capabilities.isLiteMode
      ? (this.isLiteRetryable(this.invoiceSelected)
        ? this.svc.retryLiteInvoice(invoiceName)
        : this.svc.refreshLiteInvoiceStatus(invoiceName))
      : this.svc.emit_existing_invoice_v2(invoiceName);
    request$.subscribe({
      next: (res: any) => {
        if (res?.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
          this.invoiceSelected = { ...(this.invoiceSelected || {}), ...res.data };
        }
        const messages = [
          ...liteEmissionMessages(res?.emission),
          ...liteEmissionMessages(res?.data)
        ].filter(Boolean);
        toast.success(messages[0] || (this.capabilities.isLiteMode && this.isLiteRetryable(this.invoiceSelected)
          ? 'Reintento de emisión enviado.'
          : 'Estado SRI actualizado'));
        this.loadInvoices();
        this.closeModal();
      },
      error: (error) => {
        const message = this.readActionError(error);
        toast.error(message);
        this.spinner.hide();
        this.actionRunning = false;
      },
      complete: () => { this.spinner.hide(); this.actionRunning = false; }
    });
  }

  irAOrden(orderName: string) {
    if (!orderName) return;
    this.router.navigate(['/dashboard/orders', orderName]);
  }

  getSriStatusLabel(status: string | undefined | null): string {
    const value = String(status || '').trim().toUpperCase();
    if (value === 'AUTORIZADO' || value === 'AUTORIZADA' || value === 'AUTHORIZED' || value === 'SRI_AUTHORIZED') return 'AUTORIZADO';
    if (value === 'REJECTED' || value === 'RECHAZADO' || value === 'RECHAZADA' || value === 'NOT_AUTHORIZED' || value === 'SRI_REJECTED') return 'Rechazada';
    if (value === 'ERROR') return 'Error';
    if (value === 'QUEUED' || value === 'EN COLA') return 'En cola';
    if (value === 'PROCESSING' || value === 'ENVIADO' || value === 'FIRMADO') return 'En proceso';
    if (value === 'DRAFT' || value === 'BORRADOR') return 'Borrador';
    return value || '—';
  }

  getSriStatusBadge(status: string | undefined | null): string {
    const value = String(status || '').trim().toUpperCase();
    if (value === 'AUTORIZADO' || value === 'AUTORIZADA' || value === 'AUTHORIZED' || value === 'SRI_AUTHORIZED') return 'badge-green';
    if (value === 'REJECTED' || value === 'RECHAZADO' || value === 'RECHAZADA' || value === 'ERROR' || value === 'ANULADA') return 'badge-red';
    return 'badge-yellow';
  }

  getInvoiceStatusLabel(invoice: any): string {
    const status = String(invoice?.status || invoice?.sri?.status || '').trim().toUpperCase();
    const provider = String(invoice?.sri?.provider_status || invoice?.provider_status || '').trim().toUpperCase();
    const code = String(invoice?.sri?.sri_code || invoice?.sri?.status_code || invoice?.sri?.code || invoice?.sri_code || invoice?.status_code || invoice?.provider_status_code || '').trim().toUpperCase();
    if (provider === 'AUTHORIZED') return 'AUTORIZADO';
    if (status === 'EMITIDA' && (['PROCESSING', 'RECEIVED', 'PENDING'].includes(provider) || code === '70')) return 'Procesando';
    return this.getSriStatusLabel(status);
  }

  getInvoiceStatusBadge(invoice: any): string {
    const label = this.getInvoiceStatusLabel(invoice);
    if (label === 'AUTORIZADO') return 'badge-green';
    if (label === 'Rechazada' || label === 'Error') return 'badge-red';
    return 'badge-yellow';
  }

  isLiteProcessing(invoice: any): boolean {
    const value = String(invoice?.status || invoice?.sri?.status || '').trim().toUpperCase();
    const provider = String(invoice?.sri?.provider_status || invoice?.provider_status || '').trim().toUpperCase();
    const code = String(invoice?.sri?.sri_code || invoice?.sri?.status_code || invoice?.sri?.code || invoice?.sri_code || invoice?.status_code || invoice?.provider_status_code || '').trim().toUpperCase();
    return ['PROCESSING', 'PENDING', 'PENDIENTE EMISION', 'PENDIENTE EMISIÓN', 'EN COLA', 'FIRMADO', 'ENVIADO', 'QUEUED'].includes(value) ||
      code === '70' || (value === 'EMITIDA' && ['PROCESSING', 'RECEIVED', 'PENDING'].includes(provider));
  }

  isLiteRetryable(invoice: any): boolean {
    const value = String(invoice?.status || invoice?.sri?.status || '').trim().toUpperCase();
    const provider = String(invoice?.sri?.provider_status || invoice?.provider_status || '').trim().toUpperCase();
    return ['ERROR DE ENVIO', 'ERROR DE ENVÍO', 'RECHAZADO', 'RECHAZADA', 'REJECTED'].includes(value) ||
      ['ERROR', 'FAILED', 'REJECTED', 'NOT_AUTHORIZED'].includes(provider);
  }

  get sriActionLabel(): string {
    if (this.capabilities.isLiteMode) return this.isLiteRetryable(this.invoiceSelected) ? 'Reintentar emisión' : 'Consultar autorización';
    return 'Reenviar factura';
  }

  private readActionError(error: any): string {
    const raw = error?.error?._server_messages || error?.error?.message || error?.error?._error_message || error?.message;
    let message = '';
    try {
      const parsed = typeof raw === 'string' && raw.trim().startsWith('[') ? JSON.parse(raw) : raw;
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      const value = typeof first === 'string' ? (() => { try { return JSON.parse(first); } catch { return first; } })() : first;
      message = typeof value === 'string' ? value : value?.message || '';
    } catch { message = String(raw || ''); }
    if (message.toLowerCase().includes('solo se puede reenviar una factura con error')) {
      return 'La factura ya fue enviada o autorizada. Usa Consultar autorización para obtener su resultado.';
    }
    return message || 'No se pudo completar la acción.';
  }
}
