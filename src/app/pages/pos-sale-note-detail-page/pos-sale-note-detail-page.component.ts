import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
import { PosSaleService } from 'src/app/services/pos-sale.service';

@Component({
  selector: 'app-pos-sale-note-detail-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pos-sale-note-detail-page.component.html'
})
export class PosSaleNoteDetailPageComponent implements OnInit {
  note: any | null = null;
  loading = false;
  actionName = '';
  private readonly name: string;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private posSaleService: PosSaleService
  ) {
    this.name = String(this.route.snapshot.paramMap.get('id') || '').trim();
  }

  ngOnInit(): void {
    if (!this.name) {
      this.goBack();
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.posSaleService.get(this.name).pipe(finalize(() => this.loading = false)).subscribe({
      next: (detail) => this.note = detail || null,
      error: (err) => toast.error(this.errorMessage(err) || 'No se pudo consultar la nota de venta.')
    });
  }

  collect(): void {
    if (!this.note || this.note.status !== 'Borrador') return;
    this.runAction('cobrar', () => this.posSaleService.collect(this.name), 'Nota de venta cobrada.');
  }

  invoice(): void {
    if (!this.note || this.note.status !== 'Cobrada' || this.linkedInvoice(this.note)) return;
    this.runAction('facturar', () => this.posSaleService.invoice(this.name), 'Nota de venta facturada.', true);
  }

  cancel(): void {
    if (!this.note || !['Borrador', 'Cobrada'].includes(this.note.status) || this.linkedInvoice(this.note)) return;
    this.runAction('anular', () => this.posSaleService.cancel(this.name), 'Nota de venta anulada.');
  }

  print(): void {
    if (!this.note || this.actionName) return;
    this.actionName = 'imprimir';
    this.posSaleService.downloadPdf(this.name).pipe(finalize(() => this.actionName = '')).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener=yes,noreferrer=yes');
        window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      },
      error: (err) => toast.error(this.errorMessage(err) || 'La nota aún no está disponible para impresión.')
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/pos-sale-notes']);
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

  customerField(note: any, field: string): string {
    const customer = note?.customer && typeof note.customer === 'object' ? note.customer : null;
    return String(customer?.[field] || '—');
  }

  linkedInvoice(note: any): string {
    const invoice = note?.lite_invoice;
    return String(typeof invoice === 'string' ? invoice : invoice?.name || invoice?.invoice_name || '');
  }

  itemTotal(item: any): number {
    return Number(item?.total_amount ?? item?.total ?? ((Number(item?.taxable_amount || 0) || 0) + (Number(item?.tax_amount || 0) || 0))) || 0;
  }

  paymentLabel(payment: any): string {
    return String(payment?.payment_method || payment?.formas_de_pago || payment?.name || 'Método de pago');
  }

  private runAction(action: string, request: () => any, success: string, openInvoice = false): void {
    if (this.actionName) return;
    this.actionName = action;
    request().pipe(finalize(() => this.actionName = '')).subscribe({
      next: (response: any) => {
        const updated = response?.data || response || this.note;
        this.note = { ...(this.note || {}), ...(updated || {}) };
        toast.success(success);
        if (openInvoice) {
          const invoiceName = this.linkedInvoice(this.note) || String(response?.emission?.invoice_name || response?.invoice_name || '').trim();
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
