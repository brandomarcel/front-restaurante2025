import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { ClickOutsideDirective } from 'src/app/shared/directives/click-outside.directive';
import { fiscalSeries } from 'src/app/core/utils/fiscal-setup';

/**
 * Terminal POS activa del usuario, visible en la barra superior de toda la app.
 *
 * La terminal no es exclusiva del POS: también fija la serie al facturar desde
 * Facturación o desde una orden, la caja que se abre y la bodega de la que se
 * descuenta stock. Por eso hay un único selector global (antes vivía dentro del
 * menú de usuario y el POS tenía otro aparte).
 */
@Component({
  selector: 'app-pos-terminal-switcher',
  standalone: true,
  imports: [CommonModule, ClickOutsideDirective],
  template: `
    <div *ngIf="visible" class="relative" clickOutside (clickOutside)="open = false">
      <button type="button" (click)="toggle()" [attr.aria-expanded]="open" aria-haspopup="listbox"
        class="inline-flex min-h-[34px] max-w-[220px] items-center gap-1.5 rounded-lg border px-2 text-[11px] font-semibold shadow-sm transition"
        [ngClass]="state === 'ok' ? 'border-border bg-card text-foreground hover:bg-muted' : (state === 'blocked' ? 'border-red-300 bg-red-50 text-red-800' : 'border-amber-300 bg-amber-50 text-amber-900 animate-pulse')"
        [attr.title]="message || 'Terminal POS activa'">
        <span class="h-2 w-2 shrink-0 rounded-full" [ngClass]="state === 'ok' ? 'bg-emerald-500' : (state === 'blocked' ? 'bg-red-500' : 'bg-amber-500')" aria-hidden="true"></span>
        <ng-container *ngIf="active; else noTerminal">
          <span class="truncate">{{ active.terminal_name || active.name }}</span>
          <span class="hidden font-mono text-[10px] text-muted-foreground sm:inline">{{ series(active) }}</span>
        </ng-container>
        <ng-template #noTerminal><span class="truncate">{{ state === 'blocked' ? 'Sin terminal' : 'Elegir terminal' }}</span></ng-template>
        <span *ngIf="canChange" class="text-muted-foreground" aria-hidden="true">▾</span>
      </button>

      <div *ngIf="open" class="absolute right-0 z-[130] mt-1.5 w-72 rounded-xl border border-border bg-card p-2 shadow-lg" role="listbox" aria-label="Terminales POS">
        <p class="px-1.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Terminal POS</p>
        <p *ngIf="message" class="mb-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-900">{{ message }}</p>
        <button *ngFor="let terminal of terminals" type="button" role="option" [attr.aria-selected]="isActive(terminal)"
          (click)="select(terminal)"
          class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition"
          [ngClass]="isActive(terminal) ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'">
          <span class="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]"
            [ngClass]="isActive(terminal) ? 'border-primary bg-primary text-primary-foreground' : 'border-border'" aria-hidden="true">{{ isActive(terminal) ? '✓' : '' }}</span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">{{ terminal.terminal_name || terminal.name }}</span>
            <span class="block truncate text-[10px] text-muted-foreground">{{ series(terminal) }} · {{ terminal.establishment_name || 'Sin establecimiento' }}</span>
          </span>
        </button>
        <p *ngIf="terminals.length === 1" class="px-1.5 pt-1 text-[10px] text-muted-foreground">Es la única terminal disponible para ti.</p>
        <p *ngIf="canChange" class="px-1.5 pt-1 text-[10px] text-muted-foreground">Al cambiar de terminal la pantalla se recarga para mostrar el stock de su bodega.</p>
      </div>
    </div>
  `
})
export class PosTerminalSwitcherComponent {
  open = false;

  constructor(private readonly capabilities: CompanyCapabilitiesService) {}

  /** Solo aplica a negocios que trabajan con terminales POS. */
  get visible(): boolean {
    return this.capabilities.usesPosTerminalModel && (this.terminals.length > 0 || !!this.message);
  }

  get active(): any | null {
    return this.capabilities.activePosTerminal;
  }

  /** Terminales activas del usuario; incluye la elegida aunque ya no venga en la lista. */
  get terminals(): any[] {
    const terminals = this.capabilities.posTerminals.filter((item: any) => String(item?.status || 'Activo').trim().toUpperCase() === 'ACTIVO');
    const selected = this.active;
    if (selected && !terminals.some((item: any) => String(item?.name || '') === String(selected?.name || ''))) {
      return [selected, ...terminals];
    }
    return terminals;
  }

  get canChange(): boolean {
    return this.terminals.length > 1;
  }

  get message(): string {
    if (this.capabilities.terminalAccessRequired && !this.capabilities.hasTerminalAccess) {
      return 'No tienes una terminal POS activa asignada. Contacta al administrador.';
    }
    if (!this.active && (this.capabilities.requiresTerminalSelection || this.capabilities.needsPosTerminalSelection)) {
      return 'Elige la terminal desde la que vas a vender y facturar.';
    }
    return '';
  }

  get state(): 'ok' | 'pending' | 'blocked' {
    if (this.capabilities.terminalAccessRequired && !this.capabilities.hasTerminalAccess) return 'blocked';
    return this.active ? 'ok' : 'pending';
  }

  series(terminal: any): string {
    return fiscalSeries(terminal?.establishment_code, terminal?.emission_point_code);
  }

  isActive(terminal: any): boolean {
    return String(terminal?.name || '') === String(this.active?.name || '');
  }

  toggle(): void {
    this.open = !this.open;
  }

  select(terminal: any): void {
    if (this.isActive(terminal)) {
      this.open = false;
      return;
    }
    if (!this.capabilities.setActivePosTerminal(terminal)) return;
    this.open = false;
    // Cada terminal puede apuntar a otra bodega y a otra serie: recargar deja
    // stock, ubicación fiscal y carrito consistentes con la nueva terminal.
    this.reload();
  }

  /** Separado para poder probar la selección sin recargar el navegador. */
  protected reload(): void {
    window.location.reload();
  }
}
