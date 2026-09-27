import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgxSpinnerComponent, NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { finalize } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { RemissionGuidesService } from 'src/app/services/remission-guides.service';
import { PrintService } from 'src/app/services/print.service';
import { liteEmissionMessages } from 'src/app/core/utils/lite-invoice-emission';
import { canConsultLiteInvoice, canRetryLiteInvoice } from 'src/app/core/utils/lite-invoice-actions';

/**
 * Sigue el mismo formato de página que invoice-detail-page / credit-note-detail-page
 * (header con acciones + tarjetas "Información general" / "SRI" + tabla de items),
 * para que las tres pantallas de documentos electrónicos se vean y se usen igual.
 */
@Component({
  selector: 'app-remission-guide-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FontAwesomeModule, NgxSpinnerComponent],
  templateUrl: './remission-guide-detail.component.html'
})
export class RemissionGuideDetailComponent implements OnInit {
  guide: any = null;
  actionRunning = false;
  private baseUrl = environment.URL;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private svc: RemissionGuidesService,
    private printSvc: PrintService,
    private spinner: NgxSpinnerService,
    public capabilities: CompanyCapabilitiesService
  ) {}

  ngOnInit(): void {
    const name = this.route.snapshot.paramMap.get('id')!;
    this.fetch(name);
  }

  fetch(name: string): void {
    this.spinner.show();
    this.svc.getDetail(name).pipe(finalize(() => this.spinner.hide())).subscribe({
      next: (res: any) => { this.guide = res; },
      error: (err) => toast.error(this.readError(err))
    });
  }

  goBack(): void {
    if (history.length > 2) history.back();
    else this.router.navigate(['/dashboard/remission-guides']);
  }

  get destinatarios(): any[] {
    return Array.isArray(this.guide?.destinatarios) ? this.guide.destinatarios : [];
  }

  get documentNumber(): string {
    return String(this.guide?.electronic?.document_number || this.guide?.name || '—');
  }

  get providerStatus(): string {
    return String(this.guide?.electronic?.provider_status || '').trim() || '—';
  }

  get accessKey(): string {
    return String(this.guide?.electronic?.access_key || '').trim();
  }

  get authorizationNumber(): string {
    return String(this.guide?.electronic?.authorization_number || '').trim();
  }

  get authorizationDatetime(): string {
    return String(this.guide?.electronic?.authorization_datetime || '').trim();
  }

  get sriMessage(): string {
    return String(this.guide?.electronic?.sri_message || '').trim();
  }

  get emissionError(): string {
    return String(this.guide?.electronic?.emission_error || '').trim();
  }

  async copyAccessKey(): Promise<void> {
    if (!this.accessKey) return;
    try {
      await navigator.clipboard.writeText(this.accessKey);
      toast.success('Clave de acceso copiada.');
    } catch {
      toast.error('No se pudo copiar la clave de acceso.');
    }
  }

  get statusRaw(): string {
    return String(this.guide?.status || '').trim().toUpperCase();
  }

  get statusLabel(): string {
    if (this.statusRaw === 'AUTORIZADA' || this.statusRaw === 'AUTORIZADO') return 'Autorizada';
    if (this.statusRaw === 'RECHAZADA' || this.statusRaw === 'RECHAZADO') return 'Rechazada';
    if (this.statusRaw === 'ERROR DE ENVIO' || this.statusRaw === 'ERROR DE ENVÍO') return 'Error de envío';
    if (this.statusRaw === 'PENDIENTE EMISION' || this.statusRaw === 'PENDIENTE EMISIÓN') return 'Pendiente emisión';
    if (this.statusRaw === 'EMITIDA') return 'Emitida';
    if (this.statusRaw === 'BORRADOR' || this.statusRaw === 'DRAFT') return 'Borrador';
    return this.statusRaw || '—';
  }

  get statusBadge(): string {
    if (['AUTORIZADA', 'AUTORIZADO'].includes(this.statusRaw)) return 'badge-green';
    if (['RECHAZADA', 'RECHAZADO', 'ERROR DE ENVIO', 'ERROR DE ENVÍO'].includes(this.statusRaw)) return 'badge-red';
    if (['BORRADOR', 'DRAFT'].includes(this.statusRaw)) return 'badge-gray';
    return 'badge-yellow';
  }

  get isDraft(): boolean {
    return ['BORRADOR', 'DRAFT'].includes(this.statusRaw);
  }

  get isAuthorized(): boolean {
    return ['AUTORIZADA', 'AUTORIZADO'].includes(this.statusRaw);
  }

  get canEdit(): boolean {
    return this.isDraft && this.capabilities.hasPermission('billing.create');
  }

  get canEmitDraft(): boolean {
    return this.isDraft && this.capabilities.hasPermission('billing.create');
  }

  get canConsult(): boolean {
    return this.capabilities.hasPermission('billing.manage') && canConsultLiteInvoice(this.guide);
  }

  get canRetry(): boolean {
    return this.capabilities.hasPermission('billing.manage') && canRetryLiteInvoice(this.guide);
  }

  emitirBorrador(): void {
    const name = this.guide?.name;
    if (!name || this.actionRunning) return;
    this.actionRunning = true;
    this.spinner.show();
    this.svc.emitDraft(name).pipe(finalize(() => { this.spinner.hide(); this.actionRunning = false; })).subscribe({
      next: (res: any) => this.applyActionResult(res, 'Guía de remisión emitida.'),
      error: (err) => toast.error(this.readError(err))
    });
  }

  consultarAutorizacion(): void {
    const name = this.guide?.name;
    if (!name || this.actionRunning || !this.canConsult) return;
    this.actionRunning = true;
    this.spinner.show();
    this.svc.refreshStatus(name).pipe(finalize(() => { this.spinner.hide(); this.actionRunning = false; })).subscribe({
      next: (res: any) => this.applyActionResult(res, 'Estado SRI actualizado.'),
      error: (err) => toast.error(this.readError(err))
    });
  }

  reintentar(): void {
    const name = this.guide?.name;
    if (!name || this.actionRunning || !this.canRetry) return;
    if (!confirm('¿Reintentar el envío de esta guía de remisión al SRI?')) return;
    this.actionRunning = true;
    this.spinner.show();
    this.svc.retry(name).pipe(finalize(() => { this.spinner.hide(); this.actionRunning = false; })).subscribe({
      next: (res: any) => this.applyActionResult(res, 'Reintento de emisión enviado.'),
      error: (err) => toast.error(this.readError(err))
    });
  }

  private applyActionResult(res: any, successMessage: string): void {
    if (res?.data && typeof res.data === 'object' && !Array.isArray(res.data)) {
      this.guide = { ...(this.guide || {}), ...res.data };
    }
    const messages = [
      ...liteEmissionMessages(res?.emission),
      ...liteEmissionMessages(res?.data)
    ].filter(Boolean);
    const state = String(res?.state || '').toUpperCase();
    if (['ERROR', 'PROVIDER_ERROR', 'REJECTED'].includes(state)) {
      toast.error(messages[0] || 'La operación no fue aceptada por el proveedor.');
    } else {
      toast.success(messages[0] || successMessage);
    }
    this.fetch(this.guide?.name);
  }

  downloadPdf(): void {
    if (!this.capabilities.hasPermission('billing.read')) {
      toast.error('No tienes permisos para descargar documentos.');
      return;
    }
    if (!this.isAuthorized) {
      toast.info('El PDF estará disponible cuando la guía sea autorizada.');
      return;
    }
    const w = window.open(this.baseUrl + this.printSvc.getRemissionGuidePdf(this.guide?.name), '_blank');
    if (!w) toast.error('No se pudo abrir la impresión.');
  }

  downloadXml(): void {
    if (!this.capabilities.hasPermission('billing.read')) {
      toast.error('No tienes permisos para descargar documentos.');
      return;
    }
    if (!this.isAuthorized) {
      toast.info('El XML estará disponible cuando la guía sea autorizada.');
      return;
    }
    const w = window.open(this.baseUrl + this.printSvc.getRemissionGuideXml(this.guide?.name), '_blank');
    if (!w) toast.error('No se pudo abrir la descarga.');
  }

  identificationLabel(code: string): string {
    if (code === '04') return 'RUC';
    if (code === '05') return 'Cédula';
    if (code === '06') return 'Pasaporte';
    if (code === '08') return 'Identificación del exterior';
    return code || '—';
  }

  private readError(err: any): string {
    const raw = err?.error?._server_messages || err?.error?.message || err?.error?._error_message || err?.message;
    let message = '';
    try {
      const parsed = typeof raw === 'string' && raw.trim().startsWith('[') ? JSON.parse(raw) : raw;
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      const value = typeof first === 'string' ? (() => { try { return JSON.parse(first); } catch { return first; } })() : first;
      message = typeof value === 'string' ? value : value?.message || '';
    } catch { message = String(raw || ''); }
    return message || 'No se pudo completar la acción.';
  }
}
