import { Directive, HostListener } from '@angular/core';

/** Teclas de edición/navegación que nunca deben bloquearse */
const ALLOWED_KEYS = new Set([
  'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
  'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End',
]);

/**
 * Restringe un input de texto a dígitos (RUC, códigos SRI, teléfonos).
 * Permite atajos (Ctrl/Cmd+C/V/X/A/Z), limpia lo pegado en lugar de rechazarlo
 * y depura valores que lleguen por autocompletado o teclados móviles.
 */
@Directive({
  selector: '[appOnlyNumbers]'
})
export class OnlyNumbersDirective {
  @HostListener('keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (ALLOWED_KEYS.has(event.key)) return;
    // Teclados móviles/IME reportan "Unidentified"; el filtro de 'input' lo cubre
    if (event.key === 'Unidentified' || event.isComposing) return;

    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  @HostListener('paste', ['$event'])
  onPaste(event: ClipboardEvent): void {
    const input = event.target as HTMLInputElement;
    const pasted = event.clipboardData?.getData('text') ?? '';
    const digits = pasted.replace(/\D/g, '');
    if (digits === pasted) return; // pegado limpio: comportamiento nativo

    event.preventDefault();
    if (!digits) return;
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const room = input.maxLength > 0 ? input.maxLength - (input.value.length - (end - start)) : digits.length;
    input.setRangeText(digits.slice(0, Math.max(0, room)), start, end, 'end');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /** Red de seguridad: autocompletado, arrastrar/soltar o teclados que no emiten keydown */
  @HostListener('input', ['$event'])
  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');
    if (digits === input.value) return;
    input.value = digits;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
