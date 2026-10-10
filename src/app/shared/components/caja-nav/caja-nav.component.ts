import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';

export type CajaSection = 'apertura' | 'retiro' | 'cierre' | 'gestion';
/** Estado del turno del usuario, según lo que consultó la pantalla actual. */
export type CajaTurnState = 'loading' | 'open' | 'closed' | 'unknown';

/**
 * Navegación común de Caja. Las tres pantallas del turno (abrir → retiros →
 * cerrar) se leen como pasos de un mismo flujo, con el estado de la caja
 * siempre a la vista. "Gestión de cajas" solo aparece a quien puede verla
 * (mismos permisos que su ruta).
 */
@Component({
  selector: 'app-caja-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav aria-label="Secciones de caja" class="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-card p-1 shadow-sm">
      <a *ngFor="let step of steps; let i = index" [routerLink]="step.route" [attr.aria-current]="step.id === active ? 'page' : null"
        class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition"
        [ngClass]="step.id === active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'">
        <span class="flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold"
          [ngClass]="step.id === active ? 'bg-primary-foreground/20' : 'bg-muted text-foreground/70'" aria-hidden="true">{{ i + 1 }}</span>
        {{ step.label }}
      </a>
      <a *ngIf="canManage" routerLink="/caja/gestion" [attr.aria-current]="active === 'gestion' ? 'page' : null"
        class="whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:ml-1 sm:border-l sm:border-border sm:pl-3"
        [ngClass]="active === 'gestion' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'">
        Gestión de cajas
      </a>
      <span *ngIf="active !== 'gestion'" class="ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" role="status"
        [ngClass]="state === 'open' ? 'bg-emerald-100 text-emerald-800' : (state === 'loading' ? 'bg-muted text-muted-foreground' : 'bg-amber-100 text-amber-900')">
        <span class="h-2 w-2 rounded-full" [ngClass]="state === 'open' ? 'bg-emerald-500 animate-pulse' : (state === 'loading' ? 'bg-muted-foreground/50' : 'bg-amber-500')" aria-hidden="true"></span>
        {{ state === 'open' ? 'Caja abierta' : (state === 'loading' ? 'Consultando…' : 'Caja cerrada') }}
        <span *ngIf="state === 'open' && opening" class="hidden font-mono text-[10px] font-normal sm:inline">· {{ opening }}</span>
      </span>
    </nav>
  `
})
export class CajaNavComponent {
  @Input() active: CajaSection = 'apertura';
  @Input() state: CajaTurnState = 'loading';
  /** Id de la apertura activa, para identificar el turno. */
  @Input() opening = '';

  readonly steps: ReadonlyArray<{ id: CajaSection; label: string; route: string }> = [
    { id: 'apertura', label: 'Abrir', route: '/caja/apertura' },
    { id: 'retiro', label: 'Retiros', route: '/caja/retiro' },
    { id: 'cierre', label: 'Cerrar', route: '/caja/cierre' }
  ];

  constructor(private readonly capabilities: CompanyCapabilitiesService) {}

  get canManage(): boolean {
    return this.capabilities.isEnabled('cash_register')
      && (this.capabilities.hasPermission('*')
        || this.capabilities.hasPermission('restaurant.manage')
        || this.capabilities.hasPermission('billing.manage'));
  }
}
