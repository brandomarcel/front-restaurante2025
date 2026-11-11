import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgxSpinnerComponent, NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { finalize } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { WithholdingsService } from 'src/app/services/withholdings.service';
import { PrintService } from 'src/app/services/print.service';
import { supplierIdentificationLabel } from 'src/app/services/lite-suppliers.service';
import { liteEmissionMessages } from 'src/app/core/utils/lite-invoice-emission';
import { canConsultLiteInvoice, canRetryLiteInvoice } from 'src/app/core/utils/lite-invoice-actions';
import { electronicDocumentLabel } from 'src/app/core/utils/electronic-document';
import { ElectronicStatusPanelComponent } from 'src/app/shared/components/electronic-status-panel/electronic-status-panel.component';
import { ElectronicStatusBadgeComponent } from 'src/app/shared/components/electronic-status-badge/electronic-status-badge.component';
import { DocumentAction, DocumentActionsComponent } from 'src/app/shared/components/document-actions/document-actions.component';
import { SriAnnulmentSectionComponent } from 'src/app/shared/components/sri-annulment-section/sri-annulment-section.component';
import { WITHHOLDING_DAYS_LIMIT } from 'src/app/core/utils/withholding';

type DetailTab = 'general' | 'electronic';

/** Detalle de un comprobante de retención. Mismo formato y acciones que el detalle de la guía de remisión. */
@Component({
  selector: 'app-withholding-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule, NgxSpinnerComponent, ElectronicStatusPanelComponent, ElectronicStatusBadgeComponent, DocumentActionsComponent, SriAnnulmentSectionComponent],
  templateUrl: './withholding-detail.component.html'
})
export class WithholdingDetailComponent implements OnInit {
  withholding: any = null;
  actionRunning = false;
  loadFailed = false;
  activeDetailTab: DetailTab = 'general';
  readonly daysLimit = WITHHOLDING_DAYS_LIMIT;
  readonly identificationLabel = supplierIdentificationLabel;
  readonly detailTabs: { id: DetailTab; label: string }[] = [
    { id: 'general', label: 'Información general' },
    { id: 'electronic', label: 'Estado SRI' }
  ];
  private baseUrl = environment.URL;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private svc: WithholdingsService,
    private printSvc: PrintService,
    private spinner: NgxSpinnerService,
    private frappeError: FrappeErrorService,
    public capabilities: CompanyCapabilitiesService
  ) {}

  ngOnInit(): void {
    this.fetch(this.route.snapshot.paramMap.get('id')!);
  }

  /** `silent` refresca sin bloquear la pantalla (actualizaciones en tiempo real). */
  fetch(name: string, silent = false): void {
    if (!silent) this.spinner.show();
    this.loadFailed = false;
    this.svc.getDetail(name).pipe(finalize(() => { if (!silent) this.spinner.hide(); })).subscribe({
      next: (res: any) => { this.withholding = res; },
      error: (err) => {
        this.loadFailed = !this.withholding;
        toast.error(this.readError(err));
      }
    });
  }

  retryLoad(): void {
    this.fetch(this.route.snapshot.paramMap.get('id')!);
  }

  selectDetailTab(tab: DetailTab): void {
    this.activeDetailTab = tab;
  }

  goBack(): void {
    if (history.length > 2) history.back();
    else this.router.navigate(['/dashboard/withholdings']);
  }

  get supplier(): any { return this.withholding?.supplier || {}; }
  get support(): any { return this.withholding?.support || {}; }
  get supportTaxes(): any[] { return Array.isArray(this.support?.taxes) ? this.support.taxes : []; }
  get retentions(): any[] { return Array.isArray(this.withholding?.retentions) ? this.withholding.retentions : []; }
  get isLate(): boolean { return this.withholding?.late === true || this.withholding?.late === 1; }

  get documentNumber(): string {
    return String(this.withholding?.electronic?.document_number || this.withholding?.name || '—');
  }

  get providerStatus(): string { return String(this.withholding?.electronic?.provider_status || '').trim() || '—'; }
  get accessKey(): string { return String(this.withholding?.electronic?.access_key || '').trim(); }
  get authorizationNumber(): string { return String(this.withholding?.electronic?.authorization_number || '').trim(); }
  get authorizationDatetime(): string { return String(this.withholding?.electronic?.authorization_datetime || '').trim(); }
  get sriMessage(): string { return String(this.withholding?.electronic?.sri_message || '').trim(); }
  get emissionError(): string { return String(this.withholding?.electronic?.emission_error || '').trim(); }
  get emailStatus(): string { return String(this.withholding?.email?.status || '').trim(); }
  get emailError(): string { return String(this.withholding?.email?.error || '').trim(); }

  async copyAccessKey(): Promise<void> {
    if (!this.accessKey) return;
    try {
      await navigator.clipboard.writeText(this.accessKey);
      toast.success('Clave de acceso copiada.');
    } catch {
      toast.error('No se pudo copiar la clave de acceso.');
    }
  }

  get statusRaw(): string { return String(this.withholding?.status || '').trim().toUpperCase(); }
  get statusLabel(): string { return electronicDocumentLabel(this.withholding); }
  get isDraft(): boolean { return ['BORRADOR', 'DRAFT'].includes(this.statusRaw); }
  get isAuthorized(): boolean { return ['AUTORIZADA', 'AUTORIZADO'].includes(this.statusRaw); }

  get canEdit(): boolean { return this.isDraft && this.capabilities.hasPermission('billing.create'); }
  get canEmitDraft(): boolean { return this.isDraft && this.capabilities.hasPermission('billing.create'); }
  get canConsult(): boolean { return this.capabilities.hasPermission('billing.manage') && canConsultLiteInvoice(this.withholding); }
  get canRetry(): boolean { return this.capabilities.hasPermission('billing.manage') && canRetryLiteInvoice(this.withholding); }

  /** Las reglas de visibilidad siguen en los getters `can*`; aquí solo se ordenan para la UI. */
  get documentActions(): DocumentAction[] {
    if (!this.withholding) return [];
    const actions: DocumentAction[] = [];
    if (this.canEmitDraft) {
      actions.push({ id: 'emit', label: 'Emitir', variant: 'primary', disabled: this.actionRunning, run: () => this.emitirBorrador() });
    }
    if (this.canEdit) {
      actions.push({ id: 'edit', label: 'Editar', variant: 'outline',
        run: () => this.router.navigate(['/dashboard/withholdings', this.withholding?.name, 'edit']) });
    }
    if (this.canConsult) {
      actions.push({ id: 'consult', label: 'Consultar autorización', shortLabel: 'Consultar SRI',
        title: 'Consulta el resultado en el SRI sin volver a emitir', variant: 'warn',
        disabled: this.actionRunning, run: () => this.consultarAutorizacion() });
    }
    if (this.canRetry) {
      actions.push({ id: 'retry', label: 'Reintentar', variant: 'warn', disabled: this.actionRunning, run: () => this.reintentar() });
    }
    if (this.isAuthorized) {
      actions.push({ id: 'pdf', label: 'Descargar PDF', shortLabel: 'PDF', variant: 'primary', icon: ['fas', 'download'],
        run: () => this.downloadPdf() });
      actions.push({ id: 'xml', label: 'XML', title: 'Descargar XML autorizado', variant: 'outline', run: () => this.downloadXml() });
    }
    return actions;
  }

  emitirBorrador(): void {
    const name = this.withholding?.name;
    if (!name || this.actionRunning) return;
    const blockMessage = this.capabilities.getEmissionBlockMessage({ feature: 'billing' });
    if (blockMessage) {
      toast.error(blockMessage);
      return;
    }
    this.actionRunning = true;
    this.spinner.show();
    this.svc.emitDraft(name).pipe(finalize(() => { this.spinner.hide(); this.actionRunning = false; })).subscribe({
      next: (res: any) => this.applyActionResult(res, 'Retención emitida.'),
      error: (err) => toast.error(this.readError(err))
    });
  }

  consultarAutorizacion(): void {
    const name = this.withholding?.name;
    if (!name || this.actionRunning || !this.canConsult) return;
    this.actionRunning = true;
    this.spinner.show();
    this.svc.refreshStatus(name).pipe(finalize(() => { this.spinner.hide(); this.actionRunning = false; })).subscribe({
      next: (res: any) => this.applyActionResult(res, 'Estado SRI actualizado.'),
      error: (err) => toast.error(this.readError(err))
    });
  }

  reintentar(): void {
    const name = this.withholding?.name;
    if (!name || this.actionRunning || !this.canRetry) return;
    const blockMessage = this.capabilities.getEmissionBlockMessage({ feature: 'billing', permission: 'billing.manage' });
    if (blockMessage) {
      toast.error(blockMessage);
      return;
    }
    if (!confirm('¿Reintentar el envío de esta retención al SRI?')) return;
    this.actionRunning = true;
    this.spinner.show();
    this.svc.retry(name).pipe(finalize(() => { this.spinner.hide(); this.actionRunning = false; })).subscribe({
      next: (res: any) => this.applyActionResult(res, 'Reintento de emisión enviado.'),
      error: (err) => toast.error(this.readError(err))
    });
  }

  private applyActionResult(res: any, successMessage: string): void {
    if (res?.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
      this.withholding = { ...(this.withholding || {}), ...res.data };
    }
    const messages = [...liteEmissionMessages(res?.emission), ...liteEmissionMessages(res?.data)].filter(Boolean);
    const state = String(res?.state || '').toUpperCase();
    if (['ERROR', 'PROVIDER_ERROR', 'REJECTED'].includes(state)) {
      toast.error(messages[0] || 'La operación no fue aceptada por el proveedor.');
    } else {
      toast.success(messages[0] || successMessage);
    }
    this.fetch(this.withholding?.name);
  }

  downloadPdf(): void {
    if (!this.capabilities.hasPermission('billing.read')) {
      toast.error('No tienes permisos para descargar documentos.');
      return;
    }
    if (!this.isAuthorized) {
      toast.info('El PDF estará disponible cuando la retención sea autorizada.');
      return;
    }
    const w = window.open(this.baseUrl + this.printSvc.getWithholdingPdf(this.withholding?.name), '_blank');
    if (!w) toast.error('No se pudo abrir la impresión.');
  }

  downloadXml(): void {
    if (!this.capabilities.hasPermission('billing.read')) {
      toast.error('No tienes permisos para descargar documentos.');
      return;
    }
    if (!this.isAuthorized) {
      toast.info('El XML estará disponible cuando la retención sea autorizada.');
      return;
    }
    const w = window.open(this.baseUrl + this.printSvc.getWithholdingXml(this.withholding?.name), '_blank');
    if (!w) toast.error('No se pudo abrir la descarga.');
  }

  private readError(err: any): string {
    return this.frappeError.handle(err) || 'No se pudo completar la acción.';
  }
}
