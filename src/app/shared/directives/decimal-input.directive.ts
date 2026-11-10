import { Directive, ElementRef, forwardRef, HostListener, Renderer2 } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { formatDecimalForInput, minDecimalsFromStep, normalizeDecimalText, parseLocalizedDecimal } from '../utils/decimal.utils';

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
    const input = this.element.nativeElement;
    const numeric = parseLocalizedDecimal(value);
    // Mientras se escribe, no reescribir el texto si ya vale lo mismo («5,» o «5.0» siguen tal cual).
    if (document.activeElement === input && numeric !== null && parseLocalizedDecimal(input.value) === numeric) return;
    this.renderer.setProperty(input, 'value', numeric === null ? '' : this.format(numeric));
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
    if (numeric !== null) this.renderer.setProperty(this.element.nativeElement, 'value', this.format(numeric));
    this.onChange(numeric);
    this.onTouched();
  }

  /** Montos con `step="0.01"` se muestran con dos decimales (5.5 → «5.50»); el modelo sigue siendo `number`. */
  private format(numeric: number): string {
    return formatDecimalForInput(numeric, minDecimalsFromStep(this.element.nativeElement.getAttribute('step')));
  }
}
