import { Directive, HostListener, inject } from '@angular/core';
import { NgControl } from '@angular/forms';

/** Convierte a MAYÚSCULAS un texto respetando acentos y ñ */
export function toUpperText(value: unknown): string {
  return String(value ?? '').toLocaleUpperCase('es-EC');
}

/**
 * Punto único para capturar nombres en MAYÚSCULAS (personas, razón social, etc.).
 * Transforma lo que se escribe o pega, sincroniza el FormControl y conserva
 * la posición del cursor. No usar en correos, contraseñas ni códigos.
 */
@Directive({
  selector: 'input[appUppercase], textarea[appUppercase]',
})
export class UppercaseDirective {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  @HostListener('input', ['$event.target'])
  onInput(target: EventTarget | null): void {
    const input = target as HTMLInputElement | HTMLTextAreaElement | null;
    if (!input) return;

    const upper = toUpperText(input.value);
    if (upper === input.value) return;

    const { selectionStart, selectionEnd } = input;
    input.value = upper;
    this.ngControl?.control?.setValue(upper);
    input.setSelectionRange(selectionStart, selectionEnd);
  }
}
