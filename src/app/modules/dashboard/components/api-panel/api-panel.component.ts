import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { LiteDashboard } from 'src/app/services/facturada-lite-dashboard.service';
import { CompanySummary, PlanSummary, Tone } from '../../dashboard.models';
import { normalizeText } from '../../utils/dashboard-values';
import { planUsagePercent } from '../../utils/plan-summary';
import { RecentInvoicesComponent } from '../recent-invoices/recent-invoices.component';

const CERTIFICATE_SETUP_KEYS = ['CERTIFICATE', 'ELECTRONIC CERTIFICATE', 'SIGNATURE', 'ELECTRONIC SIGNATURE'];

/** Negocio API-only: estado de la integración, plan y últimas facturas (los comprobantes del mes van arriba). */
@Component({
  selector: 'app-api-panel',
  standalone: true,
  imports: [CommonModule, RouterModule, RecentInvoicesComponent],
  template: `
    <section class="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
      <article class="rounded-xl border border-border bg-card" aria-labelledby="api-status-title">
        <div class="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div>
            <h2 id="api-status-title" class="text-[15px] font-semibold text-foreground">Estado de la integración</h2>
            <p class="text-[13px] text-muted-foreground">Datos que deben coincidir en tus solicitudes.</p>
          </div>
          <span class="badge shrink-0" [ngClass]="badgeClasses[setupStatus.tone]">{{ setupStatus.label }}</span>
        </div>
        <dl class="divide-y divide-border border-t border-border text-sm">
          <div class="flex justify-between gap-4 px-5 py-2.5"><dt class="text-muted-foreground">API</dt><dd class="font-medium text-success-700">Activa</dd></div>
          <div class="flex justify-between gap-4 px-5 py-2.5"><dt class="text-muted-foreground">RUC</dt><dd class="font-medium tabular-nums">{{ ruc }}</dd></div>
          <div class="flex justify-between gap-4 px-5 py-2.5"><dt class="text-muted-foreground">Ambiente</dt><dd class="font-medium">{{ environment }}</dd></div>
          <div class="flex justify-between gap-4 px-5 py-2.5"><dt class="text-muted-foreground">Secuencia de factura</dt><dd class="font-medium tabular-nums">{{ sequenceLabel }}</dd></div>
        </dl>
        <p *ngIf="capabilities.liteSetupMissing.length" class="mx-5 mb-4 mt-1 rounded-lg bg-warning-50 px-3 py-2 text-[13px] text-warning-800">
          Falta completar: {{ capabilities.liteSetupMissing.join(', ') }}
        </p>
      </article>

      <article class="rounded-xl border border-border bg-card px-5 py-4" aria-labelledby="api-plan-title">
        <h2 id="api-plan-title" class="text-[15px] font-semibold text-foreground">Uso del plan</h2>
        <ng-container *ngIf="plan; else noPlan">
          <p class="mb-3 text-[13px] text-muted-foreground">{{ plan.name }}</p>
          <div class="h-1.5 overflow-hidden rounded-full bg-muted"><div class="h-full rounded-full bg-primary" [style.width.%]="usagePercent"></div></div>
          <div class="mt-2 flex justify-between text-[13px] tabular-nums">
            <span>{{ plan.used }} usados</span>
            <span class="text-muted-foreground">{{ plan.unlimited ? 'Ilimitados' : ('Quedan ' + plan.remaining) }}</span>
          </div>
        </ng-container>
        <ng-template #noPlan><p class="mb-3 text-[13px] text-muted-foreground">Sin plan asignado.</p></ng-template>
        <div class="mt-4 flex flex-wrap gap-2">
          <a *ngIf="capabilities.apiConfiguration?.enabled === true" routerLink="/settings/lite/api" class="btn btn-primary !h-9 !text-[13px]">Integración API</a>
          <a routerLink="/dashboard/invoices" class="btn btn-outline !h-9 !text-[13px]">Ver facturas</a>
          <a routerLink="/dashboard/credit-notes" class="btn btn-outline !h-9 !text-[13px]">Notas de crédito</a>
        </div>
      </article>
    </section>

    <app-recent-invoices [invoices]="dashboard.recent_invoices" [canOpen]="true" subtitle="Lo último que emitieron tus integraciones."></app-recent-invoices>
  `
})
export class ApiPanelComponent {
  @Input({ required: true }) dashboard!: LiteDashboard;
  @Input() plan: PlanSummary | null = null;
  @Input() company: CompanySummary | null = null;

  readonly badgeClasses: Record<Tone, string> = {
    neutral: 'badge-gray',
    success: 'badge-green',
    info: 'badge-blue',
    warning: 'badge-yellow',
    danger: 'badge-red'
  };

  constructor(public capabilities: CompanyCapabilitiesService) {}

  get usagePercent(): number {
    return this.plan ? planUsagePercent(this.plan) : 0;
  }

  get environment(): string {
    const business = this.capabilities.business || {};
    return String(this.company?.environment || business.environment || business.ambiente || 'No configurado');
  }

  get ruc(): string {
    const business = this.capabilities.business || {};
    return String(business.ruc || business.tax_id || 'No configurado');
  }

  /** "Lista para emitir" solo con setup completo y firma cargada en el perfil tributario. */
  get setupStatus(): { label: string; tone: Tone } {
    const ready = this.capabilities.liteSetupReady;
    if (ready === null || ready === undefined) return { label: 'Pendiente de validar', tone: 'neutral' };
    const certificateMissing = this.capabilities.liteSetupMissing
      .some((item) => CERTIFICATE_SETUP_KEYS.includes(normalizeText(item).replace(/[_-]/g, ' ')));
    if (ready !== true || !this.company || this.company.certificateMissing || certificateMissing) {
      return { label: 'Configuración pendiente', tone: 'warning' };
    }
    return { label: 'Lista para emitir', tone: 'success' };
  }

  get sequenceLabel(): string {
    const environment = normalizeText(this.environment);
    const sequence = this.capabilities.sequences.find((item: any) =>
      normalizeText(item?.document_type) === 'FACTURA'
      && normalizeText(item?.status || 'Activo') === 'ACTIVO'
      && normalizeText(item?.environment) === environment
    );
    if (!sequence) return 'Sin secuencia activa';
    const current = Number(sequence?.current_number ?? 0) || 0;
    const next = sequence?.next_number !== undefined ? Number(sequence.next_number) : current + 1;
    return `Próximo ${String(Math.max(next, 1)).padStart(9, '0')}`;
  }
}
