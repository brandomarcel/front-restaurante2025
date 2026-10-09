import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlanSummary, SignatureStatus, TONE_CLASSES } from '../../dashboard.models';

/** Cabecera del dashboard: negocio, modalidad, firma, caja y plan. */
@Component({
  selector: 'app-dashboard-hero',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-hero.component.html'
})
export class DashboardHeroComponent {
  @Input() businessName = 'Empresa activa';
  @Input() logo: string | null = null;
  @Input() modeLabel = '';
  @Input() title = '';
  @Input() subtitle = '';
  @Input() userName = 'Equipo';
  @Input() gradientClasses = 'from-slate-950 via-primary to-sky-700';
  /** `null` oculta el estado de la firma. */
  @Input() signature: SignatureStatus | null = null;
  /** `null` oculta el estado de caja. */
  @Input() cashOpen: boolean | null = null;
  @Input() plan: PlanSummary | null = null;

  readonly today = new Date();
  readonly toneClasses = TONE_CLASSES;

  get initial(): string {
    return (this.businessName || 'E').slice(0, 1).toUpperCase();
  }
}
