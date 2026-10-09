import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { LiteDashboard } from 'src/app/services/facturada-lite-dashboard.service';
import { CompanySummary, PlanSummary, TONE_CLASSES, Tone } from '../../dashboard.models';
import { normalizeText } from '../../utils/dashboard-values';
import { planUsagePercent } from '../../utils/plan-summary';
import { BillingKpisComponent } from '../billing-kpis/billing-kpis.component';
import { RecentInvoicesComponent } from '../recent-invoices/recent-invoices.component';

const CERTIFICATE_SETUP_KEYS = ['CERTIFICATE', 'ELECTRONIC CERTIFICATE', 'SIGNATURE', 'ELECTRONIC SIGNATURE'];

/** Negocio API-only: consumo, configuración tributaria e integración. */
@Component({
  selector: 'app-api-panel',
  standalone: true,
  imports: [CommonModule, RouterModule, BillingKpisComponent, RecentInvoicesComponent],
  template: `
    <app-billing-kpis [sales]="dashboard.sales"></app-billing-kpis>

    <section class="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
      <article class="rounded-xl border border-border bg-card p-3 shadow-sm">
        <div class="mb-2 flex items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-bold text-foreground">Estado de integración</h2>
            <p class="text-[10px] text-muted-foreground">Datos que deben coincidir en tus solicitudes.</p>
          </div>
          <span class="rounded-full px-2 py-1 text-[10px] font-bold" [ngClass]="toneClasses[setupStatus.tone]">{{ setupStatus.label }}</span>
        </div>
        <div class="grid gap-1.5 text-[11px]">
          <div class="flex justify-between rounded-lg bg-muted/40 px-2.5 py-2"><span>API</span><b class="text-emerald-700">Activa</b></div>
          <div class="flex justify-between rounded-lg bg-muted/40 px-2.5 py-2"><span>RUC tributario</span><b>{{ ruc }}</b></div>
          <div class="flex justify-between rounded-lg bg-muted/40 px-2.5 py-2"><span>Ambiente</span><b>{{ environment }}</b></div>
          <div class="flex justify-between rounded-lg bg-muted/40 px-2.5 py-2"><span>Secuencia factura</span><b>{{ sequenceLabel }}</b></div>
        </div>
        <p *ngIf="capabilities.liteSetupMissing.length" class="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] font-semibold text-amber-800">
          Pendiente: {{ capabilities.liteSetupMissing.join(', ') }}
        </p>
      </article>

      <article class="rounded-xl border border-border bg-card p-3 shadow-sm">
        <h2 class="text-sm font-bold text-foreground">Uso del plan</h2>
        <ng-container *ngIf="plan; else noPlan">
          <p class="mb-2 text-[10px] text-muted-foreground">{{ plan.name }}</p>
          <div class="h-2 overflow-hidden rounded-full bg-muted"><div class="h-full rounded-full bg-primary" [style.width.%]="usagePercent"></div></div>
          <div class="mt-2 flex justify-between text-[11px]">
            <span>{{ plan.used }} usados</span>
            <b>{{ plan.unlimited ? 'Ilimitados' : (plan.remaining + ' restantes') }}</b>
          </div>
        </ng-container>
        <ng-template #noPlan><p class="mb-2 text-[10px] text-muted-foreground">Sin plan asignado.</p></ng-template>
        <div class="mt-3 flex flex-wrap gap-2">
          <a *ngIf="capabilities.apiConfiguration?.enabled === true" routerLink="/settings/lite/api" class="rounded-md bg-slate-900 px-3 py-2 text-[10px] font-bold text-white">Integración API</a>
          <a routerLink="/dashboard/invoices" class="rounded-md bg-primary px-3 py-2 text-[10px] font-bold text-white">Ver facturas</a>
          <a routerLink="/dashboard/credit-notes" class="rounded-md bg-amber-500 px-3 py-2 text-[10px] font-bold text-white">Notas de crédito</a>
        </div>
      </article>
    </section>

    <app-recent-invoices [invoices]="dashboard.recent_invoices" subtitle="Actividad generada por tus integraciones."></app-recent-invoices>
  `
})
export class ApiPanelComponent {
  @Input({ required: true }) dashboard!: LiteDashboard;
  @Input() plan: PlanSummary | null = null;
  @Input() company: CompanySummary | null = null;

  readonly toneClasses = TONE_CLASSES;

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
