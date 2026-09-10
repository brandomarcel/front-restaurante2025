import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
import { PosSaleService } from 'src/app/services/pos-sale.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';

@Component({
  selector: 'app-pos-sale-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  constructor(
    private posSaleService: PosSaleService,
    public capabilities: CompanyCapabilitiesService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.load();
  }

  get search(): string {
    return this._search;
  }

  set search(value: string) {
    this._search = value || '';
  }

  get filteredNotes(): any[] {
    const term = this._search.trim().toLocaleLowerCase();
    if (!term) return this.notes;
    return this.notes.filter((note) => [
      note?.name,
      note?.document_number,
      this.customerName(note),
      this.customerIdentification(note),
      note?.pos_terminal_name,
      note?.pos_terminal,
      note?.lite_invoice,
      note?.status
    ].some((value) => String(value ?? '').toLocaleLowerCase().includes(term)));
  }

  load(): void {
    this.loading = true;
    this.posSaleService.list(this.status, this.fromDate, this.toDate).pipe(finalize(() => this.loading = false)).subscribe({
      next: (rows) => this.notes = rows || [],
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

  invoice(note: any): void {
    if (String(note?.status || '') !== 'Cobrada' || note?.lite_invoice) return;
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
      Borrador: 'bg-slate-100 text-slate-700',
      Cobrada: 'bg-emerald-100 text-emerald-700',
      Facturada: 'bg-blue-100 text-blue-700',
      Anulada: 'bg-red-100 text-red-700'
    };
    return classes[status] || 'bg-amber-100 text-amber-700';
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
