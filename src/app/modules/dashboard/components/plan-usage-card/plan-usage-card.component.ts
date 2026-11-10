import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlanSummary } from '../../dashboard.models';
import { planUsagePercent } from '../../utils/plan-summary';

/**
 * Consumo de comprobantes del plan, en una fila. Sigue el período de consumo
 * del plan, no el mes elegido arriba. Los avisos (vencido, agotado) van en
 * «Necesita tu atención».
 */
@Component({
  selector: 'app-plan-usage-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex flex-col gap-3 border-t border-border px-5 py-4 md:flex-row md:items-center md:gap-6">
      <div class="min-w-0 md:w-64 md:shrink-0">
        <p class="text-[13px] text-muted-foreground">Tu plan</p>
        <p class="line-clamp-2 text-sm font-medium text-foreground" [title]="plan?.name || ''">{{ plan?.name || 'Sin plan asignado' }}</p>
      </div>

      <ng-container *ngIf="plan">
        <div *ngIf="!plan.unlimited; else unlimited" class="min-w-0 flex-1">
          <div class="flex items-baseline justify-between gap-3 text-[13px] tabular-nums">
            <span class="text-foreground">{{ plan.used }} de {{ plan.included }} comprobantes usados</span>
            <span class="text-muted-foreground">Quedan {{ plan.remaining }}</span>
          </div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar"
            [attr.aria-valuenow]="usagePercent | number:'1.0-0'" aria-valuemin="0" aria-valuemax="100" aria-label="Comprobantes usados del plan">
            <div class="h-full rounded-full" [ngClass]="usagePercent >= 90 ? 'bg-danger-500' : usagePercent >= 75 ? 'bg-warning-500' : 'bg-primary'"
              [style.width.%]="usagePercent"></div>
          </div>
        </div>
        <ng-template #unlimited>
          <p class="flex-1 text-[13px] text-foreground">Comprobantes ilimitados ({{ plan.used }} emitidos)</p>
        </ng-template>

        <p class="text-[13px] text-muted-foreground md:shrink-0 md:text-right">
          <ng-container *ngIf="plan.daysToExpire !== null; else noExpiry">
            {{ plan.daysToExpire < 0 ? 'Venció' : 'Vence en ' + plan.daysToExpire + (plan.daysToExpire === 1 ? ' día' : ' días') }}
            <span *ngIf="plan.autoRenew"> (se renueva solo)</span>
          </ng-container>
          <ng-template #noExpiry>Sin fecha de vencimiento</ng-template>
        </p>
      </ng-container>
    </div>
  `
})
export class PlanUsageCardComponent {
  @Input() plan: PlanSummary | null = null;

  get usagePercent(): number {
    return this.plan ? planUsagePercent(this.plan) : 0;
  }
}
