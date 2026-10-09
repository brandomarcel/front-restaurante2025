import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlanSummary } from '../../dashboard.models';
import { planExpiringSoon, planUsagePercent } from '../../utils/plan-summary';

/** Consumo de comprobantes y vigencia del plan del negocio. */
@Component({
  selector: 'app-plan-usage-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plan-usage-card.component.html'
})
export class PlanUsageCardComponent {
  @Input() plan: PlanSummary | null = null;

  get usagePercent(): number {
    return this.plan ? planUsagePercent(this.plan) : 0;
  }

  get expiringSoon(): boolean {
    return !!this.plan && planExpiringSoon(this.plan);
  }
}
