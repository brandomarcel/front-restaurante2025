import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { IconProp } from '@fortawesome/fontawesome-svg-core';

/**
 * Acción visible de un comprobante. Las reglas de visibilidad (permisos, estado
 * fiscal) se resuelven en la página; este componente solo las presenta.
 */
export interface DocumentAction {
  id: string;
  label: string;
  /** Texto para la barra móvil; por defecto se usa `label`. */
  shortLabel?: string;
  title?: string;
  variant: 'primary' | 'warn' | 'outline';
  icon?: IconProp;
  disabled?: boolean;
  run: () => void;
}

/** Botonera de un documento: en línea (cabecera) o barra fija inferior en móvil. */
@Component({
  selector: 'app-document-actions',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <ng-template #button let-action let-compact="compact">
      <button type="button" class="btn !px-3 !py-1.5 !text-[11px]"
        [ngClass]="{
          'btn-primary': action.variant === 'primary',
          'btn-warn': action.variant === 'warn',
          'btn-outline': action.variant === 'outline',
          'flex-1 shrink-0 whitespace-nowrap': compact
        }"
        [attr.title]="action.title || null" [disabled]="!!action.disabled" (click)="action.run()">
        <fa-icon *ngIf="action.icon" [icon]="action.icon" class="mr-1"></fa-icon>
        {{ compact ? (action.shortLabel || action.label) : action.label }}
      </button>
    </ng-template>

    <div *ngIf="layout === 'toolbar' && actions.length" class="flex flex-wrap items-center gap-1.5">
      <ng-container *ngFor="let action of actions; trackBy: trackById">
        <ng-container *ngTemplateOutlet="button; context: { $implicit: action }"></ng-container>
      </ng-container>
    </div>

    <div *ngIf="layout === 'mobile' && actions.length" role="toolbar" aria-label="Acciones del documento"
      class="fixed inset-x-0 bottom-0 z-40 flex gap-2 overflow-x-auto border-t border-border bg-card px-3 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.12)] md:hidden">
      <ng-container *ngFor="let action of actions; trackBy: trackById">
        <ng-container *ngTemplateOutlet="button; context: { $implicit: action, compact: true }"></ng-container>
      </ng-container>
    </div>
  `
})
export class DocumentActionsComponent {
  @Input() actions: DocumentAction[] = [];
  @Input() layout: 'toolbar' | 'mobile' = 'toolbar';

  trackById(_: number, action: DocumentAction): string {
    return action.id;
  }
}
