import { Directive, ElementRef, forwardRef, HostListener, Renderer2 } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Campo de texto que siempre se ve y se guarda en MAYÚSCULAS (nombres, identificaciones, direcciones, placa,
 * códigos y descripciones de los comprobantes). El backend también lo convierte al guardar (`api/text_case.py` de
 * Lite); esto es para que se vea igual mientras se escribe.
 *
 * Conserva el cursor y no toca el texto mientras se compone una letra con tilde (dead key / IME): convierte al
 * terminar la composición. No usar en correos, enlaces ni notas internas.
 */
@Directive({
  selector: 'input[appUppercase], textarea[appUppercase]',
  standalone: true,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => UppercaseInputDirective),
    multi: true
  }]
})
export class UppercaseInputDirective implements ControlValueAccessor {
  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;
  private composing = false;

  constructor(
    private readonly element: ElementRef<HTMLInputElement | HTMLTextAreaElement>,
    private readonly renderer: Renderer2
  ) {}

  writeValue(value: unknown): void {
    const text = value === null || value === undefined ? '' : String(value);
    this.renderer.setProperty(this.element.nativeElement, 'value', text.toUpperCase());
  }

  registerOnChange(fn: (value: string | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.renderer.setProperty(this.element.nativeElement, 'disabled', disabled); }

  @HostListener('compositionstart')
  onCompositionStart(): void { this.composing = true; }

  @HostListener('compositionend')
  onCompositionEnd(): void {
    this.composing = false;
    this.onInput();
  }

  @HostListener('input')
  onInput(): void {
    if (this.composing) return;
    const input = this.element.nativeElement;
    const upper = input.value.toUpperCase();
    if (input.value !== upper) {
      const { selectionStart, selectionEnd } = input;
      input.value = upper;
      // Mismo largo en español (á → Á, ñ → Ñ): el cursor queda donde estaba.
      if (selectionStart !== null && selectionEnd !== null) input.setSelectionRange(selectionStart, selectionEnd);
    }
    this.onChange(upper);
  }

  @HostListener('blur')
  onBlur(): void { this.onTouched(); }
}
