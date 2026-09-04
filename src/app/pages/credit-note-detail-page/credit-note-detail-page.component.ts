import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { EcuadorTimePipe } from 'src/app/core/pipes/ecuador-time-pipe.pipe';
import { InvoicesService } from 'src/app/services/invoices.service';
import { environment } from 'src/environments/environment';
import { toast } from 'ngx-sonner';
import { PrintService } from 'src/app/services/print.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CreditNoteService } from 'src/app/services/credit-note.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { finalize } from 'rxjs';
@Component({
  selector: 'app-credit-note-detail-page',
  standalone: true,
  imports: [CommonModule,
    RouterModule,
    // EcuadorTimePipe,
    FontAwesomeModule],
  templateUrl: './credit-note-detail-page.component.html',
  styleUrl: './credit-note-detail-page.component.css'
})
export class CreditNoteDetailPageComponent implements OnInit {
  invoice: any = null;
  loading = true;
  error = '';
  documentLoading = false;
  emailLoading = false;
  actionLoading = false;
  reissueDate = '';

  private baseUrl = environment.URL;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private invoicesSvc: CreditNoteService,
    private liteInvoicesSvc: InvoicesService,
    private printSvc: PrintService,
    public capabilities: CompanyCapabilitiesService,
  ) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.fetch(id);
  }

  fetch(id: string) {
    this.loading = true; this.error = '';
    const request$ = this.capabilities.isLiteMode
      ? this.liteInvoicesSvc.getLiteCreditNoteDetail(id)
      : this.invoicesSvc.getCreditNoteDetail(id);
    request$.subscribe({

      next: (res: any) => {
        console.log('res', res);
        this.invoice = res || res?.message?.data || res?.message || null;
        this.loading = false;
        if (!this.invoice) this.error = 'Factura no encontrada';
      },
      error: (err) => {
        this.loading = false;
        this.error = 'No se pudo cargar la factura';
      }
    });
  }

  goBack() {
    if (history.length > 2) history.back();
    else this.router.navigate(['/dashboard/credit-notes']);
  }

  getFacturaPdf(): void {
    const inv = this.invoice?.name || this.invoice?.sri?.invoice;
    if (!inv) {
      toast.error('Nota de Credito no disponible');
      return;
    }
    if (this.capabilities.isLiteMode) {
      this.documentLoading = true;
      this.printSvc.downloadLiteInvoicePdf(inv, 'Credit Note').pipe(
        finalize(() => { this.documentLoading = false; })
      ).subscribe({
        next: (blob) => this.openDocument(blob, `${inv}.pdf`),
        error: () => toast.error('No se pudo descargar la nota de crédito.')
      });
      return;
    }
    const url = this.baseUrl + this.printSvc.getCreditNotePdf(inv);
    const w = window.open(url, '_blank'); if (!w) toast.error('No se pudo abrir la impresión');
  }

  downloadXml(): void {
    const inv = this.invoice?.name;
    if (!inv || !this.capabilities.isLiteMode || this.documentLoading) return;
    this.documentLoading = true;
    this.printSvc.downloadLiteInvoiceXml(inv).pipe(
      finalize(() => { this.documentLoading = false; })
    ).subscribe({
      next: (blob) => this.openDocument(blob, `${inv}.xml`),
      error: () => toast.error('No se pudo descargar el XML de la nota de crédito.')
    });
  }

  get isAuthorized(): boolean {
    const status = String(this.invoice?.status || this.invoice?.sri?.status || '').trim().toUpperCase();
    return status === 'AUTHORIZED' || status === 'AUTORIZADA' || status === 'AUTORIZADO';
  }

  sendEmail(): void {
    const name = this.invoice?.name;
    if (!name || !this.capabilities.isLiteMode || !this.isAuthorized || this.emailLoading) return;
    this.emailLoading = true;
    this.liteInvoicesSvc.sendLiteInvoiceEmail(name).pipe(
      finalize(() => { this.emailLoading = false; })
    ).subscribe({
      next: () => {
        toast.success('Solicitud de envío por correo procesada.');
        this.fetch(name);
      },
      error: (error) => toast.error(this.backendError(error, 'No se pudo enviar la nota por correo.'))
    });
  }

  private openDocument(blob: Blob, filename: string): void {
    if (blob.type.includes('json') || blob.type.includes('text')) {
      blob.text().then((text) => {
        try {
          const parsed = JSON.parse(text);
          const data = parsed?.message?.data ?? parsed?.message ?? parsed?.data ?? parsed;
          if (['PENDING', 'PROCESSING'].includes(String(data?.status ?? data?.code ?? '').toUpperCase())) {
            toast.info('Documento aún no disponible.');
            return;
          }
          const message = typeof parsed?.message === 'string'
            ? parsed.message
            : (data?.message || data?.error || '');
          if (message && !data?.file_url && !data?.download_url) {
            toast.info(String(message));
            return;
          }
        } catch { /* respuesta de archivo */ }
        this.saveDocument(blob, filename);
      });
      return;
    }
    this.saveDocument(blob, filename);
  }

  private saveDocument(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const popup = window.open(url, '_blank');
    if (!popup) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
    }
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
  }

  get sriStatus(): string {
    const st = String(this.invoice?.status || this.invoice?.sri?.status || '').trim().toUpperCase();
    if (st === 'AUTHORIZED' || st === 'AUTORIZADA' || st === 'AUTORIZADO') return 'Autorizada';
    if (st === 'PROCESSING' || st === 'EMITIDA' || st === 'PENDING' || this.providerCode === '70' || this.hasAccessKeyRegistered) return 'Procesando';
    if (st === 'NOT_AUTHORIZED' || st === 'REJECTED' || st === 'RECHAZADA' || st === 'RECHAZADO') return 'Rechazada';
    if (st === 'ERROR') return 'Error';
    return st || '—';
  }

  get statusBadge(): string {
    const st = String(this.invoice?.status || this.invoice?.sri?.status || '').trim().toUpperCase();
    if (st === 'AUTHORIZED' || st === 'AUTORIZADA' || st === 'AUTORIZADO') return 'badge-green';
    if (st === 'REJECTED' || st === 'RECHAZADA' || st === 'RECHAZADO' || st === 'NOT_AUTHORIZED' || st === 'ERROR') return 'badge-red';
    return 'badge-yellow';
  }

  get providerStatus(): string {
    return String(this.invoice?.sri?.provider_status || this.invoice?.provider_status || this.invoice?.electronic?.provider_status || '').trim() || '—';
  }

  get providerCode(): string {
    return String(this.invoice?.sri?.sri_code || this.invoice?.sri?.status_code || this.invoice?.electronic?.sri_code || this.invoice?.electronic?.codigo_sri || this.invoice?.sri_code || this.invoice?.codigo_sri || this.invoice?.status_code || '').trim().toUpperCase();
  }

  get hasAccessKeyRegistered(): boolean {
    return this.providerCode === '43' || this.sriMessage.toUpperCase().includes('CLAVE ACCESO REGISTRADA');
  }

  get canConsultAuthorization(): boolean {
    const status = String(this.invoice?.status || this.invoice?.sri?.status || '').trim().toUpperCase();
    return this.capabilities.isLiteMode && !this.isAuthorized && !this.documentLoading && !this.actionLoading &&
      (this.providerCode === '70' || this.providerCode === '43' || this.hasAccessKeyRegistered ||
        ['PROCESSING', 'RECEIVED', 'PENDING'].includes(this.providerStatus) || status === 'EMITIDA');
  }

  get isAuthorizationPending(): boolean {
    const status = String(this.invoice?.status || this.invoice?.sri?.status || '').trim().toUpperCase();
    return this.providerCode === '70' || this.providerCode === '43' || this.hasAccessKeyRegistered ||
      ['PROCESSING', 'RECEIVED', 'PENDING'].includes(this.providerStatus) || status === 'EMITIDA';
  }

  get canRetry(): boolean {
    if (!this.capabilities.isLiteMode || this.isAuthorized || this.actionLoading || this.documentLoading || this.hasAccessKeyRegistered || this.isAuthorizationPending) return false;
    const status = String(this.invoice?.status || this.invoice?.sri?.status || '').trim().toUpperCase();
    const code = this.providerCode;
    return ['ERROR', 'ERROR DE ENVIO', 'ERROR DE ENVÍO'].includes(status)
      || ['ERROR', 'FAILED', 'SRI_CONNECTION_RESET', 'SRI_TIMEOUT', 'SRI_PIPE', 'SRI_CONNECTION_REFUSED', 'PROVIDER_HTTP_ERROR'].includes(code);
  }

  get canReissue(): boolean {
    if (!this.capabilities.isLiteMode || this.actionLoading || this.documentLoading || this.hasAccessKeyRegistered || this.isAuthorizationPending) return false;
    const status = String(this.invoice?.status || this.invoice?.sri?.status || '').trim().toUpperCase();
    return ['RECHAZADA', 'RECHAZADO', 'REJECTED', 'ERROR DE ENVIO', 'ERROR DE ENVÍO', 'ERROR'].includes(status);
  }

  retryEmission(): void {
    const name = this.invoice?.name;
    if (!name || !this.canRetry) return;
    this.actionLoading = true;
    this.liteInvoicesSvc.retryLiteInvoice(name).pipe(finalize(() => { this.actionLoading = false; })).subscribe({
      next: (response: any) => {
        this.applyEmissionData(response);
        const state = String(response?.state || '').toUpperCase();
        const message = response?.messages?.[0] || 'Reintento de emisión enviado.';
        if (['ERROR', 'PROVIDER_ERROR', 'REJECTED'].includes(state)) toast.error(message);
        else toast.success(message);
        this.fetch(name);
      },
      error: (error) => toast.error(this.backendError(error, 'No se pudo reintentar la emisión.'))
    });
  }

  reissueWithNewDate(): void {
    const name = this.invoice?.name;
    if (!name || !this.canReissue || this.actionLoading) return;
    const date = window.prompt('Fecha de emisión (YYYY-MM-DD), opcional:', this.reissueDate || new Date().toISOString().slice(0, 10));
    if (date === null) return;
    this.reissueDate = date.trim();
    this.actionLoading = true;
    this.liteInvoicesSvc.reissueLiteInvoice(name, this.reissueDate).pipe(finalize(() => { this.actionLoading = false; })).subscribe({
      next: (response: any) => {
        const newName = String(response?.invoiceName || response?.invoice_name || response?.data?.name || '').trim();
        toast.success(newName ? `Nueva nota generada: ${newName}` : 'Nueva nota de crédito generada.');
        this.router.navigate(['/dashboard/credit-note', newName || name]);
      },
      error: (error) => toast.error(this.backendError(error, 'No se pudo reemitir la nota.'))
    });
  }

  consultAuthorization(): void {
    const name = this.invoice?.name;
    if (!name || !this.canConsultAuthorization || this.documentLoading || this.actionLoading) return;
    this.actionLoading = true;
    this.documentLoading = true;
    this.liteInvoicesSvc.refreshLiteInvoiceStatus(name).pipe(
      finalize(() => { this.documentLoading = false; this.actionLoading = false; })
    ).subscribe({
      next: (response: any) => {
        this.applyEmissionData(response);
        const state = String(response?.state ?? '').toUpperCase();
        if (['ERROR', 'PROVIDER_ERROR', 'REJECTED'].includes(state)) {
          toast.error(String(response?.messages?.[0] || 'La consulta no fue aceptada por el proveedor.'));
          return;
        }
        toast.success(String(response?.messages?.[0] || 'Estado SRI actualizado.'));
        this.fetch(name);
      },
      error: (error) => toast.error(this.backendError(error, 'No se pudo consultar la autorización.'))
    });
  }

  get sriMessage(): string {
    const values = [
      this.invoice?.sri?.sri_message,
      this.invoice?.sri_message,
      this.invoice?.electronic?.sri_message,
      this.invoice?.sri?.messages,
      this.invoice?.messages,
      this.invoice?.electronic?.messages,
      this.invoice?.emission_error
    ].flatMap((value: any) => Array.isArray(value) ? value : [value])
      .map((value: any) => typeof value === 'object' ? (value?.message ?? value?.text ?? value?.detail ?? '') : value)
      .map((value: any) => String(value ?? '').trim())
      .filter(Boolean);
    return Array.from(new Set(values)).join(' | ');
  }

  /** Actualiza la vista con message.data/data antes de volver a consultar el detalle. */
  private applyEmissionData(response: any): void {
    const data = response?.data ?? response?.message?.data ?? response?.message ?? response?.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    const electronic = data.electronic ?? data.sri;
    this.invoice = {
      ...(this.invoice || {}),
      ...data,
      electronic: electronic ? { ...(this.invoice?.electronic || {}), ...electronic } : this.invoice?.electronic,
      sri: data.sri || electronic
        ? { ...(this.invoice?.sri || {}), ...(data.sri || {}), ...(electronic || {}) }
        : this.invoice?.sri
    };
  }

  get emissionError(): string {
    return String(this.invoice?.sri?.emission_error || this.invoice?.electronic?.emission_error || this.invoice?.emission_error || '').trim();
  }

  get accessKey(): string {
    return String(this.invoice?.sri?.access_key || this.invoice?.electronic?.access_key || this.invoice?.access_key || '').trim();
  }

  async copyAccessKey(): Promise<void> {
    await this.copyKey(this.accessKey, 'Clave de acceso');
  }

  async copyRelatedAccessKey(): Promise<void> {
    await this.copyKey(this.relatedAccessKey, 'Clave relacionada');
  }

  private async copyKey(value: string, label: string): Promise<void> {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiada.`);
    } catch {
      toast.error(`No se pudo copiar la ${label.toLowerCase()}.`);
    }
  }

  private backendError(error: any, fallback: string): string {
    const payload = error?.error ?? error;
    const direct = payload?.email?.error ?? payload?.message?.data?.email?.error ?? payload?.message;
    if (typeof direct === 'string' && direct.trim()) return direct.trim();
    const serverMessages = payload?._server_messages;
    if (typeof serverMessages === 'string') {
      try {
        const parsed = JSON.parse(serverMessages);
        const messages = (Array.isArray(parsed) ? parsed : [parsed]).map((entry: any) => {
          if (typeof entry !== 'string') return entry?.message ?? entry?.text ?? '';
          try { const value = JSON.parse(entry); return value?.message ?? value?.text ?? entry; } catch { return entry; }
        }).map((value: any) => String(value || '').trim()).filter(Boolean);
        if (messages.length) return Array.from(new Set(messages)).join(' | ');
      } catch { /* usar fallback */ }
    }
    return String(error?.message || fallback);
  }

  get authorizationNumber(): string {
    return String(this.invoice?.sri?.authorization_number || this.invoice?.electronic?.authorization_number || this.invoice?.authorization_number || '').trim();
  }

  get relatedInvoice(): string {
    return String(this.invoice?.related_invoice || this.invoice?.invoice_modified?.invoice_reference || '').trim();
  }

  get relatedDocumentNumber(): string {
    return String(this.invoice?.related_document_number || this.invoice?.invoice_modified?.secuencial_factura || '').trim();
  }

  get relatedAccessKey(): string {
    return String(this.invoice?.related_access_key || '').trim();
  }

  get creditNoteReason(): string {
    return String(this.invoice?.credit_note_reason || this.invoice?.motivo || this.invoice?.reason || this.invoice?.invoice_modified?.motivo || '').trim();
  }

  get emailInfo(): any {
    return this.invoice?.email && typeof this.invoice.email === 'object'
      ? this.invoice.email
      : { status: this.invoice?.email_status || 'No enviado', error: this.invoice?.email_error || '' };
  }
}
