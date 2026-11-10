import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { BRAND, brandWhatsappUrl } from 'src/app/core/constants/brand.constants';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import {
  SubscriptionMovement,
  SubscriptionMovementType,
  SubscriptionOverview,
  SubscriptionService,
} from 'src/app/services/subscription.service';

const MOVEMENT_LABELS: Record<SubscriptionMovementType, string> = {
  Alta: 'Alta del plan',
  Renovación: 'Renovación',
  'Cambio de plan': 'Cambio de plan',
  Ajuste: 'Ajuste',
  Suspensión: 'Suspensión',
  Reactivación: 'Reactivación',
  Vencimiento: 'Vencimiento',
  Cancelación: 'Cancelación',
  Sincronización: 'Actualización',
};

const MOVEMENT_BADGES: Record<SubscriptionMovementType, string> = {
  Alta: 'badge-blue',
  Renovación: 'badge-green',
  'Cambio de plan': 'badge-blue',
  Ajuste: 'badge-gray',
  Suspensión: 'badge-yellow',
  Reactivación: 'badge-green',
  Vencimiento: 'badge-red',
  Cancelación: 'badge-red',
  Sincronización: 'badge-gray',
};

/** Días antes del fin en que se avisa que el plan vence. */
const EXPIRY_NOTICE_DAYS = 30;
const COLLAPSED_COUNT = 5;

/**
 * Configuración ▸ Plan: módulos incluidos, cambio programado, historial y contacto para renovar.
 * Solo lectura: la renovación y el cambio de plan los registra BMARC en el Desk.
 */
@Component({
  selector: 'app-plan-overview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './plan-overview.component.html',
})
export class PlanOverviewComponent implements OnInit {
  /** Nombre del plan que ya muestra la tarjeta (para el mensaje de WhatsApp si la consulta falla). */
  @Input() planName = '';

  overview: SubscriptionOverview | null = null;
  loading = false;
  expanded = false;
  readonly collapsedCount = COLLAPSED_COUNT;

  constructor(
    private subscriptions: SubscriptionService,
    private capabilities: CompanyCapabilitiesService
  ) {}

  ngOnInit(): void {
    const business = this.capabilities.activeBusinessId;
    if (!business) return;
    this.loading = true;
    this.subscriptions.getOverview(business).subscribe({
      next: (data) => {
        // Ignora la respuesta si el usuario cambió de negocio mientras cargaba.
        if (business !== this.capabilities.activeBusinessId) return;
        this.overview = data;
        this.loading = false;
      },
      // Sin permiso o backend sin historial: la tarjeta del plan sigue sirviendo y queda el contacto.
      error: () => {
        this.overview = null;
        this.loading = false;
      },
    });
  }

  get visibleMovements(): SubscriptionMovement[] {
    const rows = this.overview?.movements ?? [];
    return this.expanded ? rows : rows.slice(0, COLLAPSED_COUNT);
  }

  get expiryNote(): string | null {
    const data = this.overview;
    if (!data?.has_subscription || !data.is_active || data.scheduled) return null;
    const days = data.days_left;
    if (days === null || days === undefined || days < 0 || days > EXPIRY_NOTICE_DAYS) return null;
    const when = days === 0 ? 'El plan vence hoy' : `El plan vence en ${days} ${days === 1 ? 'día' : 'días'} (${this.formatDate(data.end_date)})`;
    return `${when}. Renueva a tiempo para no interrumpir la facturación.`;
  }

  get whatsappUrl(): string {
    const business = this.capabilities.activeBusiness;
    const name = String(business?.businessname || business?.business_name || this.capabilities.activeBusinessId || '').trim();
    const ruc = String(this.capabilities.business?.ruc || business?.tax_id || '').trim();
    const plan = this.overview?.plan_name || this.planName;
    const who = `${name}${ruc ? ` (RUC ${ruc})` : ''}`;
    const message = plan
      ? `Hola, soy ${who}. Quiero renovar o cambiar mi plan de ${BRAND.product} (plan actual: ${plan}).`
      : `Hola, soy ${who}. Quiero contratar un plan de ${BRAND.product}.`;
    return brandWhatsappUrl(message);
  }

  get hasPlan(): boolean {
    return !!(this.overview?.has_subscription || this.planName);
  }

  movementLabel(type: SubscriptionMovementType): string {
    return MOVEMENT_LABELS[type] || type;
  }

  badgeLabel(row: SubscriptionMovement): string {
    return row.status === 'Programado' ? `${this.movementLabel(row.movement_type)} · programado` : this.movementLabel(row.movement_type);
  }

  badgeClass(row: SubscriptionMovement): string {
    return row.status === 'Programado' ? 'badge-blue' : MOVEMENT_BADGES[row.movement_type] || 'badge-gray';
  }

  planChange(row: SubscriptionMovement): string {
    const previous = row.previous_plan_name;
    return previous && previous !== row.plan_name ? `${previous} → ${row.plan_name || ''}` : row.plan_name || '—';
  }

  periodLabel(row: SubscriptionMovement): string {
    if (!row.subscription_start && !row.subscription_end) return 'Sin vigencia';
    if (!row.subscription_end) return `Desde ${this.formatDate(row.subscription_start)}, sin fecha de fin`;
    return `${this.formatDate(row.subscription_start)} – ${this.formatDate(row.subscription_end)}`;
  }

  quotaLabel(row: SubscriptionMovement): string {
    if (Number(row.unlimited_documents)) return 'Comprobantes ilimitados';
    const included = Number(row.max_authorized_documents) || 0;
    return included > 0 ? `${included} comprobantes` : 'Sin cupo de comprobantes';
  }

  /** Lo que se usó del período anterior, útil en renovaciones y cambios de plan. */
  previousUsage(row: SubscriptionMovement): string | null {
    if (!['Renovación', 'Cambio de plan'].includes(row.movement_type) || row.status !== 'Aplicado') return null;
    const used = Number(row.used_before) || 0;
    return `${used} ${used === 1 ? 'usado' : 'usados'} en el período anterior`;
  }

  formatDate(value?: string | null): string {
    const raw = `${value || ''}`.trim().slice(0, 10);
    const parts = raw.split('-');
    return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : raw || '—';
  }

  formatAmount(value: number): string {
    return new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
  }
}
