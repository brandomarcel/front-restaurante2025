import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnChanges, OnDestroy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { ElectronicReviewService } from 'src/app/services/electronic-review.service';
import { backendFlag, canVerifyMissingSriDocument, canRegenerateElectronicDocument, electronicDocumentLabel, electronicReplacement, isClosedElectronicDocument } from 'src/app/core/utils/electronic-document';
import { liteEmissionMessages } from 'src/app/core/utils/lite-invoice-emission';
import { ElectronicDocumentUpdatesService } from 'src/app/services/electronic-document-updates.service';

@Component({
  selector: 'app-electronic-status-panel', standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <section class="rounded-xl border border-border bg-card p-4 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="font-semibold">Seguimiento electrónico</h3>
        <span class="rounded-lg bg-muted px-3 py-1 text-sm">{{ label }}</span>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-lg bg-muted/40 p-3"><p class="text-xs text-muted-foreground">Recepción SRI</p><strong>{{ reception }}</strong>
          <p *ngIf="confirmed" class="text-xs text-emerald-700">Recepción confirmada por backend</p></div>
        <div class="rounded-lg bg-muted/40 p-3"><p class="text-xs text-muted-foreground">Autorización SRI</p><strong>{{ authorization }}</strong></div>
      </div>
      <p *ngFor="let message of messages" class="text-sm break-words">{{ message }}</p>
      <a *ngIf="replacement" [routerLink]="[kind === 'credit-note' ? '/dashboard/credit-note' : '/dashboard/invoices', replacement]"
        class="inline-block rounded-lg border border-border px-3 py-2 text-sm font-semibold">Abrir factura reemplazante</a>
      <p *ngIf="automaticQueryActive" class="rounded-lg bg-muted/40 p-3 text-sm">Consulta automática programada
        <span *ngIf="electronic.next_status_check_at"> · Próxima consulta: {{ electronic.next_status_check_at }}</span></p>
      <p *ngIf="electronic.fecha_ultima_consulta || electronic.last_status_check_at" class="text-xs text-muted-foreground">Última consulta: {{ electronic.fecha_ultima_consulta || electronic.last_status_check_at }}</p>
      <p *ngIf="electronic.status_check_error" class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{{ queryError }}</p>
      <p *ngIf="manualReviewAvailable && reviewRequired" class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Revisión manual requerida. No reintentar hasta revisar el resultado.</p>
      <p *ngIf="manualReviewAvailable && electronic.manual_reviewed_at" class="text-xs text-muted-foreground">Revisado por {{ electronic.manual_reviewed_by }} · {{ electronic.manual_reviewed_at }}</p>
      <div *ngIf="canManage && manualReviewAvailable && (reviewRequired || canVerify)" class="space-y-2 border-t border-border pt-3">
        <button type="button" class="rounded-lg border border-border px-3 py-2 text-sm font-semibold" (click)="reviewOpen = !reviewOpen" [disabled]="busy">Registrar revisión SRI</button>
        <div *ngIf="reviewOpen" class="space-y-3">
          <label class="block text-sm">Motivo de revisión (obligatorio)
            <textarea [(ngModel)]="reason" [disabled]="busy" rows="2" class="mt-1 w-full rounded-lg border border-border p-2" maxlength="1000"></textarea></label>
          <label *ngIf="canVerify" class="flex gap-2 text-sm"><input type="checkbox" [(ngModel)]="verified" [disabled]="busy" />
            Consulté manualmente la clave en el ambiente {{ document.environment || electronic.environment || document.ambiente || 'del documento' }} y confirmé que no existe en SRI. Una falta de respuesta no demuestra inexistencia.</label>
          <button type="button" class="rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50" (click)="confirmReview()" [disabled]="busy || !reason.trim()">{{ busy ? 'Guardando…' : 'Guardar revisión' }}</button>
        </div>
      </div>
      <div *ngIf="canManage && canRegenerate" class="border-t border-border pt-3 space-y-2">
        <p class="text-sm text-muted-foreground">{{ electronic.regeneration_reason || document.regeneration_reason }}</p>
        <button type="button" class="rounded-lg border border-amber-300 px-3 py-2 text-sm font-semibold" [disabled]="busy" (click)="regenerate()">Regenerar mismo secuencial</button>
      </div>
    </section>`
})
export class ElectronicStatusPanelComponent implements OnChanges, OnDestroy {
  @Input() document: any;
  @Input() kind: 'invoice' | 'credit-note' | 'guide' = 'invoice';
  @Output() updated = new EventEmitter<any>();
  busy = false;
  reviewOpen = false;
  reason = '';
  verified = false;
  private updates?: Subscription;
  private watchedDocument = '';
  constructor(public capabilities: CompanyCapabilitiesService, private service: ElectronicReviewService,
    private documentUpdates: ElectronicDocumentUpdatesService) {}
  ngOnChanges(): void {
    this.reviewOpen = false; this.reason = ''; this.verified = false;
    const business = typeof this.document?.business === 'object' ? this.document.business.name : this.document?.business;
    const key = this.document?.name && business === this.capabilities.activeBusinessId && !this.closed
      ? `${business}/${this.kind}/${this.document.name}` : '';
    if (key === this.watchedDocument) return;
    this.updates?.unsubscribe();
    this.watchedDocument = key;
    if (key) this.updates = this.documentUpdates.watch(this.document.name, business, this.kind === 'guide')
      .subscribe(document => this.updated.emit(document));
  }
  ngOnDestroy(): void { this.updates?.unsubscribe(); }
  get electronic(): any { return this.document?.electronic ?? {}; }
  get closed(): boolean { return isClosedElectronicDocument(this.document); }
  get replacement(): string { return this.kind === 'guide' ? '' : electronicReplacement(this.document); }
  get automaticQueryActive(): boolean { return !this.closed && !this.reviewRequired && backendFlag(this.electronic.automatic_query_active); }
  get queryError(): string { return liteEmissionMessages({ message: this.electronic.status_check_error }).join(' · '); }
  get label(): string { return electronicDocumentLabel(this.document); }
  get confirmed(): boolean { return backendFlag(this.electronic.reception_confirmed); }
  get reviewRequired(): boolean { return !this.closed && backendFlag(this.electronic.manual_review_required ?? this.document?.manual_review_required); }
  get reception(): string {
    const labels: Record<string, string> = { NOT_SENT: 'Sin envío', RECIBIDA: 'Recibida', DEVUELTA: 'Devuelta', UNKNOWN: 'Recepción incierta' };
    return labels[this.electronic.reception_status] ?? 'No informado';
  }
  get authorization(): string {
    const labels: Record<string, string> = { NOT_REQUESTED: 'Sin consulta', PENDIENTE: 'Pendiente', AUTORIZADO: 'Autorizada', NO_AUTORIZADO: 'No autorizada', UNKNOWN: 'Autorización incierta' };
    return labels[this.electronic.authorization_status] ?? 'No informado';
  }
  get messages(): string[] {
    const messages = liteEmissionMessages(this.document);
    return this.manualReviewAvailable ? messages : messages.filter(message =>
      !/(revisi[oó]n manual|verificaci[oó]n manual|regeneraci[oó]n|regenerar)/i.test(message));
  }
  get manualReviewAvailable(): boolean {
    if (this.kind === 'guide') return true;
    if (this.electronic.manual_review_available !== undefined) {
      return backendFlag(this.electronic.manual_review_available);
    }
    // Compatibility with older API responses. Compare calendar dates in Ecuador,
    // never elapsed hours or the browser's local timezone.
    const issued = String(this.document?.posting_date || this.document?.createdAt || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issued)) return false;
    const parts = new Intl.DateTimeFormat('en', { timeZone: 'America/Guayaquil',
      year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const part = (type: string) => parts.find(item => item.type === type)?.value || '';
    return issued < `${part('year')}-${part('month')}-${part('day')}`;
  }
  get canManage(): boolean {
    const business = typeof this.document?.business === 'object' ? this.document.business.name : this.document?.business;
    return !!business && business === this.capabilities.activeBusinessId && this.capabilities.hasPermission('billing.manage');
  }
  get canVerify(): boolean { return this.kind !== 'guide' && this.manualReviewAvailable && canVerifyMissingSriDocument(this.document); }
  get canRegenerate(): boolean { return this.kind !== 'guide' && this.manualReviewAvailable && canRegenerateElectronicDocument(this.document); }
  confirmReview(): void {
    if (this.busy || !this.canManage || !this.manualReviewAvailable || !this.reason.trim() || (!this.reviewRequired && !this.canVerify)) return;
    if (!this.reviewRequired && !this.verified) { toast.error('Confirma la verificación manual de inexistencia en SRI.'); return; }
    this.run(false);
  }
  regenerate(): void {
    if (this.busy || !this.canManage || !this.canRegenerate) return;
    if (!window.confirm('Se creará un reemplazo con el mismo secuencial y ambiente, pero nueva fecha y clave. El original quedará Reemplazada. ¿Continuar?')) return;
    this.run(true);
  }
  private run(regenerate: boolean): void {
    const business = this.capabilities.activeBusinessId!;
    const name = this.document.name;
    this.busy = true;
    const request = regenerate ? this.service.regenerate(name, business)
      : this.service.confirm(name, this.reason.trim(), business, this.kind === 'guide', this.verified && this.canVerify);
    request.pipe(finalize(() => this.busy = false)).subscribe({
      next: response => {
        if (business !== this.capabilities.activeBusinessId || name !== this.document?.name) return;
        const body = response?.message ?? response;
        if (body?.ok === false || body?.emission?.ok === false || body?.emission?.status === 'ERROR') {
          toast.error(liteEmissionMessages(body).join(' · ') || 'No se pudo completar la operación.'); return;
        }
        if (!body?.data?.name) { toast.error('El backend no devolvió el documento actualizado.'); return; }
        this.reviewOpen = false; this.reason = ''; this.verified = false;
        this.updated.emit(body.data);
      },
      error: error => toast.error(error.status === 403 ? 'No tienes permiso para realizar esta operación.'
        : liteEmissionMessages(error?.error?.message ?? error?.error).join(' · ') || 'No se pudo completar la operación.')
    });
  }
}
