import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { finalize } from 'rxjs';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { ProductsService } from 'src/app/services/products.service';
import { CartService } from 'src/app/pages/pos/services/cart.service';

/**
 * Input de escaneo para POS. El lector USB actúa como teclado y envía Enter
 * al terminar: no requiere SDK ni integración con hardware. Se mantiene
 * enfocado por defecto y permite ingreso manual como respaldo.
 */
@Component({
  selector: 'app-barcode-scan-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './barcode-scan-input.component.html'
})
export class BarcodeScanInputComponent {
  @ViewChild('scanInput') scanInputRef?: ElementRef<HTMLInputElement>;

  /** true = ocupa el ancho disponible y se presenta como el buscador principal (modo Retail). */
  @Input() wide = false;
  /**
   * "cart" (por defecto): resuelve el código contra el backend y agrega al
   * carrito de POS, tal como hoy. "emit": no consulta nada ni depende del
   * carrito — solo entrega el código escaneado tal cual mediante
   * `codeScanned`, para pantallas ajenas al POS (ej. búsqueda de stock).
   */
  @Input() mode: 'cart' | 'emit' = 'cart';
  @Output() codeScanned = new EventEmitter<string>();

  value = '';
  scanning = false;

  constructor(
    private readonly productsService: ProductsService,
    private readonly cartService: CartService,
    private readonly capabilities: CompanyCapabilitiesService
  ) {}

  focus(): void {
    setTimeout(() => this.scanInputRef?.nativeElement?.focus(), 0);
  }

  scan(): void {
    const code = this.value.trim();
    this.value = '';
    // No se consulta nada si está vacío ni mientras otra consulta está en
    // progreso: evita disparar el mismo código dos veces por un doble Enter.
    if (!code || this.scanning) {
      this.focus();
      return;
    }
    if (this.mode === 'emit') {
      this.codeScanned.emit(code);
      this.focus();
      return;
    }
    const business = this.capabilities.activeBusinessId;
    if (!business) {
      toast.error('Selecciona un negocio antes de escanear.');
      this.focus();
      return;
    }
    // `pos_terminal` tiene prioridad; `warehouse` solo aplica cuando el
    // negocio no usa el modelo de terminales.
    const posTerminal = this.capabilities.usesPosTerminalModel
      ? String(this.capabilities.activePosTerminal?.name || '').trim()
      : '';
    const warehouse = !posTerminal
      ? String(this.capabilities.activeWarehouse?.name || '').trim()
      : '';

    this.scanning = true;
    this.productsService.getProductoByBarcode({ barcode: code, posTerminal, warehouse }).pipe(
      finalize(() => {
        this.scanning = false;
        this.focus();
      })
    ).subscribe({
      next: (result) => {
        if (!result.found || !result.data) {
          toast.error(`Código no encontrado: ${result.scanned_code || code}`);
          return;
        }
        const product = result.data;
        if (product.can_sell === false) {
          toast.error('Sin stock en la bodega activa.');
          return;
        }
        if (!this.cartService.addProduct(product)) {
          toast.error('No hay suficiente stock disponible para agregar este producto.');
        }
      },
      error: () => toast.error('No se pudo consultar el código escaneado.')
    });
  }
}
