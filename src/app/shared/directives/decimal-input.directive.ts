import { Directive, ElementRef, forwardRef, HostListener, Renderer2 } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { normalizeDecimalText, parseLocalizedDecimal } from '../utils/decimal.utils';

/**
 * Campo decimal reutilizable para importes, precios y cantidades decimales.
 * Acepta coma o punto al escribir/pegar, pero guarda un `number` real en el
 * formulario para que los cálculos y payloads nunca dependan del locale.
 */
@Directive({
  selector: 'input[appDecimalInput]',
  standalone: true,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => DecimalInputDirective),
    multi: true
  }]
})
export class DecimalInputDirective implements ControlValueAccessor {
  private onChange: (value: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor(
    private readonly element: ElementRef<HTMLInputElement>,
    private readonly renderer: Renderer2
  ) {}

  writeValue(value: unknown): void {
    const numeric = parseLocalizedDecimal(value);
    this.renderer.setProperty(this.element.nativeElement, 'value', numeric === null ? '' : String(numeric));
  }

  registerOnChange(fn: (value: number | null) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(disabled: boolean): void { this.renderer.setProperty(this.element.nativeElement, 'disabled', disabled); }

  @HostListener('input')
  onInput(): void {
    const input = this.element.nativeElement;
    const normalized = normalizeDecimalText(input.value);
    if (normalized !== input.value) this.renderer.setProperty(input, 'value', normalized);
    this.onChange(parseLocalizedDecimal(normalized));
  }

  @HostListener('blur')
  onBlur(): void {
    const numeric = parseLocalizedDecimal(this.element.nativeElement.value);
    if (numeric !== null) this.renderer.setProperty(this.element.nativeElement, 'value', String(numeric));
    this.onChange(numeric);
    this.onTouched();
  }
}
