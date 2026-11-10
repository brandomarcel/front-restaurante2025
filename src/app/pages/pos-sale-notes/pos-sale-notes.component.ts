import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
import { PosSaleService } from 'src/app/services/pos-sale.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FilterDates, FilterTab, ListFilterBarComponent } from 'src/app/shared/components/list-filter-bar/list-filter-bar.component';
import { AppPaginationComponent } from 'src/app/shared/components/pagination/app-pagination.component';
import { debouncedCallback } from 'src/app/shared/utils/debounced-callback';
import { readListQuery, writeListQuery } from 'src/app/shared/utils/list-query';

/** Pestañas de estado; el valor es el estado del backend y la clave de `status_counts`. */
const NOTE_STATUS_TABS: FilterTab[] = [
  { value: '', label: 'Todas', countKey: 'ALL', hint: 'Todas las notas de venta' },
  { value: 'Cobrada', label: 'Cobradas', dot: 'bg-success-500', hint: 'Cobradas, todavía sin factura' },
  { value: 'Facturada', label: 'Facturadas', dot: 'bg-info-500', hint: 'Ya se emitió su factura' },
  { value: 'Borrador', label: 'Sin cobrar', dot: 'bg-warning-500', hint: 'Guardadas sin cobrar' },
  { value: 'Anulada', label: 'Anuladas', dot: 'bg-muted-foreground/50', hint: 'Anuladas antes de facturar' },
];

@Component({
  selector: 'app-pos-sale-notes',
  standalone: true,
  imports: [CommonModule, FormsModule, ListFilterBarComponent, AppPaginationComponent],
  templateUrl: './pos-sale-notes.component.html'
})
export class PosSaleNotesComponent implements OnInit {
  notes: any[] = [];
  selectedNote: any | null = null;
  status = '';
  fromDate = '';
  toDate = '';
  _search = '';
  loading = false;
  actionName = '';
  page = 1;
  pageSize = 20;
  total = 0;
  totalPages = 1;
  /** Conteos por pestaña (`status_counts`); null si el backend no los envía. */
  statusCounts: Record<string, number> | null = null;
  readonly statusTabs = NOTE_STATUS_TABS;

  private readonly searchBackend: () => void;
  private request?: Subscription;

  constructor(
    private posSaleService: PosSaleService,
    public capabilities: CompanyCapabilitiesService,
    private router: Router,
    private route: ActivatedRoute,
    destroyRef: DestroyRef
  ) {
    this.searchBackend = debouncedCallback(destroyRef, () => {
      this.page = 1;
      this.load();
    });
    destroyRef.onDestroy(() => this.request?.unsubscribe());
  }

  ngOnInit(): void {
    // Filtros y página en la dirección: al volver del detalle la lista sigue igual.
    const query = readListQuery(this.route);
    this.status = NOTE_STATUS_TABS.some(tab => tab.value && tab.value === query.estado) ? query.estado : '';
    this._search = query.q;
    this.fromDate = query.desde;
    this.toDate = query.hasta;
    this.page = query.pagina;
    this.load();
  }

  get search(): string {
    return this._search;
  }

  /** La búsqueda se resuelve en el backend al terminar de escribir. */
  set search(value: string) {
    this._search = value || '';
    this.searchBackend();
  }

  /** Compatibilidad con la plantilla: la página ya viene filtrada del backend. */
  get filteredNotes(): any[] {
    return this.notes;
  }

  get hasActiveFilters(): boolean {
    return !!this._search.trim() || !!this.status || !!this.fromDate || !!this.toDate;
  }

  setStatus(value: string): void {
    this.status = value;
    this.page = 1;
    this.load();
  }

  onDatesChange(range: FilterDates): void {
    this.fromDate = range.from;
    this.toDate = range.to;
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

  load(): void {
    // Cancela la petición anterior para que una respuesta lenta no pise un filtro más reciente.
    this.request?.unsubscribe();
    this.loading = true;
    writeListQuery(this.router, this.route,
      { estado: this.status, q: this._search, desde: this.fromDate, hasta: this.toDate, pagina: this.page });
    this.request = this.posSaleService.listPage({
      status: this.status || undefined, search: this._search, fromDate: this.fromDate || undefined,
      toDate: this.toDate || undefined, limit: this.pageSize, offset: (this.page - 1) * this.pageSize,
    }).pipe(finalize(() => this.loading = false)).subscribe({
      next: ({ rows, total, hasNext, counts }) => {
        this.notes = rows;
        this.total = total;
        this.statusCounts = counts;
        this.totalPages = Math.max(1, Math.ceil(total / this.pageSize) || 1, hasNext ? this.page + 1 : 1);
      },
      error: (err) => toast.error(this.errorMessage(err) || 'No se pudieron cargar las notas de venta.')
    });
  }

  open(note: any): void {
    const name = String(note?.name || '').trim();
    if (!name) return;
    this.router.navigate(['/dashboard/pos-sale-notes', name]);
  }

  collect(note: any): void {
    if (String(note?.status || '') !== 'Borrador') return;
    this.runAction(note, 'cobrar', () => this.posSaleService.collect(note.name), 'Nota de venta cobrada.');
  }

  /** Mismo control de emisión que el POS (permiso, plan, firma, configuración y cupo). */
  get invoiceBlockMessage(): string | null {
    return this.capabilities.getEmissionBlockMessage({ feature: 'billing' });
  }

  invoice(note: any): void {
    if (String(note?.status || '') !== 'Cobrada' || note?.lite_invoice) return;
    if (this.invoiceBlockMessage) {
      toast.error(this.invoiceBlockMessage);
      return;
    }
    this.runAction(note, 'facturar', () => this.posSaleService.invoice(note.name), 'Nota de venta facturada.', true);
  }

  cancel(note: any): void {
    if (!['Borrador', 'Cobrada'].includes(String(note?.status || '')) || note?.lite_invoice) return;
    this.runAction(note, 'anular', () => this.posSaleService.cancel(note.name), 'Nota de venta anulada.');
  }

  print(note: any): void {
    const name = String(note?.name || '').trim();
    if (!name) return;
    this.actionName = name;
    this.posSaleService.downloadPdf(name).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener=yes,noreferrer=yes');
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
        this.actionName = '';
      },
      error: (err) => {
        this.actionName = '';
        toast.error(this.errorMessage(err) || 'La nota aún no está disponible para impresión.');
      }
    });
  }

  statusClass(status: string): string {
    const classes: Record<string, string> = {
      Borrador: 'bg-muted text-foreground',
      Cobrada: 'bg-success-100 text-success-700',
      Facturada: 'bg-info-100 text-info-700',
      Anulada: 'bg-danger-100 text-danger-700'
    };
    return classes[status] || 'bg-warning-100 text-warning-700';
  }

  customerName(note: any): string {
    const customer = note?.customer && typeof note.customer === 'object' ? note.customer : null;
    return String(customer?.customer_name || customer?.nombre || note?.customer_name || note?.nombre_cliente || note?.customer || 'Consumidor Final');
  }

  customerIdentification(note: any): string {
    const customer = note?.customer && typeof note.customer === 'object' ? note.customer : null;
    return String(customer?.identification_number || customer?.num_identificacion || note?.customer_identification_number || note?.identificacion_cliente || '—');
  }

  noteSubtotal(note: any): number {
    return Number(note?.subtotal ?? note?.total_without_tax ?? 0) || 0;
  }

  noteTaxes(note: any): number {
    return Number(note?.taxes ?? note?.iva ?? note?.total_taxes ?? 0) || 0;
  }

  noteTotal(note: any): number {
    return Number(note?.total ?? note?.grand_total ?? note?.total_amount ?? 0) || 0;
  }

  noteItems(note: any): any[] {
    return Array.isArray(note?.items) ? note.items : [];
  }

  itemTotal(item: any): number {
    return Number(item?.total_amount ?? item?.total ?? ((Number(item?.taxable_amount || 0) || 0) + (Number(item?.tax_amount || 0) || 0))) || 0;
  }

  paymentLabel(payment: any): string {
    return String(payment?.payment_method || payment?.formas_de_pago || payment?.name || 'Método de pago');
  }

  linkedInvoice(note: any): string {
    const invoice = note?.lite_invoice;
    return String(typeof invoice === 'string' ? invoice : invoice?.name || invoice?.invoice_name || '');
  }

  clearFilters(): void {
    this._search = '';
    this.status = '';
    this.fromDate = '';
    this.toDate = '';
    this.page = 1;
    this.load();
  }

  private runAction(note: any, action: string, request: () => any, success: string, openInvoice = false): void {
    if (this.actionName) return;
    this.actionName = `${action}:${note.name}`;
    request().pipe(finalize(() => this.actionName = '')).subscribe({
      next: (response: any) => {
        const updated = response?.data || response || note;
        Object.assign(note, updated);
        if (this.selectedNote?.name === note.name) this.selectedNote = { ...this.selectedNote, ...updated };
        toast.success(success);
        if (openInvoice) {
          const invoice = updated?.lite_invoice;
          const invoiceName = String(typeof invoice === 'string' ? invoice : invoice?.name || updated?.invoice_name || response?.emission?.invoice_name || '').trim();
          if (invoiceName) this.router.navigate(['/dashboard/invoices', invoiceName]);
        }
      },
      error: (err: any) => toast.error(this.errorMessage(err) || `No se pudo ${action} la nota.`)
    });
  }

  private errorMessage(err: any): string {
    const raw = err?.error?._server_messages;
    if (raw) {
      try {
        const messages = JSON.parse(raw);
        const parsed = JSON.parse(messages?.[0] || '{}');
        if (parsed?.message) return this.stripHtml(parsed.message);
      } catch { /* fallback below */ }
    }
    return String(err?.error?.message || err?.message || '').trim();
  }

  private stripHtml(value: string): string {
    const div = document.createElement('div');
    div.innerHTML = value;
    return div.textContent || div.innerText || value;
  }
}
