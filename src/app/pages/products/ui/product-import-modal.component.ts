import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { finalize } from 'rxjs';
import { AlertService } from 'src/app/core/services/alert.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import {
  ProductImportConfirmResult,
  ProductImportMode,
  ProductImportPreview,
  ProductImportRow,
} from 'src/app/models/product-import';
import { ProductsService } from 'src/app/services/products.service';

/**
 * Carga masiva de productos desde Excel, en tres pasos: plantilla → validar →
 * confirmar. Nunca se confirma un archivo con filas inválidas. La lógica se movió
 * sin cambios desde ProductsComponent; el permiso lo valida quien lo abre.
 */
@Component({
  selector: 'app-product-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-import-modal.component.html'
})
export class ProductImportModalComponent {
  @Input() inventoryEnabled = false;
  @Output() closed = new EventEmitter<void>();
  /** Se importaron productos: el catálogo debe recargarse. */
  @Output() imported = new EventEmitter<ProductImportConfirmResult>();

  importMode: ProductImportMode = 'create_only';
  importFile: File | null = null;
  importDownloading = false;
  importValidating = false;
  importConfirming = false;
  importError = '';
  importPreview: ProductImportPreview | null = null;
  importResult: ProductImportConfirmResult | null = null;
  /** Vista de la previsualización: todas las filas o solo las que tienen error. */
  rowsFilter: 'all' | 'errors' = 'all';

  readonly modes: Array<{ value: ProductImportMode; label: string; help: string }> = [
    { value: 'create_only', label: 'Solo crear nuevos', help: 'Si un código ya existe, esa fila se rechaza.' },
    { value: 'upsert', label: 'Crear y actualizar', help: 'Si un código ya existe, se actualizan sus datos.' }
  ];

  constructor(
    private readonly productsService: ProductsService,
    private readonly alertService: AlertService,
    private readonly frappeErrorService: FrappeErrorService
  ) {}

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.importConfirming) this.close();
  }

  close(): void {
    this.closed.emit();
  }

  get visibleRows(): ProductImportRow[] {
    const rows = this.importPreview?.rows || [];
    return this.rowsFilter === 'errors' ? rows.filter((row) => row.errors?.length) : rows;
  }

  /** Cambiar el archivo o el modo invalida cualquier previsualización anterior: hay que validar de nuevo. */
  onImportModeChange(): void {
    this.importPreview = null;
    this.importResult = null;
    this.importError = '';
  }

  setMode(mode: ProductImportMode): void {
    if (this.importMode === mode) return;
    this.importMode = mode;
    this.onImportModeChange();
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files && input.files.length ? input.files[0] : null;
    input.value = '';
    this.acceptFile(file);
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    this.acceptFile(event.dataTransfer?.files?.[0] || null);
  }

  private acceptFile(file: File | null): void {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) {
      this.alertService.error('El archivo debe tener extensión .xlsx.');
      return;
    }

    this.importFile = file;
    this.importPreview = null;
    this.importResult = null;
    this.importError = '';
    this.rowsFilter = 'all';
  }

  removeFile(): void {
    this.importFile = null;
    this.importPreview = null;
    this.importError = '';
  }

  descargarPlantillaImportacion(): void {
    this.importDownloading = true;
    this.productsService.downloadProductImportTemplate().pipe(
      finalize(() => this.importDownloading = false)
    ).subscribe({
      next: (blob: Blob) => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'plantilla-carga-masiva-productos.xlsx';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      },
      error: (err) => this.alertService.error(this.frappeErrorService.handle(err) || 'No se pudo descargar la plantilla.')
    });
  }

  validarImportacion(): void {
    if (!this.importFile || this.importValidating) return;

    this.importValidating = true;
    this.importError = '';
    this.importResult = null;
    this.productsService.previewProductImport(this.importMode, this.importFile).pipe(
      finalize(() => this.importValidating = false)
    ).subscribe({
      next: (preview: ProductImportPreview) => {
        this.importPreview = preview;
        this.rowsFilter = preview?.summary?.invalid > 0 ? 'errors' : 'all';
        if (!preview?.summary?.total) {
          toast.warning('El archivo no tiene filas para importar.');
        } else if (preview.summary.invalid > 0) {
          toast.warning(`${preview.summary.invalid} fila(s) con error. Corrígelas antes de confirmar.`);
        } else {
          toast.success('Archivo validado sin errores.');
        }
      },
      error: (err) => {
        this.importPreview = null;
        this.importError = this.frappeErrorService.handle(err) || 'No se pudo validar el archivo.';
      }
    });
  }

  /**
   * Atributos legibles de la fila. El backend puede devolver `atributos` como
   * texto plano ("Color=Negro,Talla=M") o ya parseado en un arreglo de
   * objetos `{attribute, value}` (el mismo formato que usa el formulario de
   * variantes) — hay que soportar ambos, nunca convertir el arreglo a string
   * directamente o se muestra "[object Object]".
   */
  importRowAttributes(row: ProductImportRow): string {
    const source: any = row.atributos ?? row.attributes;
    if (!source) return '';
    if (Array.isArray(source)) {
      return source
        .map((item: any) => {
          if (item && typeof item === 'object') {
            const attr = String(item.attribute ?? item.atributo ?? item.name ?? '').trim();
            const value = String(item.value ?? item.valor ?? '').trim();
            return attr && value ? `${attr}: ${value}` : '';
          }
          return String(item ?? '').trim();
        })
        .filter(Boolean)
        .join(' · ');
    }
    const raw = String(source).trim();
    if (!raw) return '';
    return raw.split(',').map((pair) => pair.trim().replace('=', ': ')).filter(Boolean).join(' · ');
  }

  importRowMinimumStock(row: ProductImportRow): number | null {
    const value = row.stock_minimo ?? row.minimum_stock;
    return value === undefined || value === null ? null : Number(value);
  }

  /**
   * Un producto agrupador (no es variante, pero otras filas del mismo
   * archivo lo referencian como `parent_code`) nunca maneja stock propio: el
   * stock real vive en cada variante. Mostrarlo igual que una fila normal
   * confunde al usuario ("¿por qué este producto tiene stock 0?").
   */
  isImportGrouperRow(row: ProductImportRow): boolean {
    if (!this.importPreview || row.is_variant) return false;
    return this.importPreview.rows.some((item) => item.parent_code === row.code && item.is_variant);
  }

  get importHasVariants(): boolean {
    return !!this.importPreview?.rows?.some((row) => row.is_variant);
  }

  get canConfirmImport(): boolean {
    return !!this.importFile
      && !!this.importPreview?.can_confirm
      && !this.importValidating
      && !this.importConfirming;
  }

  confirmarImportacion(): void {
    // Nunca importar con errores pendientes, aunque `can_confirm` viniera mal.
    if (!this.canConfirmImport || !this.importFile || (this.importPreview?.summary?.invalid ?? 0) > 0) return;

    this.importConfirming = true;
    this.importError = '';
    // Se reutiliza el mismo File ya validado; no se reconstruye ningún JSON.
    this.productsService.confirmProductImport(this.importMode, this.importFile).pipe(
      finalize(() => this.importConfirming = false)
    ).subscribe({
      next: (result: ProductImportConfirmResult) => {
        this.importResult = result;
        toast.success(
          `Importación completa: ${result.created} creado(s), ${result.updated} actualizado(s)` +
          (result.stock_movements ? `, ${result.stock_movements} movimiento(s) de stock` : '') + '.'
        );
        this.importFile = null;
        this.importPreview = null;
        // El resumen de inventario vive en la pantalla de Inventario; se
        // recarga solo al entrar ahí, no hace falta duplicarlo acá.
        this.imported.emit(result);
      },
      error: (err) => {
        this.importError = this.frappeErrorService.handle(err) || 'No se pudo confirmar la importación.';
      }
    });
  }

  trackByRow = (_: number, row: ProductImportRow) => row.row_number;
}
