import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { InvoicesService } from 'src/app/services/invoices.service';
import { environment } from 'src/environments/environment';
import { toast } from 'ngx-sonner';
import { PrintService } from 'src/app/services/print.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { finalize } from 'rxjs';
import { canConsultLiteInvoice, canRetryLiteInvoice } from 'src/app/core/utils/lite-invoice-actions';
import { ElectronicStatusPanelComponent } from 'src/app/shared/components/electronic-status-panel/electronic-status-panel.component';
import { electronicDocumentLabel } from 'src/app/core/utils/electronic-document';
import { ElectronicStatusBadgeComponent } from 'src/app/shared/components/electronic-status-badge/electronic-status-badge.component';
import { DocumentAction, DocumentActionsComponent } from 'src/app/shared/components/document-actions/document-actions.component';

type DetailTab = 'general' | 'electronic';

@Component({
  selector: 'app-credit-note-detail-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule, ElectronicStatusPanelComponent, ElectronicStatusBadgeComponent, DocumentActionsComponent],
  templateUrl: './credit-note-detail-page.component.html'
})
export class CreditNoteDetailPageComponent implements OnInit {
  activeDetailTab: DetailTab = 'general';
  readonly detailTabs: { id: DetailTab; label: string }[] = [
    { id: 'general', label: 'Información general' },
    { id: 'electronic', label: 'Estado SRI' }
  ];
  invoice: any = null;
  loading = true;
  error = '';
  documentLoading = false;
  emailLoading = false;
  actionLoading = false;

  private baseUrl = environment.URL;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private liteInvoicesSvc: InvoicesService,
    private printSvc: PrintService,
    public capabilities: CompanyCapabilitiesService,
  ) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.fetch(id);
  }

  fetch(id: string): void {
    this.invoice = null;
    this.error = '';
    const name = String(id ?? '').trim();
    if (!name) {
      this.loading = false;
      this.error = 'Nota de crédito no encontrada';
      return;
    }

    this.loading = true;
    // The service already unwraps response.message.data and normalizes the document.
    this.liteInvoicesSvc.getLiteCreditNoteDetail(name)
      .pipe(finalize(() => { this.loading = false; }))
      .subscribe({
        next: (document: any) => {
          this.invoice = document?.name ? document : null;
          if (!this.invoice) this.error = 'Nota de crédito no encontrada';
        },
        error: (err) => {
          this.error = err?.status === 403
            ? 'No tienes permiso para consultar esta nota de crédito.'
            : this.backendError(err, 'No se pudo cargar la nota de crédito');
        }
      });
  }

  goBack() {
    if (history.length > 2) history.back();
    else this.router.navigate(['/dashboard/credit-notes']);
  }

  getFacturaPdf(): void {
    if (!this.capabilities.hasPermission('billing.read')) {
      toast.error('No tienes permisos para descargar documentos.');
      return;
    }
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
    if (!this.capabilities.hasPermission('billing.read')) {
      toast.error('No tienes permisos para descargar documentos.');
      return;
    }
    const inv = this.invoice?.name;
    if (!inv || !this.isAuthorized || this.documentLoading) return;
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
    if (!this.capabilities.hasPermission('billing.manage')) {
      toast.error('No tienes permisos para enviar documentos por correo.');
      return;
    }
    if (!name || !this.isAuthorized || this.emailLoading) return;
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
    return electronicDocumentLabel(this.invoice);
  }

  selectDetailTab(tab: DetailTab): void {
    this.activeDetailTab = tab;
  }

  retryLoad(): void {
    this.fetch(this.route.snapshot.paramMap.get('id')!);
  }

  get providerStatus(): string {
    return String(this.invoice?.sri?.provider_status || this.invoice?.provider_status || this.invoice?.electronic?.provider_status || '').trim() || '—';
  }

  get providerCode(): string {
    return String(this.invoice?.sri?.sri_code || this.invoice?.sri?.status_code || this.invoice?.electronic?.sri_code || this.invoice?.electronic?.codigo_sri || this.invoice?.sri_code || this.invoice?.codigo_sri || this.invoice?.status_code || '').trim().toUpperCase();
  }

  get canConsultAuthorization(): boolean {
    return !!this.invoice && !this.loading &&
      this.capabilities.hasPermission('billing.manage') && canConsultLiteInvoice(this.invoice);
  }

  get isAuthorizationPending(): boolean {
    return canConsultLiteInvoice(this.invoice);
  }

  get canRetry(): boolean {
    return !!this.invoice && !this.loading &&
      this.capabilities.hasPermission('billing.manage') && canRetryLiteInvoice(this.invoice);
  }

  /** Las reglas de visibilidad siguen en los getters `can*`; aquí solo se ordenan para la UI. */
  get documentActions(): DocumentAction[] {
    if (!this.invoice || this.loading) return [];
    const actions: DocumentAction[] = [];
    if (this.canConsultAuthorization) {
      actions.push({ id: 'consult', label: this.actionLoading ? 'Consultando…' : 'Consultar autorización',
        shortLabel: 'Consultar SRI', title: 'Consulta el resultado en el SRI sin volver a emitir', variant: 'warn',
        disabled: this.documentLoading, run: () => this.consultAuthorization() });
    }
    if (this.canRetry) {
      actions.push({ id: 'retry', label: this.actionLoading ? 'Procesando…' : 'Reintentar envío', shortLabel: 'Reintentar',
        variant: 'warn', disabled: this.actionLoading, run: () => this.retryEmission() });
    }
    if (this.capabilities.hasPermission('billing.read')) {
      actions.push({ id: 'pdf', label: 'Descargar PDF', shortLabel: 'PDF', title: 'Descargar nota de crédito',
        variant: 'primary', icon: ['fas', 'download'], disabled: this.documentLoading, run: () => this.getFacturaPdf() });
    }
    if (this.isAuthorized && this.capabilities.hasPermission('billing.read')) {
      actions.push({ id: 'xml', label: 'XML', title: 'Descargar XML autorizado', variant: 'outline',
        disabled: this.documentLoading, run: () => this.downloadXml() });
    }
    if (this.isAuthorized && this.capabilities.hasPermission('billing.manage')) {
      actions.push({ id: 'email', label: this.emailLoading ? 'Enviando…' : 'Enviar por correo',
        shortLabel: this.emailLoading ? 'Enviando…' : 'Correo', title: 'Enviar la nota al correo del cliente',
        variant: 'outline', disabled: this.emailLoading, run: () => this.sendEmail() });
    }
    return actions;
  }

  get documentNumber(): string {
    return this.invoice?.document_number || this.invoice?.sri?.number || this.invoice?.name || '—';
  }

  get items(): any[] {
    return Array.isArray(this.invoice?.items) ? this.invoice.items : [];
  }

  itemSubtotal(item: any): number {
    return Number(item?.subtotal ?? (Number(item?.quantity ?? 0) * Number(item?.price ?? 0))) || 0;
  }

  itemTotal(item: any): number {
    const subtotal = this.itemSubtotal(item);
    return Number(item?.total ?? (subtotal + subtotal * (Number(item?.tax_rate ?? 0) / 100))) || 0;
  }

  itemDiscount(item: any): number {
    return Number(item?.discount_amount ?? item?.total_discount ?? 0) || 0;
  }

  electronicDocumentUpdated(document: any): void {
    if (document.name !== this.invoice?.name) this.router.navigate(['/dashboard/credit-note', document.name]);
    this.invoice = document;
    this.fetch(document.name);
  }

  retryEmission(): void {
    const name = this.invoice?.name;
    if (!name || !this.canRetry || this.actionLoading || this.documentLoading) return;
    this.actionLoading = true;
    this.liteInvoicesSvc.retryLiteInvoice(name).pipe(finalize(() => { this.actionLoading = false; })).subscribe({
      next: (response: any) => {
        this.applyEmissionData(response);
        const state = String(response?.state || '').toUpperCase();
        const message = response?.messages?.[0] || 'Reintento de emisión enviado.';
        if (['ERROR', 'PROVIDER_ERROR', 'REJECTED'].includes(state)) toast.error(message);
        else toast.success(message);
        const replacementName = String(response?.invoiceName ?? response?.data?.name ?? '').trim();
        if (replacementName && replacementName !== name) {
          toast.info('La nota original fue reemplazada por una nueva emisión.');
          this.router.navigate(['/dashboard/credit-note', replacementName]);
          return;
        }
        this.fetch(name);
      },
      error: (error) => toast.error(this.backendError(error, 'No se pudo reintentar la emisión.'))
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
        : this.invoice?.sri,
      emission: response?.emission ?? data?.emission ?? this.invoice?.emission
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
