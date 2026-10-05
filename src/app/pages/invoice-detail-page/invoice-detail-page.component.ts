import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { InvoicesService } from 'src/app/services/invoices.service';
import { environment } from 'src/environments/environment';
import { toast } from 'ngx-sonner';
import { PrintService } from 'src/app/services/print.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { finalize, lastValueFrom } from 'rxjs';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreditNoteService } from 'src/app/services/credit-note.service';
import { NgxSpinnerComponent, NgxSpinnerService } from 'ngx-spinner';
import { AdditionalFieldPayload, normalizeAdditionalFields } from 'src/app/core/models/additional-field';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { roundMoney } from 'src/app/shared/utils/payment.utils';
import { LiteEmissionState, liteEmissionMessages, liteEmissionState } from 'src/app/core/utils/lite-invoice-emission';
import { canConsultLiteInvoice, canRetryLiteInvoice } from 'src/app/core/utils/lite-invoice-actions';
import { PaymentsService } from 'src/app/services/payments.service';
import { InvoiceCollectionsService } from 'src/app/services/invoice-collections.service';
import { DecimalInputDirective } from 'src/app/shared/directives/decimal-input.directive';
import { ElectronicStatusPanelComponent } from 'src/app/shared/components/electronic-status-panel/electronic-status-panel.component';
import { electronicDocumentLabel } from 'src/app/core/utils/electronic-document';

@Component({
  selector: 'app-invoice-detail-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule, ReactiveFormsModule, NgxSpinnerComponent, DecimalInputDirective, ElectronicStatusPanelComponent],
  templateUrl: './invoice-detail-page.component.html',
  styleUrl: './invoice-detail-page.component.css'
})
export class InvoiceDetailPageComponent implements OnInit {
  activeDetailTab: 'general' | 'electronic' | 'collections' = 'general';
  invoice: any = null;
  additionalFields: AdditionalFieldPayload[] = [];
  motivosAnulacion: string[] = [
    'Devolución de mercadería o servicio',
    'Error en los datos del cliente',
    'Error en precio o cantidad',
    'Factura emitida por duplicado',
    'Solicitud del cliente',
    'Otro'
  ];
  showMotivoModal = false;
  liteActionRunning = false;
  emailActionRunning = false;
  documentActionRunning = false;
  motivoForm: FormGroup;
  collectionForm: FormGroup;
  collections: any[] = [];
  collectionSummary: any = {};
  paymentMethods: any[] = [];
  loadingCollections = false;
  savingCollection = false;

  private baseUrl = environment.URL;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private invoicesSvc: InvoicesService,
    private printSvc: PrintService,
    private fb: FormBuilder,
    private creditNoteSvc: CreditNoteService,
    private spinner: NgxSpinnerService,
    private paymentsSvc: PaymentsService,
    private collectionsSvc: InvoiceCollectionsService,
    public capabilities: CompanyCapabilitiesService,
  ) {
    this.motivoForm = this.fb.group({
      // El backend Lite asigna el motivo predeterminado cuando llega vacío.
      motivo: [''],
      otroTexto: [''] // se valida dinámicamente si elige "Otro"
    });
    this.collectionForm = this.fb.group({
      payment_method: ['', Validators.required],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      reference: [''],
      notes: ['']
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.fetch(id);
  }

  fetch(id: string) {
    this.spinner.show();
    this.invoicesSvc.getInvoiceDetail(id).subscribe({
      next: (res: any) => {
        console.log('response invoice detail', res);
        this.invoice = res?.data && typeof res.data === 'object' && !Array.isArray(res.data)
          ? res.data
          : (res?.message?.data || (res?.message && typeof res.message === 'object' && !Array.isArray(res.message) && (res.message.name || res.message.invoice_name) ? res.message : res));
        if (this.invoice && !Array.isArray(this.invoice.payments)) {
          this.invoice.payments = res?.message?.payments || res?.message?.doc?.payments || res?.payments || [];
        }
        this.additionalFields = normalizeAdditionalFields(
          this.invoice?.additionalFields ??
          this.invoice?.additional_fields ??
          res?.message?.additionalFields ??
          res?.message?.additional_fields
        );
        this.loadPaymentMethods();
        this.loadCollections();
        this.spinner.hide();
      },
      error: (err) => {
this.spinner.hide();
        toast.error(this.getActionError(err));
      }
    });
  }

  goBack() {
    if (history.length > 2) history.back();
    else this.router.navigate(['/dashboard/invoices']);
  }

  get collectionStatus(): string {
    return String(this.collectionSummary?.collection_status ?? this.invoice?.collection_status ?? 'Pendiente');
  }

  get totalCollected(): number {
    return Number(this.collectionSummary?.total_collected ?? this.invoice?.totals?.total_collected ?? this.invoice?.total_collected ?? 0) || 0;
  }

  get outstandingAmount(): number {
    const declared = this.collectionSummary?.outstanding_amount ?? this.invoice?.totals?.outstanding_amount ?? this.invoice?.outstanding_amount;
    if (declared !== undefined && declared !== null && declared !== '') return Number(declared) || 0;
    return Math.max(0, roundMoney((this.invoice?.totals?.grand_total ?? this.invoice?.total ?? 0) - this.totalCollected));
  }

  get lastCollectionAt(): string | null {
    return this.collectionSummary?.last_collection_at ?? this.invoice?.last_collection_at ?? null;
  }

  get canManageCollections(): boolean {
    return this.capabilities.hasPermission('*')
      || this.capabilities.hasPermission('billing.manage')
      || this.capabilities.hasPermission('billing.create');
  }

  selectDetailTab(tab: 'general' | 'electronic' | 'collections'): void {
    this.activeDetailTab = tab;
    if (tab === 'collections') this.loadCollections();
  }

  loadCollections(): void {
    const name = String(this.invoice?.name || '').trim();
    if (!name || this.loadingCollections) return;
    this.loadingCollections = true;
    this.collectionsSvc.getCollections(name).pipe(finalize(() => this.loadingCollections = false)).subscribe({
      next: (response: any) => {
        const message = response?.message ?? response ?? {};
        this.collections = Array.isArray(message?.data) ? message.data : [];
        this.collectionSummary = message?.summary || {};
        this.invoice = {
          ...this.invoice,
          collection_status: this.collectionSummary?.collection_status ?? this.invoice?.collection_status,
          totals: { ...(this.invoice?.totals || {}), ...this.collectionSummary }
        };
      },
      error: (error: any) => toast.error(this.collectionError(error))
    });
  }

  registerCollection(): void {
    if (!this.canManageCollections) { toast.error('No tienes permiso para registrar abonos.'); return; }
    if (this.collectionForm.invalid) { this.collectionForm.markAllAsTouched(); return; }
    const amount = roundMoney(this.collectionForm.get('amount')?.value);
    if (amount > this.outstandingAmount) { toast.error('El abono no puede ser mayor al saldo pendiente.'); return; }
    const methodValue = String(this.collectionForm.get('payment_method')?.value || '').trim();
    const method = this.paymentMethods.find((item: any) => String(item?.name || item?.codigo || '') === methodValue);
    if (!method) { toast.error('Selecciona un método de pago válido.'); return; }
    const code = String(method?.codigo || method?.payment_code || method?.forma_pago || '').trim();
    const submit = () => {
      this.savingCollection = true;
      this.collectionsSvc.createCollection({
        invoice: String(this.invoice?.name || '').trim(),
        payment_method: String(method?.name || methodValue),
        payment_code: code,
        amount,
        reference: String(this.collectionForm.get('reference')?.value || '').trim(),
        notes: String(this.collectionForm.get('notes')?.value || '').trim()
      }).pipe(finalize(() => this.savingCollection = false)).subscribe({
        next: () => {
          toast.success('Abono registrado correctamente.');
          this.collectionForm.reset({ payment_method: '', amount: 0, reference: '', notes: '' });
          this.loadCollections();
          this.fetch(String(this.invoice?.name || ''));
        },
        error: (error: any) => toast.error(this.collectionError(error))
      });
    };
    // El efectivo requiere caja abierta; los demás medios se asocian a ella
    // si existe, decisión que el backend conserva para el cierre.
    if (code === '01') {
      this.collectionsSvc.getCurrentCashOpening().subscribe({ next: () => submit(), error: (error: any) => toast.error(this.collectionError(error) || 'Debe abrir caja antes de registrar un abono en efectivo.') });
    } else {
      submit();
    }
  }

  canCancelCollection(collection: any): boolean {
    const status = String(collection?.status ?? collection?.estado ?? '').toLowerCase();
    const cashOpening = collection?.cash_opening ?? collection?.apertura ?? collection?.opening;
    const cashStatus = String(
      collection?.cash_opening_status
      ?? collection?.apertura_estado
      ?? (typeof cashOpening === 'object' ? (cashOpening?.status ?? cashOpening?.estado) : '')
      ?? ''
    ).toLowerCase();
    const belongsToCashOpening = Boolean(cashOpening) || String(collection?.payment_code || '').trim() === '01';
    // Si el abono está ligado a caja, solo exponemos anulación cuando el
    // backend devolvió explícitamente una apertura todavía abierta. Ante
    // información incompleta se bloquea preventivamente y el backend sigue
    // validando la operación.
    const cashCanBeCancelled = !belongsToCashOpening || Boolean(cashStatus) && !cashStatus.includes('cerrad') && !cashStatus.includes('closed');
    return this.canManageCollections && !status.includes('anulad') && !status.includes('cancel') && cashCanBeCancelled;
  }

  cancelCollection(collection: any): void {
    if (!this.canCancelCollection(collection)) return;
    const reason = window.prompt('Motivo de anulación del abono:');
    if (!reason?.trim()) return;
    this.collectionsSvc.cancelCollection(String(collection?.name || ''), reason).subscribe({
      next: () => { toast.success('Abono anulado.'); this.loadCollections(); this.fetch(String(this.invoice?.name || '')); },
      error: (error: any) => toast.error(this.collectionError(error))
    });
  }

  private loadPaymentMethods(): void {
    if (this.paymentMethods.length) return;
    this.paymentsSvc.getAll().subscribe({
      next: (rows: any[]) => this.paymentMethods = (rows || []).map((item: any) => ({ ...item, name: item?.name || item?.codigo, description: item?.description || item?.nombre || item?.name || item?.codigo })),
      error: () => toast.error('No se pudieron cargar los métodos de pago.')
    });
  }

  private collectionError(error: any): string {
    if (error?.status === 403) return 'No tienes permiso para administrar la cartera.';
    return String(error?.error?.message?.message || error?.error?.message || error?.message || 'No se pudo completar la operación de cartera.');
  }

  getFacturaPdf(): void {
    if (!this.capabilities.hasPermission('billing.read')) {
      toast.error('No tienes permisos para descargar documentos.');
      return;
    }
    const inv = this.invoice?.name || this.invoice?.sri?.invoice;
    if (!inv) {
      toast.error('Factura no disponible');
      return;
    }
    if (this.capabilities.isLiteMode && !this.isLiteAuthorized) {
      toast.info('El RIDE oficial estará disponible cuando la factura sea autorizada.');
      return;
    }
    if (this.capabilities.isLiteMode) {
      this.downloadLitePdf(inv, 'FACTURADA RIDE');
      return;
    }
    const w = window.open(this.baseUrl + this.printSvc.getFacturaPdf(inv), '_blank');
    if (!w) toast.error('No se pudo abrir la impresión');
  }

  getTicketPdf(): void {
    if (!this.capabilities.hasPermission('billing.read')) {
      toast.error('No tienes permisos para descargar documentos.');
      return;
    }
    const inv = this.invoice?.name || this.invoice?.sri?.invoice;
    if (!inv) return;
    if (this.capabilities.isLiteMode) {
      this.downloadLitePdf(inv, 'FacturADA Lite Ticket');
      return;
    }
    const w = window.open(this.baseUrl + this.printSvc.getFacturaPdf(inv), '_blank');
    if (!w) toast.error('No se pudo abrir la impresión');
  }

  private downloadLitePdf(
    invoiceName: string,
    format: 'FACTURADA RIDE' | 'FacturADA Lite Ticket'
  ): void {
    if (this.documentActionRunning) return;
    this.documentActionRunning = true;
    this.printSvc.downloadLiteInvoicePdf(invoiceName, format).pipe(
      finalize(() => { this.documentActionRunning = false; })
    ).subscribe({
      next: (blob) => this.openDownloadedBlob(blob, `${invoiceName}.pdf`),
      error: (error) => this.handleDownloadError(error, 'No se pudo descargar el documento Lite.')
    });
  }

  downloadLiteXml(): void {
    if (!this.capabilities.hasPermission('billing.read')) {
      toast.error('No tienes permisos para descargar documentos.');
      return;
    }
    const invoiceName = this.invoice?.name;
    if (!invoiceName || !this.isLiteAuthorized || this.documentActionRunning) {
      toast.info('El XML estará disponible cuando la factura sea autorizada.');
      return;
    }
    this.documentActionRunning = true;
    this.printSvc.downloadLiteInvoiceXml(invoiceName).pipe(
      finalize(() => { this.documentActionRunning = false; })
    ).subscribe({
      next: (blob) => this.openDownloadedBlob(blob, `${invoiceName}.xml`),
      error: (error) => this.handleDownloadError(error, 'No se pudo descargar el XML Lite.')
    });
  }

  private openDownloadedBlob(blob: Blob, filename: string): void {
    // El endpoint puede responder 200 con un objeto JSON {status: "PENDING"}
    // en lugar del archivo. Detectarlo evita abrir JSON como si fuera PDF/XML.
    if (blob.type.includes('json') || blob.type.includes('text')) {
      blob.text().then((text) => {
        try {
          const parsed = JSON.parse(text);
          const value = parsed?.message?.data ?? parsed?.message ?? parsed?.data ?? parsed;
          const status = String(value?.status ?? value?.code ?? '').toUpperCase();
          if (status === 'PENDING' || status === 'PROCESSING') {
            toast.info('Documento aún no disponible');
            return;
          }
        } catch { /* no era JSON; abrir como archivo */ }
        this.saveOrOpenBlob(blob, filename);
      });
      return;
    }
    this.saveOrOpenBlob(blob, filename);
  }

  private saveOrOpenBlob(blob: Blob, filename: string): void {
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

  private handleDownloadError(error: any, fallback: string): void {
    const payload = error?.error;
    if (payload instanceof Blob) {
      payload.text().then((text: string) => {
        try {
          const parsed = JSON.parse(text);
          const value = parsed?.message?.data ?? parsed?.message ?? parsed?.data ?? parsed;
          if (String(value?.status ?? value?.code ?? '').toUpperCase() === 'PENDING') {
            toast.info('Documento aún no disponible');
            return;
          }
        } catch { /* usar mensaje genérico */ }
        toast.error(fallback);
      });
      return;
    }
    toast.error(fallback);
  }

  reenviarFactura() {
    if (this.capabilities.isLiteMode) {
      this.consultarEstadoSri();
      return;
    }
    if (this.liteActionRunning || !this.canResend) {
      toast.info('Este documento no permite reenviar al SRI. Consulta su autorización o revisa el estado electrónico.');
      return;
    }
    const planBlockMessage = this.capabilities.getPlanBlockMessage('direct_invoice');
    if (planBlockMessage) {
      toast.error(planBlockMessage);
      return;
    }

    this.spinner.show();
    this.liteActionRunning = true;
    const request$ = this.capabilities.isLiteMode
      ? this.invoicesSvc.refreshLiteInvoiceStatus(this.invoice.name)
      : this.invoicesSvc.emit_existing_invoice_v2(this.invoice.name);

    request$.subscribe({
      next: (res: any) => {
        toast.success(this.capabilities.isLiteMode ? 'Estado actualizado' : 'Factura reenviada');
        const id = this.route.snapshot.paramMap.get('id')!;
        this.fetch(id);

        this.spinner.hide();
        this.liteActionRunning = false;
      },
      error: (err) => {
        this.spinner.hide();

        toast.error(this.getActionError(err));
        this.liteActionRunning = false;
      },
      complete: () => {
        this.spinner.hide();
        this.liteActionRunning = false;
      }
    });
  }

  /** Consulta el estado de una factura ya enviada; nunca vuelve a emitirla. */
  consultarEstadoSri(): void {
    const name = this.invoice?.name;
    if (!name) return;
    if (this.liteActionRunning) return;
    if (!this.canConsultAuthorization) {
      toast.info(this.isLiteAuthorized
        ? 'La factura ya está autorizada; no es necesario consultarla.'
        : 'La consulta solo está disponible para facturas Emitidas en proceso.');
      return;
    }

    const planBlockMessage = this.capabilities.getPlanBlockMessage('direct_invoice');
    if (planBlockMessage) {
      toast.error(planBlockMessage);
      return;
    }

    this.liteActionRunning = true;
    this.spinner.show();
    this.invoicesSvc.refreshLiteInvoiceStatus(name).pipe(
      finalize(() => { this.spinner.hide(); this.liteActionRunning = false; })
    ).subscribe({
      next: (res: any) => {
        this.applyLiteActionResponse(res);
        const messages = this.liteActionMessages(res);
        this.showLiteActionResult(res, messages, 'Estado SRI actualizado');
        this.fetch(name);
      },
      error: (err) => toast.error(this.getActionError(err))
    });
  }

  retryLiteInvoice(): void {
    const name = this.invoice?.name;
    if (!name) return;
    if (this.liteActionRunning) return;
    if (!this.canRetryLite) {
      toast.info(this.isLiteAuthorized
        ? 'La factura ya fue enviada o autorizada. Usa Consultar autorización para obtener su resultado.'
        : 'Esta factura no permite un reintento en su estado actual.');
      return;
    }
    this.liteActionRunning = true;
    this.spinner.show();
    this.invoicesSvc.retryLiteInvoice(name).pipe(finalize(() => { this.spinner.hide(); this.liteActionRunning = false; })).subscribe({
      next: (res: any) => {
        this.applyLiteActionResponse(res);
        const messages = this.liteActionMessages(res);
        this.showLiteActionResult(res, messages, 'Reintento de emisión enviado.');
        // Al reintentar una factura de un día anterior el backend puede crear
        // un reemplazo con fecha y clave de acceso nuevas. El nuevo documento
        // es el único que debemos volver a consultar.
        const newName = String(res?.invoiceName ?? res?.data?.name ?? '').trim();
        if (newName && newName !== name) {
          toast.info('La factura anterior fue reemplazada por una nueva emisión.');
          this.router.navigate(['/dashboard/invoices', newName]);
          return;
        }
        this.fetch(name);
      },
      error: (err) => toast.error(this.getActionError(err))
    });
  }

  // abrir/cerrar
  openMotivo() {
    this.showMotivoModal = true;
    // reset limpio cada vez que se abre
    this.motivoForm.reset({ motivo: '', otroTexto: '' });
  }
  closeMotivo() { this.showMotivoModal = false; }

  // si cambia selección, activa/desactiva validación del campo "otro"
  onMotivoChange() {
    const otroCtrl = this.motivoForm.get('otroTexto')!;
    if (this.motivoForm.value.motivo === 'Otro') {
      otroCtrl.addValidators([Validators.required, Validators.minLength(2)]);
    } else {
      otroCtrl.clearValidators();
      otroCtrl.setValue('');
    }
    otroCtrl.updateValueAndValidity({ emitEvent: false });
  }

  // Confirmar
  onConfirmMotivo() {
    if (this.motivoForm.invalid) {
      this.motivoForm.markAllAsTouched();
      return;
    }

    const { motivo, otroTexto } = this.motivoForm.value;
    // Úsalo como necesites en tu payload:
    const motivoSeleccionado = motivo === 'Otro' ? (otroTexto || '').trim() : motivo;
    this.anularFactura(motivoSeleccionado);

  }


  async anularFactura(motivo: string) {
    if (!this.canAnnul) {
      toast.error(this.annulBlockReason || 'No se puede crear la nota de crédito.');
      return;
    }

    const planBlockMessage = this.capabilities.getPlanBlockMessage('credit_note');
    if (planBlockMessage) {
      toast.error(planBlockMessage);
      return;
    }

    this.spinner.show();

    try {
      const response = await lastValueFrom(
        this.creditNoteSvc.emit_credit_note_v2(this.invoice.name, motivo)
      );

      const data = response?.message?.data ?? response?.message ?? response?.data ?? response;
      const createdName = String(
        data?.name ?? data?.invoice_name ?? data?.credit_note_name ?? data?.document_name
        ?? data?.invoice?.name ?? data?.credit_note?.name ?? data?.document?.name ?? ''
      ).trim();
      const emission = response?.message?.emission ?? response?.emission ?? data?.emission ?? {};
      const emissionStatus = String(emission?.status ?? emission?.code ?? '').trim().toUpperCase();
      const emissionMessages = liteEmissionMessages(emission);
      const emissionFailed = emission?.ok === false || ['ERROR', 'REJECTED', 'NOT_AUTHORIZED'].includes(emissionStatus);
      if (emissionFailed) {
        toast.error(emissionMessages[0] || 'La nota de crédito no fue autorizada.');
      } else {
        toast.success(createdName ? `Nota de crédito creada: ${createdName}` : 'Nota de crédito creada');
      }

      this.closeMotivo();
      if (createdName) {
        this.router.navigate(['/dashboard/credit-note', createdName]);
      } else {
        const id = this.route.snapshot.paramMap.get('id')!;
        this.fetch(id);
      }

    } catch (err: any) {
      toast.error(this.getActionError(err));
      this.closeMotivo();

    } finally {
      this.spinner.hide(); // siempre se ejecuta, éxito o error
    }
  }

  // Cerrar con ESC
  @HostListener('document:keydown.escape')
  onEsc() {
    if (this.showMotivoModal) this.closeMotivo();
  }

  get invoiceItems(): any[] {
    return Array.isArray(this.invoice?.items) ? this.invoice.items : [];
  }

  get invoiceNumber(): string {
    return this.invoice?.sri?.number || this.invoice?.name || '—';
  }

  get invoiceStatusRaw(): string {
    // Lite separa el estado del documento (status: "Emitida") del estado
    // reportado por el proveedor (sri.provider_status: "PROCESSING").
    // Priorizar el estado documental evita que PROCESSING oculte
    // accidentalmente la acción "Consultar autorización".
    const value = this.capabilities.isLiteMode
      ? (this.invoice?.status ?? this.invoice?.sri?.status)
      : (this.invoice?.sri?.status ?? this.invoice?.status);
    return String(value || '').trim().toUpperCase();
  }

  get liteState(): LiteEmissionState {
    return liteEmissionState({
      ...(this.invoice?.electronic ?? {}),
      status: this.invoiceStatusRaw,
      provider_status: this.liteProviderStatus,
      sri_code: this.liteProviderCode
    });
  }

  get isLiteAuthorized(): boolean { return this.liteState === 'AUTHORIZED'; }
  get facturaStatusLabel(): string {
    if (this.capabilities.isLiteMode) return electronicDocumentLabel(this.invoice);
    const value = this.invoiceStatusRaw;
    if (value === 'AUTORIZADO' || value === 'AUTORIZADA' || value === 'AUTHORIZED') return 'Autorizada';
    if (value === 'EMITIDA') return 'Emitida';
    if (value === 'PROCESSING' || value === 'PENDING' || value.includes('PENDIENTE')) return 'Pendiente';
    if (value.includes('RECHAZ')) return 'Rechazada';
    if (value.includes('ERROR')) return 'Error';
    return value || '—';
  }
  get liteProviderStatus(): string {
    return String(this.invoice?.sri?.provider_status || this.invoice?.provider_status || this.invoice?.electronic?.provider_status || '').trim().toUpperCase();
  }
  electronicDocumentUpdated(document: any): void {
    if (document.name !== this.invoice?.name) this.router.navigate(['/dashboard/invoices', document.name]);
    this.invoice = document;
    this.fetch(document.name);
  }
  get liteProviderCode(): string {
    return String(this.invoice?.sri?.sri_code || this.invoice?.sri?.status_code || this.invoice?.sri?.code ||
      this.invoice?.electronic?.sri_code || this.invoice?.electronic?.codigo_sri || this.invoice?.sri_code ||
      this.invoice?.sri_status_code || this.invoice?.status_code || this.invoice?.provider_status_code || '').trim().toUpperCase();
  }
  get hasAccessKeyRegistered(): boolean {
    return this.liteProviderCode === '43' || this.sriMessages.some((message) => message.toUpperCase().includes('CLAVE ACCESO REGISTRADA'));
  }
  get isAuthorizationPending(): boolean {
    return this.liteProviderCode === '70' || this.hasAccessKeyRegistered ||
      ['PROCESSING', 'RECEIVED', 'PENDING'].includes(this.liteProviderStatus) ||
      this.invoiceStatusRaw === 'EMITIDA';
  }
  get providerStatusLabel(): string {
    const status = this.liteProviderStatus;
    if (!status && this.liteProviderCode === '70') return 'Pendiente (SRI 70)';
    if (status === 'AUTHORIZED') return 'Autorizado';
    if (status === 'PROCESSING' || status === 'RECEIVED' || status === 'PENDING') return 'Procesando';
    if (status === 'REJECTED' || status === 'NOT_AUTHORIZED') return 'Rechazado';
    return status || '—';
  }
  get canConsultAuthorization(): boolean {
    return this.capabilities.isLiteMode && this.capabilities.hasPermission('billing.manage') && canConsultLiteInvoice(this.invoice);
  }
  get canRetryLite(): boolean {
    return this.capabilities.isLiteMode && this.capabilities.hasPermission('billing.manage') && canRetryLiteInvoice(this.invoice);
  }
  get canAnnul(): boolean {
    return !this.annulBlockReason;
  }

  get annulBlockReason(): string {
    if (!this.invoice) return 'Factura no disponible.';

    const authorized = ['AUTORIZADO', 'AUTORIZADA', 'AUTHORIZED', 'SRI_AUTHORIZED'].includes(this.invoiceStatusRaw) ||
      this.liteProviderStatus === 'AUTHORIZED';
    if (!authorized) return 'La factura debe estar autorizada para crear una nota de crédito.';

    const documentType = String(
      this.invoice?.document_type ?? this.invoice?.type ?? this.invoice?.tipo ?? ''
    ).trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (!documentType || !documentType.includes('FACTURA') || documentType.includes('NOTA')) {
      return 'Las notas de crédito solo se pueden crear desde una factura.';
    }

    const activeBusiness = String(this.capabilities.activeBusinessId || '').trim();
    const invoiceBusiness = String(
      this.invoice?.business ?? this.invoice?.business_id ?? this.invoice?.company ?? ''
    ).trim();
    if (this.capabilities.isLiteMode && (!activeBusiness || !invoiceBusiness || activeBusiness !== invoiceBusiness)) {
      return 'La factura no pertenece al negocio seleccionado.';
    }
    if (!this.capabilities.isEnabled('credit_note')) {
      return 'Las notas de crédito no están habilitadas para este negocio.';
    }

    // Crear una nota de crédito es una operación de emisión; `billing.manage`
    // solo permite consultar/reintentar estados, no crear documentos.
    const hasBillingPermission = this.capabilities.hasPermission('billing.create');
    if (this.capabilities.isLiteMode && !this.capabilities.permissions) {
      return 'No se pudieron cargar los permisos de facturación.';
    }
    if (!hasBillingPermission) return 'No tienes permiso para crear notas de crédito.';

    const pendingSetup = this.capabilities.liteSetupMissing;
    if (this.capabilities.isLiteMode && pendingSetup.some((item) => ['establishment', 'emission_point'].includes(String(item)))) {
      return 'Falta configurar el establecimiento o punto de emisión.';
    }

    const validation = this.capabilities.validateFeatureUse('credit_note');
    return validation.allowed ? '' : (validation.message || 'La nota de crédito no está disponible para este negocio.');
  }

  get canResend(): boolean {
    if (this.capabilities.isLiteMode) return false;
    return !!this.invoice
      && this.capabilities.hasPermission('billing.manage')
      && canRetryLiteInvoice(this.invoice)
      && this.capabilities.validateFeatureUse('direct_invoice').allowed;
  }

  get sriActionLabel(): string {
    return this.capabilities.isLiteMode ? 'Consultar autorización' : 'Reenviar al SRI';
  }

  get canSeeAdditionalFields(): boolean {
    return this.capabilities.isEnabled('additional_fields');
  }

  get invoicePayments(): any[] {
    const rawPayments =
      this.invoice?.payments ??
      this.invoice?.doc?.payments ??
      this.invoice?.sales_invoice?.payments ??
      [];

    if (!Array.isArray(rawPayments)) return [];

    return rawPayments
      .map((payment: any) => ({
        payment_method: String(
          payment?.payment_method ||
          payment?.formas_de_pago ||
          payment?.method ||
          payment?.name ||
          ''
        ).trim(),
        forma_pago: String(payment?.forma_pago || payment?.codigo || '').trim(),
        monto: roundMoney(payment?.monto ?? payment?.amount ?? payment?.paid_amount)
      }))
      .filter((payment: any) => payment.payment_method || payment.forma_pago || payment.monto > 0);
  }

  get sriMessages(): string[] {
    const raw = [
      this.invoice?.sri?.messages,
      this.invoice?.messages,
      this.invoice?.sri?.sri_message,
      this.invoice?.sri_message,
      this.invoice?.emission_error,
      this.invoice?.electronic?.sri_message
    ].filter((value) => value !== undefined && value !== null && value !== '');
    const values = raw.flatMap((value: any) => Array.isArray(value) ? value : [value]);
    return values.map((value: any) => typeof value === 'string' ? value : String(value?.message ?? value?.text ?? value ?? ''))
      .map((value: string) => value.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean);
  }

  get emailInfo(): { status: string; sent_at: string | null; error: string } {
    const source = this.invoice?.email && typeof this.invoice.email === 'object' ? this.invoice.email : {};
    return {
      status: String(source.status ?? this.invoice?.email_status ?? '').trim() || 'No enviado',
      sent_at: source.sent_at ?? this.invoice?.email_sent_at ?? null,
      error: String(source.error ?? this.invoice?.email_error ?? '').trim()
    };
  }

  get emailStatusLabel(): string {
    const status = this.emailInfo.status.toUpperCase();
    if (status === 'SENT' || status === 'ENVIADO') return 'Enviado';
    if (status === 'PENDING' || status === 'PENDIENTE') return 'Pendiente';
    if (status === 'SENDING' || status === 'ENVIANDO') return 'Enviando';
    if (status === 'ERROR' || status === 'FAILED') return 'Error';
    return 'No enviado';
  }

  get canSendEmail(): boolean {
    return this.capabilities.isLiteMode && this.isLiteAuthorized && this.capabilities.hasPermission('billing.manage');
  }

  sendLiteInvoiceEmail(): void {
    const invoiceName = this.invoice?.name;
    if (!invoiceName || !this.isLiteAuthorized || this.emailActionRunning) return;
    this.emailActionRunning = true;
    this.invoicesSvc.sendLiteInvoiceEmail(invoiceName).pipe(
      finalize(() => { this.emailActionRunning = false; })
    ).subscribe({
      next: (response: any) => {
        const data = response?.data ?? response?.message?.data ?? response?.message ?? {};
        const email = data?.email && typeof data.email === 'object' ? data.email : null;
        if (email) this.invoice = { ...this.invoice, email };
        if (email?.status === 'Error' || email?.error) {
          toast.error(String(email.error || 'No se pudo enviar la factura por correo.'));
        } else {
          toast.success('Solicitud de envío por correo procesada.');
        }
        this.fetch(invoiceName);
      },
      error: (error) => toast.error(this.getActionError(error))
    });
  }

  private applyLiteActionResponse(response: any): void {
    const data = response?.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;

    // Las acciones Lite devuelven la factura actual en message.data. Aplicar
    // primero esos datos permite reflejar el resultado de la operación sin
    // inventar estados; el fetch posterior completa los campos del detalle.
    const electronic = data?.electronic && typeof data.electronic === 'object' ? data.electronic : {};
    const currentSri = this.invoice?.sri && typeof this.invoice.sri === 'object' ? this.invoice.sri : {};
    this.invoice = {
      ...(this.invoice || {}),
      ...data,
      sri: {
        ...currentSri,
        ...(data?.sri && typeof data.sri === 'object' ? data.sri : {}),
        ...electronic,
        status: data?.status ?? data?.sri?.status ?? currentSri.status,
        provider_status: data?.provider_status ?? electronic?.provider_status ?? currentSri.provider_status,
        sri_message: data?.sri_message ?? electronic?.sri_message ?? currentSri.sri_message,
        emission_error: data?.emission_error ?? electronic?.emission_error ?? currentSri.emission_error
      },
      emission: response?.emission ?? data?.emission ?? this.invoice?.emission
    };
    this.additionalFields = normalizeAdditionalFields(this.invoice?.additionalFields ?? this.invoice?.additional_fields);
  }

  private liteActionMessages(response: any): string[] {
    const emission = response?.emission;
    const data = response?.data;
    return Array.from(new Set([
      ...liteEmissionMessages(emission),
      ...liteEmissionMessages(data)
    ].filter(Boolean)));
  }

  private showLiteActionResult(response: any, messages: string[], successMessage: string): void {
    const state = String(response?.state ?? '').toUpperCase();
    if (['ERROR', 'PROVIDER_ERROR', 'REJECTED'].includes(state)) {
      toast.error(messages[0] || 'La operación no fue aceptada por el proveedor.');
      return;
    }
    toast.success(messages[0] || successMessage);
  }

  itemSubtotal(item: any): number {
    const quantity = Number(item?.quantity ?? item?.qty ?? 0);
    const price = Number(item?.price ?? item?.rate ?? 0);
    return Number(item?.subtotal ?? item?.amount ?? (quantity * price));
  }

  itemTotal(item: any): number {
    const subtotal = this.itemSubtotal(item);
    const taxRate = Number(item?.tax_rate || 0);
    return Number(item?.total ?? item?.net_total ?? (subtotal + (subtotal * (taxRate / 100))));
  }

  get sriStatus(): string {
    if (this.capabilities.isLiteMode) return electronicDocumentLabel(this.invoice);
    if (this.capabilities.isLiteMode && (this.liteProviderCode === '70' || this.liteProviderCode === '43' || this.hasAccessKeyRegistered ||
      (this.invoiceStatusRaw === 'EMITIDA' && ['PROCESSING', 'RECEIVED', 'PENDING'].includes(this.liteProviderStatus)))) {
      return 'En proceso';
    }
    return this.getSriStatusLabel(this.invoiceStatusRaw);
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

  private getActionError(err: any): string {
    const emailError = err?.error?.email?.error ?? err?.error?.message?.data?.email?.error ?? err?.error?.data?.email?.error;
    if (emailError) return String(emailError);
    let serverText = '';
    const serverMessages = err?.error?._server_messages;
    if (serverMessages) {
      try {
        const parsed = typeof serverMessages === 'string' ? JSON.parse(serverMessages) : serverMessages;
        const values = Array.isArray(parsed) ? parsed : [parsed];
        serverText = values.map((item: any) => {
          const value = typeof item === 'string' ? (() => { try { return JSON.parse(item); } catch { return item; } })() : item;
          return typeof value === 'string' ? value : value?.message || '';
        }).filter(Boolean).join(' | ');
      } catch { /* use the regular Frappe fields below */ }
    }
    const raw = serverText || (err?.error?.message ?? err?.error?._error_message ?? err?.message);
    const text = typeof raw === 'string' ? raw : '';
    if (text.toLowerCase().includes('solo se puede reenviar una factura con error')) {
      return 'La factura ya fue enviada o autorizada. Usa Consultar autorización para obtener su resultado.';
    }
    if (Array.isArray(raw)) {
      return raw.map((item: any) => typeof item === 'string' ? item : item?.message || item?.text || '').filter(Boolean).join(' | ');
    }
    if (raw && typeof raw === 'object') return String(raw.message || raw.text || raw.detail || 'No se pudo completar la acción.');
    return String(raw || 'No se pudo completar la acción.');
  }
}
