import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { ElectronicReviewService } from 'src/app/services/electronic-review.service';
import { backendFlag, canVerifyMissingSriDocument, canRegenerateElectronicDocument, electronicDocumentLabel } from 'src/app/core/utils/electronic-document';
import { liteEmissionMessages } from 'src/app/core/utils/lite-invoice-emission';

@Component({
  selector: 'app-electronic-status-panel', standalone: true,
  imports: [CommonModule, FormsModule],
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
      <p *ngIf="reviewRequired" class="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Revisión manual requerida. No reintentar hasta revisar el resultado.</p>
      <p *ngIf="electronic.manual_reviewed_at" class="text-xs text-muted-foreground">Revisado por {{ electronic.manual_reviewed_by }} · {{ electronic.manual_reviewed_at }}</p>
      <div *ngIf="canManage && (reviewRequired || canVerify)" class="space-y-2 border-t border-border pt-3">
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
export class ElectronicStatusPanelComponent implements OnChanges {
  @Input() document: any;
  @Input() kind: 'invoice' | 'credit-note' | 'guide' = 'invoice';
  @Output() updated = new EventEmitter<any>();
  busy = false;
  reviewOpen = false;
  reason = '';
  verified = false;
  constructor(public capabilities: CompanyCapabilitiesService, private service: ElectronicReviewService) {}
  ngOnChanges(): void { this.reviewOpen = false; this.reason = ''; this.verified = false; }
  get electronic(): any { return this.document?.electronic ?? {}; }
  get label(): string { return electronicDocumentLabel(this.document); }
  get confirmed(): boolean { return backendFlag(this.electronic.reception_confirmed); }
  get reviewRequired(): boolean { return backendFlag(this.electronic.manual_review_required ?? this.document?.manual_review_required); }
  get reception(): string {
    const labels: Record<string, string> = { NOT_SENT: 'Sin envío', RECIBIDA: 'Recibida', DEVUELTA: 'Devuelta', UNKNOWN: 'Recepción incierta' };
    return labels[this.electronic.reception_status] ?? 'No informado';
  }
  get authorization(): string {
    const labels: Record<string, string> = { NOT_REQUESTED: 'Sin consulta', PENDIENTE: 'Pendiente', AUTORIZADO: 'Autorizada', NO_AUTORIZADO: 'No autorizada', UNKNOWN: 'Autorización incierta' };
    return labels[this.electronic.authorization_status] ?? 'No informado';
  }
  get messages(): string[] { return liteEmissionMessages(this.document); }
  get canManage(): boolean {
    const business = typeof this.document?.business === 'object' ? this.document.business.name : this.document?.business;
    return !!business && business === this.capabilities.activeBusinessId && this.capabilities.hasPermission('billing.manage');
  }
  get canVerify(): boolean { return this.kind !== 'guide' && canVerifyMissingSriDocument(this.document); }
  get canRegenerate(): boolean { return this.kind !== 'guide' && canRegenerateElectronicDocument(this.document); }
  confirmReview(): void {
    if (this.busy || !this.canManage || !this.reason.trim() || (!this.reviewRequired && !this.canVerify)) return;
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
