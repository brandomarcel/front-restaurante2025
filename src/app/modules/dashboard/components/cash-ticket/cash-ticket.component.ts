import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CashSnapshot } from '../../dashboard.models';
import { CashBreakdown, cashBreakdown } from '../../utils/operations-metrics';

/**
 * Cuadre de la caja de quien mira, escrito como un ticket: fondo + efectivo
 * cobrado − retiros = lo que debe haber. Es la cuenta que el cajero hace al
 * cerrar; el backend ya la calcula (`expected_cash`), aquí solo se muestra.
 */
@Component({
  selector: 'app-cash-ticket',
  standalone: true,
  imports: [CommonModule, RouterModule],
  styles: [`
    :host { display: block; }
    /* Papel con borde dentado abajo, como el ticket del login. El contorno es
       drop-shadow para que siga los dientes; usa los tokens del tema. */
    .cash-ticket {
      position: relative;
      background: var(--card);
      color: var(--foreground);
      border-radius: 12px 12px 0 0;
      margin-bottom: 10px;
      filter: drop-shadow(1px 0 0 var(--border)) drop-shadow(-1px 0 0 var(--border))
        drop-shadow(0 1px 0 var(--border)) drop-shadow(0 -1px 0 var(--border));
    }
    .cash-ticket::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 100%;
      height: 9px;
      background-image: linear-gradient(135deg, var(--card) 33.33%, transparent 33.33%),
        linear-gradient(225deg, var(--card) 33.33%, transparent 33.33%);
      background-size: 18px 18px;
    }
    .cash-ticket__rule { border-top: 1px dashed var(--border); }
  `],
  template: `
    <article class="cash-ticket" aria-labelledby="cash-ticket-title">
      <div class="flex items-baseline justify-between gap-3 px-5 pb-3 pt-4">
        <h2 id="cash-ticket-title" class="text-[15px] font-semibold">Tu caja</h2>
        <span class="text-[13px]" [ngClass]="cash.isOpen ? 'text-success-700' : 'text-muted-foreground'">
          {{ cash.isOpen ? 'Abierta' : 'Sin abrir' }}
        </span>
      </div>

      <ng-container *ngIf="cash.isOpen; else closedTicket">
        <dl class="cash-ticket__rule space-y-2 px-5 py-4 text-sm tabular-nums">
          <div class="flex justify-between gap-4">
            <dt class="text-muted-foreground">Fondo inicial</dt>
            <dd>{{ breakdown.opening | currency:'USD':'symbol':'1.2-2' }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-muted-foreground">Cobrado en efectivo</dt>
            <dd><span class="text-muted-foreground" aria-hidden="true">+ </span>{{ breakdown.cashCollected | currency:'USD':'symbol':'1.2-2' }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-muted-foreground">Retiros</dt>
            <dd><span class="text-muted-foreground" aria-hidden="true">− </span>{{ breakdown.withdrawals | currency:'USD':'symbol':'1.2-2' }}</dd>
          </div>
        </dl>

        <div class="cash-ticket__rule flex items-baseline justify-between gap-4 px-5 py-4 tabular-nums">
          <p class="text-sm font-medium">Debe haber en caja</p>
          <p class="text-[22px] font-semibold leading-none">{{ breakdown.expected | currency:'USD':'symbol':'1.2-2' }}</p>
        </div>

        <div *ngIf="breakdown.otherPayments.length" class="cash-ticket__rule px-5 py-4 text-sm tabular-nums">
          <p class="mb-2 text-[13px] text-muted-foreground">Otros cobros (no entran a la caja)</p>
          <dl class="space-y-1.5">
            <div *ngFor="let payment of breakdown.otherPayments" class="flex justify-between gap-4">
              <dt class="truncate">{{ payment.method }}</dt>
              <dd>{{ payment.amount | currency:'USD':'symbol':'1.2-2' }}</dd>
            </div>
          </dl>
          <div class="mt-3 flex justify-between gap-4 font-medium">
            <span>Total cobrado en el turno</span>
            <span>{{ breakdown.collectedTotal | currency:'USD':'symbol':'1.2-2' }}</span>
          </div>
        </div>

        <div *ngIf="canOperate" class="cash-ticket__rule flex flex-wrap gap-2 px-5 pb-5 pt-4">
          <a routerLink="/caja/retiro" class="btn btn-outline !h-9 !text-[13px]">Registrar retiro</a>
          <a routerLink="/caja/cierre" class="btn btn-outline !h-9 !text-[13px]">Cerrar caja</a>
        </div>
      </ng-container>

      <ng-template #closedTicket>
        <div class="cash-ticket__rule px-5 pb-5 pt-4">
          <p class="text-sm">No tienes una caja abierta.</p>
          <p class="mt-1 text-[13px] text-muted-foreground">El cuadre del turno aparece aquí cuando la abres con el fondo inicial.</p>
          <a *ngIf="canOperate" routerLink="/caja/apertura" class="btn btn-primary mt-4 !h-9 !text-[13px]">Abrir caja</a>
        </div>
      </ng-template>
    </article>
  `
})
export class CashTicketComponent implements OnChanges {
  @Input({ required: true }) cash!: CashSnapshot;
  /** Puede abrir, retirar y cerrar (`restaurant.cash.manage` o `restaurant.manage`). */
  @Input() canOperate = false;

  breakdown!: CashBreakdown;

  ngOnChanges(): void {
    this.breakdown = cashBreakdown(this.cash);
  }
}
