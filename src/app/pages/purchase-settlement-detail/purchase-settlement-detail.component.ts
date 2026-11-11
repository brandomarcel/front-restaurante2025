import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgxSpinnerComponent, NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { catchError, finalize, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { PurchaseSettlementsService } from 'src/app/services/purchase-settlements.service';
import { PrintService } from 'src/app/services/print.service';
import { supplierIdentificationLabel } from 'src/app/services/lite-suppliers.service';
import { liteEmissionMessages } from 'src/app/core/utils/lite-invoice-emission';
import { canConsultLiteInvoice, canRetryLiteInvoice } from 'src/app/core/utils/lite-invoice-actions';
import { electronicDocumentLabel } from 'src/app/core/utils/electronic-document';
import { ElectronicStatusPanelComponent } from 'src/app/shared/components/electronic-status-panel/electronic-status-panel.component';
import { ElectronicStatusBadgeComponent } from 'src/app/shared/components/electronic-status-badge/electronic-status-badge.component';
import { DocumentAction, DocumentActionsComponent } from 'src/app/shared/components/document-actions/document-actions.component';
import { SriAnnulmentSectionComponent } from 'src/app/shared/components/sri-annulment-section/sri-annulment-section.component';

type DetailTab = 'general' | 'electronic';

/** Detalle de una liquidación de compra. Mismo formato y acciones que el detalle de la retención. */
@Component({
  selector: 'app-purchase-settlement-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule, NgxSpinnerComponent, ElectronicStatusPanelComponent, ElectronicStatusBadgeComponent, DocumentActionsComponent, SriAnnulmentSectionComponent],
  templateUrl: './purchase-settlement-detail.component.html'
})
export class PurchaseSettlementDetailComponent implements OnInit {
  settlement: any = null;
  actionRunning = false;
  loadFailed = false;
  activeDetailTab: DetailTab = 'general';
  /** Del setup: solo un agente de retención puede crear la retención sobre la liquidación. */
  withholdingAgent = false;
  readonly identificationLabel = supplierIdentificationLabel;
  readonly detailTabs: { id: DetailTab; label: string }[] = [
    { id: 'general', label: 'Información general' },
    { id: 'electronic', label: 'Estado SRI' }
  ];
  private baseUrl = environment.URL;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private svc: PurchaseSettlementsService,
    private printSvc: PrintService,
    private spinner: NgxSpinnerService,
    private frappeError: FrappeErrorService,
    public capabilities: CompanyCapabilitiesService
  ) {}

  ngOnInit(): void {
    this.fetch(this.route.snapshot.paramMap.get('id')!);
    // Sin setup no se ofrece «Crear retención»; no impide ver el detalle.
    this.svc.getSetup().pipe(catchError(() => of(null))).subscribe(setup => {
      this.withholdingAgent = setup?.withholding_agent === true || (setup?.withholding_agent as unknown) === 1;
    });
  }

  /** `silent` refresca sin bloquear la pantalla (actualizaciones en tiempo real). */
  fetch(name: string, silent = false): void {
    if (!silent) this.spinner.show();
    this.loadFailed = false;
    this.svc.getDetail(name).pipe(finalize(() => { if (!silent) this.spinner.hide(); })).subscribe({
      next: (res: any) => { this.settlement = res; },
      error: (err) => {
        this.loadFailed = !this.settlement;
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
    else this.router.navigate(['/dashboard/purchase-settlements']);
  }

  get supplier(): any { return this.settlement?.supplier || {}; }
  get items(): any[] { return Array.isArray(this.settlement?.items) ? this.settlement.items : []; }
  get taxes(): any[] { return Array.isArray(this.settlement?.taxes) ? this.settlement.taxes : []; }
  get withholding(): { name: string; document_number: string | null; status: string } | null {
    const value = this.settlement?.withholding;
    return value?.name ? value : null;
  }

  get documentNumber(): string {
    return String(this.settlement?.electronic?.document_number || this.settlement?.name || '—');
  }

  get providerStatus(): string { return String(this.settlement?.electronic?.provider_status || '').trim() || '—'; }
  get accessKey(): string { return String(this.settlement?.electronic?.access_key || '').trim(); }
  get authorizationNumber(): string { return String(this.settlement?.electronic?.authorization_number || '').trim(); }
  get authorizationDatetime(): string { return String(this.settlement?.electronic?.authorization_datetime || '').trim(); }
  get sriMessage(): string { return String(this.settlement?.electronic?.sri_message || '').trim(); }
  get emissionError(): string { return String(this.settlement?.electronic?.emission_error || '').trim(); }
  get emailStatus(): string { return String(this.settlement?.email?.status || '').trim(); }
  get emailError(): string { return String(this.settlement?.email?.error || '').trim(); }

  async copyAccessKey(): Promise<void> {
    if (!this.accessKey) return;
    try {
      await navigator.clipboard.writeText(this.accessKey);
      toast.success('Clave de acceso copiada.');
    } catch {
      toast.error('No se pudo copiar la clave de acceso.');
    }
  }

  get statusRaw(): string { return String(this.settlement?.status || '').trim().toUpperCase(); }
  get statusLabel(): string { return electronicDocumentLabel(this.settlement); }
  get isDraft(): boolean { return ['BORRADOR', 'DRAFT'].includes(this.statusRaw); }
  get isAuthorized(): boolean { return ['AUTORIZADA', 'AUTORIZADO'].includes(this.statusRaw); }

  get canEdit(): boolean { return this.isDraft && this.capabilities.hasPermission('billing.create'); }
  get canEmitDraft(): boolean { return this.isDraft && this.capabilities.hasPermission('billing.create'); }
  get canConsult(): boolean { return this.capabilities.hasPermission('billing.manage') && canConsultLiteInvoice(this.settlement); }
  get canRetry(): boolean { return this.capabilities.hasPermission('billing.manage') && canRetryLiteInvoice(this.settlement); }

  /** Autorizada, sin retención todavía y el negocio es agente de retención (el backend lo vuelve a exigir). */
  get canCreateWithholding(): boolean {
    return this.isAuthorized && this.withholdingAgent && !this.withholding && this.capabilities.hasPermission('billing.create');
  }

  /** Las reglas de visibilidad siguen en los getters `can*`; aquí solo se ordenan para la UI. */
  get documentActions(): DocumentAction[] {
    if (!this.settlement) return [];
    const actions: DocumentAction[] = [];
    if (this.canEmitDraft) {
      actions.push({ id: 'emit', label: 'Emitir', variant: 'primary', disabled: this.actionRunning, run: () => this.emitirBorrador() });
    }
    if (this.canEdit) {
      actions.push({ id: 'edit', label: 'Editar', variant: 'outline',
        run: () => this.router.navigate(['/dashboard/purchase-settlements', this.settlement?.name, 'edit']) });
    }
    if (this.canConsult) {
      actions.push({ id: 'consult', label: 'Consultar autorización', shortLabel: 'Consultar SRI',
        title: 'Consulta el resultado en el SRI sin volver a emitir', variant: 'warn',
        disabled: this.actionRunning, run: () => this.consultarAutorizacion() });
    }
    if (this.canRetry) {
      actions.push({ id: 'retry', label: 'Reintentar', variant: 'warn', disabled: this.actionRunning, run: () => this.reintentar() });
    }
    if (this.canCreateWithholding) {
      actions.push({ id: 'withholding', label: 'Crear retención', shortLabel: 'Retención', variant: 'outline',
        title: 'Retención sobre esta liquidación (100 % del IVA y renta)', run: () => this.crearRetencion() });
    }
    if (this.isAuthorized) {
      actions.push({ id: 'pdf', label: 'Descargar PDF', shortLabel: 'PDF', variant: 'primary', icon: ['fas', 'download'],
        run: () => this.downloadPdf() });
      actions.push({ id: 'xml', label: 'XML', title: 'Descargar XML autorizado', variant: 'outline', run: () => this.downloadXml() });
    }
    return actions;
  }

  crearRetencion(): void {
    const name = this.settlement?.name;
    if (!name) return;
    this.router.navigate(['/dashboard/withholdings/new'], { queryParams: { liquidacion: name } });
  }

  emitirBorrador(): void {
    const name = this.settlement?.name;
    if (!name || this.actionRunning) return;
    const blockMessage = this.capabilities.getEmissionBlockMessage({ feature: 'billing' });
    if (blockMessage) {
      toast.error(blockMessage);
      return;
    }
    this.actionRunning = true;
    this.spinner.show();
    this.svc.emitDraft(name).pipe(finalize(() => { this.spinner.hide(); this.actionRunning = false; })).subscribe({
      next: (res: any) => this.applyActionResult(res, 'Liquidación de compra emitida.'),
      error: (err) => toast.error(this.readError(err))
    });
  }

  consultarAutorizacion(): void {
    const name = this.settlement?.name;
    if (!name || this.actionRunning || !this.canConsult) return;
    this.actionRunning = true;
    this.spinner.show();
    this.svc.refreshStatus(name).pipe(finalize(() => { this.spinner.hide(); this.actionRunning = false; })).subscribe({
      next: (res: any) => this.applyActionResult(res, 'Estado SRI actualizado.'),
      error: (err) => toast.error(this.readError(err))
    });
  }

  reintentar(): void {
    const name = this.settlement?.name;
    if (!name || this.actionRunning || !this.canRetry) return;
    const blockMessage = this.capabilities.getEmissionBlockMessage({ feature: 'billing', permission: 'billing.manage' });
    if (blockMessage) {
      toast.error(blockMessage);
      return;
    }
    if (!confirm('¿Reintentar el envío de esta liquidación de compra al SRI?')) return;
    this.actionRunning = true;
    this.spinner.show();
    this.svc.retry(name).pipe(finalize(() => { this.spinner.hide(); this.actionRunning = false; })).subscribe({
      next: (res: any) => this.applyActionResult(res, 'Reintento de emisión enviado.'),
      error: (err) => toast.error(this.readError(err))
    });
  }

  private applyActionResult(res: any, successMessage: string): void {
    if (res?.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
      this.settlement = { ...(this.settlement || {}), ...res.data };
    }
    const messages = [...liteEmissionMessages(res?.emission), ...liteEmissionMessages(res?.data)].filter(Boolean);
    const state = String(res?.state || '').toUpperCase();
    if (['ERROR', 'PROVIDER_ERROR', 'REJECTED'].includes(state)) {
      toast.error(messages[0] || 'La operación no fue aceptada por el proveedor.');
    } else {
      toast.success(messages[0] || successMessage);
    }
    this.fetch(this.settlement?.name);
  }

  downloadPdf(): void {
    if (!this.capabilities.hasPermission('billing.read')) {
      toast.error('No tienes permisos para descargar documentos.');
      return;
    }
    if (!this.isAuthorized) {
      toast.info('El PDF estará disponible cuando la liquidación sea autorizada.');
      return;
    }
    const w = window.open(this.baseUrl + this.printSvc.getPurchaseSettlementPdf(this.settlement?.name), '_blank');
    if (!w) toast.error('No se pudo abrir la impresión.');
  }

  downloadXml(): void {
    if (!this.capabilities.hasPermission('billing.read')) {
      toast.error('No tienes permisos para descargar documentos.');
      return;
    }
    if (!this.isAuthorized) {
      toast.info('El XML estará disponible cuando la liquidación sea autorizada.');
      return;
    }
    const w = window.open(this.baseUrl + this.printSvc.getPurchaseSettlementXml(this.settlement?.name), '_blank');
    if (!w) toast.error('No se pudo abrir la descarga.');
  }

  private readError(err: any): string {
    return this.frappeError.handle(err) || 'No se pudo completar la acción.';
  }
}
