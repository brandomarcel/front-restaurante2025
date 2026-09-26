import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export type IconActionVariant = 'edit' | 'delete' | 'view' | 'duplicate' | 'add';
export type IconActionTone = 'outline' | 'warn' | 'primary';

/**
 * Botón de acción de un solo ícono para tablas (Editar, Eliminar, Ver,
 * Duplicar...), pensado para no ocupar el espacio de un botón con texto en
 * filas angostas. Tiene su propia paleta (no reutiliza `.btn-outline`/
 * `.btn-warn`): así "Eliminar" siempre es rojo, sin importar qué otro botón
 * de texto use ese mismo tono en el resto de la app.
 */
@Component({
  selector: 'app-icon-action-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './icon-action-button.component.html'
})
export class IconActionButtonComponent {
  @Input() variant: IconActionVariant = 'edit';
  /** Solo se usa para 'primary' (ej: Editar destacado); eliminar siempre es rojo, sin importar este valor. */
  @Input() tone: IconActionTone = 'outline';
  /** Texto de accesibilidad y tooltip. Si no se pasa, se infiere del variant. */
  @Input() label = '';
  @Input() disabled = false;
  @Output() action = new EventEmitter<void>();

  get resolvedLabel(): string {
    if (this.label) return this.label;
    switch (this.variant) {
      case 'edit': return 'Editar';
      case 'delete': return 'Eliminar';
      case 'view': return 'Ver';
      case 'duplicate': return 'Duplicar';
      case 'add': return 'Agregar';
      default: return '';
    }
  }

  /**
   * Solo usa tokens de tema (`bg-card`, `text-destructive`, etc.), nunca el
   * prefijo `dark:` de Tailwind: el switch claro/oscuro cambia una clase
   * `.dark` en `<html>`, y `dark:` en este proyecto solo responde al tema
   * del sistema operativo, no a ese switch.
   */
  get toneClasses(): string {
    if (this.variant === 'delete') {
      return 'border-destructive/30 bg-destructive/10 text-destructive hover:border-destructive/50 hover:bg-destructive/20';
    }
    if (this.tone === 'primary') {
      return 'border-primary bg-primary text-primary-foreground hover:bg-primary/90';
    }
    return 'border-border bg-card text-foreground/80 hover:border-muted-foreground/40 hover:bg-muted';
  }

  onClick(): void {
    if (this.disabled) return;
    this.action.emit();
  }
}
