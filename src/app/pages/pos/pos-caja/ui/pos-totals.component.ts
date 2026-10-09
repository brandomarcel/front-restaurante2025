import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

/** Resumen de importes de la venta. Los valores los calcula el POS; aquí solo se muestran. */
@Component({
  selector: 'app-pos-totals',
  standalone: true,
  imports: [CommonModule],
  template: `
    <dl class="space-y-0.5 text-[11px] text-muted-foreground">
      <div class="flex justify-between"><dt>Subtotal</dt><dd>\${{ subtotal | number:'1.2-2' }}</dd></div>
      <div *ngIf="discount > 0" class="flex justify-between text-emerald-600"><dt>Descuento</dt><dd>-\${{ discount | number:'1.2-2' }}</dd></div>
      <div class="flex justify-between"><dt>IVA</dt><dd>\${{ iva | number:'1.2-2' }}</dd></div>
      <div class="mt-1.5 flex items-end justify-between border-t border-border pt-1.5">
        <dt class="text-[11px] font-semibold text-foreground">Total</dt>
        <dd class="font-black leading-none text-primary" [ngClass]="large ? 'text-3xl' : 'text-2xl'">\${{ total | number:'1.2-2' }}</dd>
      </div>
    </dl>
  `
})
export class PosTotalsComponent {
  @Input() subtotal = 0;
  @Input() discount = 0;
  @Input() iva = 0;
  @Input() total = 0;
  @Input() large = false;
}
