import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SignatureStatus, Tone } from '../../dashboard.models';

const DOT_CLASSES: Record<Tone, string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success-500',
  info: 'bg-info-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500'
};

/**
 * Cabecera del dashboard: negocio, de qué trata el panel y dos estados que
 * condicionan el día (caja y firma). El detalle de cada uno va en «Necesita tu
 * atención»; aquí solo se nombran.
 */
@Component({
  selector: 'app-dashboard-hero',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex min-w-0 items-center gap-3">
        <div class="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-card">
          <img *ngIf="logo; else initialTemplate" [src]="logo" alt="" class="h-full w-full object-contain p-1" />
          <ng-template #initialTemplate>
            <span class="text-lg font-semibold text-primary" aria-hidden="true">{{ initial }}</span>
          </ng-template>
        </div>
        <div class="min-w-0">
          <h1 class="truncate text-[22px] font-semibold leading-tight text-foreground">{{ businessName }}</h1>
          <p class="mt-0.5 text-[13px] text-muted-foreground">{{ subtitle }}</p>
        </div>
      </div>

      <ul *ngIf="cashOpen !== null || signature" class="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-foreground/80" aria-label="Estado del negocio">
        <li *ngIf="cashOpen !== null" class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full" [ngClass]="cashOpen ? dots.success : dots.warning" aria-hidden="true"></span>
          {{ cashOpen ? 'Caja abierta' : 'Caja sin abrir' }}
        </li>
        <li *ngIf="signature" class="flex items-center gap-1.5">
          <span class="h-2 w-2 rounded-full" [ngClass]="dots[signature.tone]" aria-hidden="true"></span>
          Firma: {{ signature.label }}
        </li>
      </ul>
    </header>
  `
})
export class DashboardHeroComponent {
  @Input() businessName = 'Empresa activa';
  @Input() logo: string | null = null;
  @Input() subtitle = '';
  /** `null` oculta el estado de la firma. */
  @Input() signature: SignatureStatus | null = null;
  /** `null` oculta el estado de caja. */
  @Input() cashOpen: boolean | null = null;

  readonly dots = DOT_CLASSES;

  get initial(): string {
    return (this.businessName || 'E').trim().slice(0, 1).toUpperCase();
  }
}
