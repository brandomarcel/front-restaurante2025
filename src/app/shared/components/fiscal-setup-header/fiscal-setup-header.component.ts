import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { isActiveFiscalRecord, normalizeFiscalEnvironment, normalizeFiscalText } from 'src/app/core/utils/fiscal-setup';

export type FiscalSetupStep = 'establishments' | 'emission-points' | 'sequences';

interface StepView {
  id: FiscalSetupStep;
  number: number;
  label: string;
  hint: string;
  route: string;
  done: boolean;
}

/**
 * Cabecera común de la infraestructura fiscal. Muestra el negocio activo y el
 * recorrido Establecimiento → Punto de emisión → Secuencia con el estado real
 * de cada paso, para que el usuario sepa siempre dónde está y qué falta.
 */
@Component({
  selector: 'app-fiscal-setup-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <header class="rounded-xl border border-border bg-card shadow-sm">
      <div class="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <p class="text-[10px] font-bold uppercase tracking-wider text-primary">Infraestructura fiscal · {{ businessName }}</p>
          <h1 class="mt-0.5 text-lg font-bold text-foreground">{{ title }}</h1>
          <p class="mt-0.5 max-w-2xl text-xs text-muted-foreground">{{ description }}</p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-2">
          <ng-content select="[headerActions]"></ng-content>
        </div>
      </div>

      <nav *ngIf="step" aria-label="Pasos de la configuración fiscal" class="border-t border-border px-2 py-2">
        <ol class="grid grid-cols-3 gap-1">
          <li *ngFor="let item of steps">
            <a [routerLink]="item.route" [attr.aria-current]="item.id === step ? 'step' : null"
              class="flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-muted"
              [ngClass]="{ 'bg-primary/10': item.id === step }">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                [ngClass]="item.done ? 'bg-emerald-500 text-white' : (item.id === step ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')">
                {{ item.done ? '✓' : item.number }}
              </span>
              <span class="min-w-0">
                <span class="block truncate text-[11px] font-bold" [ngClass]="item.id === step ? 'text-primary' : 'text-foreground'">{{ item.label }}</span>
                <span class="hidden truncate text-[10px] text-muted-foreground sm:block">{{ item.hint }}</span>
              </span>
            </a>
          </li>
        </ol>
      </nav>

      <details *ngIf="hasHelp" class="group border-t border-border px-4 py-2 text-xs">
        <summary class="cursor-pointer list-none font-semibold text-muted-foreground hover:text-primary">
          <span class="mr-1 inline-block transition group-open:rotate-90">›</span>{{ helpTitle }}
        </summary>
        <div class="mt-2 space-y-1 leading-5 text-muted-foreground">
          <ng-content select="[help]"></ng-content>
        </div>
      </details>
    </header>
  `
})
export class FiscalSetupHeaderComponent {
  @Input() title = '';
  @Input() description = '';
  /** Paso actual; sin paso (por ejemplo, Integración API) no se muestra el recorrido. */
  @Input() step?: FiscalSetupStep;
  @Input() helpTitle = '¿Cómo funciona?';
  @Input() hasHelp = true;

  constructor(private capabilities: CompanyCapabilitiesService) {}

  get businessName(): string {
    const business = this.capabilities.activeBusiness;
    return String(business?.business_name || business?.businessname || business?.name || 'Sin negocio seleccionado');
  }

  get steps(): StepView[] {
    const establishments = this.capabilities.activeEstablishments;
    const hasPoints = establishments.some((item: any) => this.capabilities.activeEmissionPointsFor(item).length > 0);
    const business = this.capabilities.business || this.capabilities.activeBusiness;
    const environment = normalizeFiscalEnvironment(business?.environment || business?.ambiente || business?.tax_profile?.environment);
    const hasInvoiceSequence = this.capabilities.sequences.some((item: any) =>
      isActiveFiscalRecord(item)
      && normalizeFiscalText(item?.document_type) === 'FACTURA'
      && normalizeFiscalEnvironment(item?.environment) === environment);
    return [
      { id: 'establishments', number: 1, label: 'Establecimientos', hint: 'Matriz y sucursales', route: '/settings/lite/establishments', done: establishments.length > 0 },
      { id: 'emission-points', number: 2, label: 'Puntos de emisión', hint: 'Cajas que emiten', route: '/settings/lite/emission-points', done: hasPoints },
      { id: 'sequences', number: 3, label: 'Secuencias', hint: 'Numeración oficial', route: '/settings/lite/sequences', done: hasInvoiceSequence }
    ];
  }
}
