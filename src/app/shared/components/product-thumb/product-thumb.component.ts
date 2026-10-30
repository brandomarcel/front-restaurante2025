import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * Imagen de un producto que llena su contenedor. Sin imagen muestra el nombre
 * del producto en su lugar (un cuadro vacío no informa nada). Quien lo usa
 * decide el tamaño y el fondo del contenedor.
 */
@Component({
  selector: 'app-product-thumb',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img *ngIf="imageUrl; else nameOnly" [src]="imageUrl" [alt]="name" class="pointer-events-none h-full w-full object-cover" loading="lazy" />
    <ng-template #nameOnly>
      <span class="pointer-events-none line-clamp-3 break-words px-2 pb-1 pt-4 text-center text-[13px] font-bold leading-4 text-foreground" [attr.title]="name">{{ name }}</span>
    </ng-template>
  `,
  styles: [':host { display: flex; height: 100%; width: 100%; align-items: center; justify-content: center; }']
})
export class ProductThumbComponent {
  @Input() imageUrl?: string | null;
  @Input() name = '';
}
