import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgSelectModule } from '@ng-select/ng-select';
import { NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { InventoryMovement, InventoryMovementPayload, InventoryMovementType, InventoryProduct, InventorySummary, LiteStockMovementPayload } from 'src/app/models/inventory';
import { Product } from 'src/app/core/models/product';
import { AlertService } from 'src/app/core/services/alert.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { ProductsService } from 'src/app/services/products.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { forkJoin } from 'rxjs';
import {
  canSellProduct,
  getInventoryUnit,
  hasInventoryControl,
  isLowStockProduct,
  isOutOfStockProduct,
  toInventoryNumber,
} from 'src/app/shared/utils/inventory.utils';
import { formatVariantAttributes } from 'src/app/shared/utils/product-variants.utils';

@Component({
  selector: 'app-inventory',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgSelectModule],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css'
})
export class InventoryComponent implements OnInit {
  readonly movementTypeMeta: Record<InventoryMovementType, { label: string; description: string }> = {
    Entrada: {
      label: 'Ingreso de stock',
      description: 'Cuando llego mercaderia, compra o reposicion.',
    },
    Salida: {
      label: 'Salida manual',
      description: 'Cuando sale producto por merma, perdida o uso no comercial.',
    },
    Ajuste: {
      label: 'Correccion de stock',
      description: 'Cuando quieres corregir una diferencia hacia arriba o abajo.',
    },
    Venta: {
      label: 'Descuento por venta',
      description: 'Uso excepcional si necesitas registrar una venta manualmente.',
    },
    'Reversa Venta': {
      label: 'Devolver por venta anulada',
      description: 'Cuando una venta se revierte y el producto vuelve al inventario.',
    },
    Consumo: {
      label: 'Consumo interno',
      description: 'Cuando el negocio usa producto y no va a una venta directa.',
    },
    Devolucion: {
      label: 'Devolucion al inventario',
      description: 'Cuando el producto regresa y vuelve a estar disponible.',
    },
  };

  readonly inventoryTabs = [
    { key: 'overview', label: 'Resumen y stock' },
    { key: 'history', label: 'Historial' },
  ] as const;

  readonly movementTypes: InventoryMovementType[] = [
    'Entrada',
    'Salida',
    'Ajuste',
    'Venta',
    'Reversa Venta',
    'Consumo',
    'Devolucion',
  ];

  inventoryProducts: InventoryProduct[] = [];
  productOptions: Product[] = [];
  /**
   * Igual que `productOptions`, con una etiqueta ya armada (nombre + contexto
   * de variante) para el buscador de `ng-select`. Se recalcula una sola vez
   * al cargar las opciones, nunca como getter leído desde el template: eso
   * ya nos causó un bucle infinito de renderizado en Productos (ver
   * `products.component.ts`).
   */
  productSelectOptions: Array<Product & { displayLabel: string }> = [];
  movements: InventoryMovement[] = [];
  inventorySummary: InventorySummary | null = null;
  activeTab: 'overview' | 'history' = 'overview';

  search = '';
  onlyLowStock = false;
  onlyActive = true;

  historyProduct = '';
  historyMovementType = '';
  historyLimit = 20;
  historyOffset = 0;
  historyLoadingMore = false;
  /** false mientras la última página traiga exactamente `historyLimit` filas: puede haber más. */
  historyHasMore = true;
  /** true si el backend respondió con un error de permisos: no se vuelve a intentar solo. */
  historyAccessDenied = false;

  showMovementModal = false;
  showOptionalReferenceFields = false;
  submittedMovement = false;
  movementForm!: FormGroup;

  constructor(
    private inventoryService: InventoryService,
    private productsService: ProductsService,
    private fb: FormBuilder,
    private spinner: NgxSpinnerService,
    private frappeErrorService: FrappeErrorService,
    private alertService: AlertService,
    private capabilities: CompanyCapabilitiesService
  ) { }

  ngOnInit(): void {
    this.initMovementForm();
    if (!this.inventoryEnabled) return;
    this.cargarProductosInventario();
    this.cargarOpcionesProducto();
    this.cargarMovimientos();
  }

  get movementItems(): FormArray {
    return this.movementForm.get('items') as FormArray;
  }

  get controlledProductsCount(): number {
    return this.inventoryProducts.length || Number(this.inventorySummary?.tracked_items ?? this.inventorySummary?.controlled_products ?? 0) || 0;
  }

  get lowStockCount(): number {
    const calculated = this.inventoryProducts.filter((item) => this.isLowStock(item)).length;
    return calculated || Number(this.inventorySummary?.low_stock_items ?? this.inventorySummary?.low_stock_products ?? 0) || 0;
  }

  get outOfStockCount(): number {
    const calculated = this.inventoryProducts.filter((item) => this.isOutOfStock(item)).length;
    const summaryValue = Array.isArray(this.inventorySummary?.out_of_stock_items)
      ? this.inventorySummary?.out_of_stock_items.length
      : Number(this.inventorySummary?.out_of_stock_items ?? this.inventorySummary?.out_of_stock_products ?? 0);
    return calculated || summaryValue || 0;
  }

  get inventoryEnabled(): boolean {
    return this.capabilities.isEnabled('inventory');
  }

  get canManageInventory(): boolean {
    return this.inventoryEnabled && this.capabilities.hasPermission('inventory.manage');
  }

  get isLiteMode(): boolean {
    return this.capabilities.isLiteMode;
  }

  get supportedMovementTypes(): InventoryMovementType[] {
    return this.isLiteMode ? ['Entrada', 'Salida', 'Ajuste'] : this.movementTypes;
  }

  get attentionProductsCount(): number {
    return this.inventoryProducts.filter((item) => this.isLowStock(item) || this.isOutOfStock(item)).length;
  }

  get availableProductsCount(): number {
    return this.inventoryProducts.filter((item) => this.canSell(item)).length;
  }

  get currentMovementType(): InventoryMovementType {
    return this.movementForm.get('movement_type')?.value as InventoryMovementType;
  }

  get historyRangeLabel(): string {
    if (!this.movements.length) return 'Sin movimientos';
    return `${this.movements.length} movimiento(s) cargado(s)`;
  }

  /** "Cargar más": suma el límite al offset y agrega al final, sin reemplazar lo ya cargado. */
  cargarMasMovimientos(): void {
    if (!this.historyHasMore || this.historyLoadingMore || this.historyAccessDenied) return;
    this.historyOffset += this.historyLimit;
    this.cargarMovimientos(true);
  }

  initMovementForm(): void {
    this.movementForm = this.fb.group({
      movement_type: ['Entrada', Validators.required],
      notes: [''],
      reference_doctype: [''],
      reference_name: [''],
      items: this.fb.array([this.createMovementItem()])
    });
  }

  createMovementItem(): FormGroup {
    return this.fb.group({
      product: ['', Validators.required],
      quantity: [1, Validators.required],
      target_stock: [null],
    });
  }

  cargarProductosInventario(): void {
    this.spinner.show();
    if (this.isLiteMode) {
      forkJoin({
        // `flatten_variants`: acá se administra el stock real, que vive en
        // las variantes, no en el producto agrupador (siempre en 0). Antes
        // esta llamada ignoraba `search`/`onlyLowStock`/`onlyActive`: los
        // filtros de la pantalla no hacían nada.
        products: this.productsService.getAll(
          this.onlyActive ? 1 : null,
          undefined,
          0,
          this.search,
          undefined,
          undefined,
          this.onlyLowStock,
          true
        ),
        summary: this.inventoryService.getStockSummary()
      }).subscribe({
        next: ({ products, summary }: any) => {
          const productList = this.extractList(products, ['message', 'data']) as InventoryProduct[];
          const summaryData = this.extractData(summary) as InventorySummary;
          this.inventorySummary = summaryData || null;
          const summaryProducts = (summaryData?.products || summaryData?.items || []) as InventoryProduct[];
          const merged = productList.map((product) => {
            const fromSummary = summaryProducts.find((item) => item.name === product.name);
            return fromSummary ? { ...product, ...fromSummary } : product;
          });
          this.inventoryProducts = merged.filter((product) => this.hasInventory(product));
        },
        error: (error) => {
          this.alertService.error(this.frappeErrorService.handle(error));
          this.spinner.hide();
        },
        complete: () => this.spinner.hide()
      });
      return;
    }

    this.inventoryService.getInventoryProducts({
      search: this.search || undefined,
      onlyLowStock: this.onlyLowStock,
      onlyActive: this.onlyActive,
    }).subscribe({
      next: (res: any) => {
        const data = this.extractList(res, ['message', 'data']);
        this.inventoryProducts = ((Array.isArray(data) ? data : []) as InventoryProduct[])
          .filter((product) => this.hasInventory(product));
      },
      error: (error) => {
        const mensaje = this.frappeErrorService.handle(error);
        this.alertService.error(mensaje);
        this.spinner.hide();
      },
      complete: () => {
        this.spinner.hide();
      }
    });
  }

  cargarOpcionesProducto(): void {
    this.productsService.getAll(1, undefined, 0, '', undefined, undefined, false, true).subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : (res?.message?.data || []);
        this.productOptions = ((Array.isArray(data) ? data : []) as Product[])
          .filter((product) => this.hasInventory(product));
        this.productSelectOptions = this.productOptions.map((product) => ({
          ...product,
          displayLabel: this.describeProductOption(product)
        }));
      },
      error: () => {
        this.productOptions = [];
        this.productSelectOptions = [];
      }
    });
  }

  /**
   * `append = false` (filtro nuevo, carga inicial o tras crear un movimiento)
   * reemplaza la lista desde `offset = 0`. `append = true` ("Cargar más") la
   * agrega al final sin tocar lo ya cargado.
   */
  cargarMovimientos(append = false): void {
    if (this.historyAccessDenied) return;
    if (append) this.historyLoadingMore = true;
    else this.spinner.show();

    this.inventoryService.getInventoryMovements({
      limit: this.historyLimit,
      offset: this.historyOffset,
      product: this.historyProduct || undefined,
      movementType: this.historyMovementType || undefined,
    }).subscribe({
      next: (res: any) => {
        const list = this.extractList(res, ['message', 'data']);
        const page = (Array.isArray(list) ? list : []) as InventoryMovement[];
        this.movements = append ? [...this.movements, ...page] : page;
        // Si la página trae menos filas que el límite, no hay más para cargar.
        this.historyHasMore = page.length >= this.historyLimit;
      },
      error: (error) => {
        if (this.isPermissionError(error)) {
          this.historyAccessDenied = true;
          this.historyHasMore = false;
          if (!append) this.movements = [];
        } else {
          const mensaje = this.frappeErrorService.handle(error);
          this.alertService.error(mensaje);
        }
      },
      complete: () => {
        this.spinner.hide();
        this.historyLoadingMore = false;
      }
    });
  }

  private isPermissionError(error: any): boolean {
    const status = Number(error?.status ?? error?.error?.status ?? 0);
    return status === 403;
  }

  aplicarFiltrosInventario(): void {
    this.cargarProductosInventario();
  }

  limpiarFiltrosInventario(): void {
    this.search = '';
    this.onlyLowStock = false;
    this.onlyActive = true;
    this.cargarProductosInventario();
  }

  /** Cambiar producto o tipo reinicia `offset = 0` y reemplaza la lista, nunca la acumula. */
  aplicarFiltrosHistorial(): void {
    this.historyOffset = 0;
    this.cargarMovimientos();
  }

  limpiarFiltrosHistorial(): void {
    this.historyProduct = '';
    this.historyMovementType = '';
    this.historyOffset = 0;
    this.cargarMovimientos();
  }

  cambiarTab(tab: 'overview' | 'history'): void {
    this.activeTab = tab;
  }

  irAHistorial(): void {
    this.activeTab = 'history';
  }

  abrirMovimientoModal(): void {
    if (!this.canManageInventory) {
      this.alertService.error(this.inventoryEnabled
        ? 'No tienes permisos para administrar inventario.'
        : 'El inventario no está incluido en el plan actual.');
      return;
    }
    this.showMovementModal = true;
    this.showOptionalReferenceFields = false;
    this.submittedMovement = false;
    this.movementForm.reset({
      movement_type: 'Entrada',
      notes: '',
      reference_doctype: '',
      reference_name: '',
    });

    while (this.movementItems.length > 0) {
      this.movementItems.removeAt(0);
    }
    this.movementItems.push(this.createMovementItem());
  }

  /** Abre el modal de movimiento con este producto ya seleccionado, para no tener que buscarlo de nuevo en el desplegable. */
  abrirMovimientoParaProducto(product: InventoryProduct): void {
    this.abrirMovimientoModal();
    if (!this.showMovementModal) return; // sin permiso: abrirMovimientoModal ya mostró el aviso
    this.movementItems.at(0).patchValue({ product: product.name });
  }

  cerrarMovimientoModal(): void {
    this.showMovementModal = false;
    this.showOptionalReferenceFields = false;
    this.submittedMovement = false;
  }

  agregarFilaMovimiento(): void {
    this.movementItems.push(this.createMovementItem());
  }

  quitarFilaMovimiento(index: number): void {
    if (this.movementItems.length === 1) {
      this.movementItems.at(0).reset({ product: '', quantity: 1, target_stock: null });
      return;
    }
    this.movementItems.removeAt(index);
  }

  guardarMovimiento(): void {
    if (!this.canManageInventory) {
      this.alertService.error('No tienes permisos para administrar inventario.');
      return;
    }
    this.submittedMovement = true;
    if (this.movementForm.invalid) {
      this.movementForm.markAllAsTouched();
      return;
    }

    const payload = this.buildMovementPayload();
    if (!payload) {
      return;
    }

    this.alertService.confirm('Se registrara el movimiento de inventario.', 'Confirmar').then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.spinner.show();
      this.inventoryService.createInventoryMovement(payload).subscribe({
        next: () => {
          toast.success('Movimiento registrado');
          this.cerrarMovimientoModal();
          this.cargarProductosInventario();
          this.cargarOpcionesProducto();
          // Un movimiento nuevo siempre se ve reiniciando la paginación, no
          // agregándolo a lo que ya estaba cargado en el offset actual.
          this.historyOffset = 0;
          this.cargarMovimientos();
        },
        error: (error) => {
          const mensaje = this.frappeErrorService.handle(error);
          this.alertService.error(mensaje);
          this.spinner.hide();
        },
        complete: () => {
          this.spinner.hide();
        }
      });
    });
  }

  buildMovementPayload(): InventoryMovementPayload | LiteStockMovementPayload | null {
    const raw = this.movementForm.getRawValue();
    const movementType = raw.movement_type as InventoryMovementType;
    const rows = (raw.items || [])
      .filter((item: any) => item?.product && item?.quantity !== null && item?.quantity !== '')
      .map((item: any) => ({
        product: item.product,
        quantity: Number(item.quantity),
      }));

    if (!rows.length) {
      this.alertService.error('Debes agregar al menos un item valido.');
      return null;
    }

    if (this.isLiteMode) {
      const row = rows[0];
      if (!['Entrada', 'Salida', 'Ajuste'].includes(movementType)) {
        this.alertService.error('Tipo de movimiento no permitido en FacturADA Lite.');
        return null;
      }
      if (!Number.isFinite(row.quantity) || row.quantity <= 0) {
        this.alertService.error('La cantidad debe ser mayor que cero.');
        return null;
      }
      const business = this.capabilities.businessId || localStorage.getItem('businessId') || '';
      if (!business) {
        this.alertService.error('No se encontró el negocio activo.');
        return null;
      }
      const payload: LiteStockMovementPayload = {
        business,
        item: row.product,
        movement_type: movementType as 'Entrada' | 'Salida' | 'Ajuste',
        notes: raw.notes || ''
      };
      if (movementType === 'Ajuste') {
        const target = Number(raw.items?.[0]?.target_stock);
        if (!Number.isFinite(target) || target < 0) {
          this.alertService.error('Ingresa un stock objetivo válido para el ajuste.');
          return null;
        }
        payload.target_stock = target;
      } else {
        payload.quantity = row.quantity;
      }
      return payload;
    }

    const invalidProducts = rows.filter((row: any) => {
      const selectedProduct = this.productOptions.find((item) => item.name === row.product);
      return !selectedProduct || !this.hasInventory(selectedProduct);
    });

    if (invalidProducts.length) {
      this.alertService.error('Solo puedes registrar movimientos para productos con control de inventario activo.');
      return null;
    }

    const invalid = rows.find((row: any) => !Number.isFinite(row.quantity) || row.quantity === 0);
    if (invalid) {
      this.alertService.error('Todas las cantidades deben ser validas y distintas de cero.');
      return null;
    }

    if (movementType !== 'Ajuste' && rows.some((row: any) => row.quantity < 0)) {
      this.alertService.error('Solo los movimientos de ajuste permiten cantidades negativas.');
      return null;
    }

    return {
      movement_type: movementType,
      notes: raw.notes || '',
      reference_doctype: raw.reference_doctype || '',
      reference_name: raw.reference_name || '',
      items: rows,
    };
  }

  /**
   * La variación visual NUNCA usa `quantity` para un Ajuste (ese campo no
   * aplica ahí, el ajuste se hace por `target_stock`): se calcula siempre
   * como `resulting_stock - previous_stock` para que sea la diferencia real.
   */
  movementVariation(movement: any): number {
    const type = movement?.movement_type;
    if (type === 'Ajuste') {
      return (Number(movement?.resulting_stock) || 0) - (Number(movement?.previous_stock) || 0);
    }
    const qty = Number(movement?.quantity) || 0;
    return type === 'Salida' ? -qty : qty;
  }

  movementVariationClass(movement: any): string {
    const variation = this.movementVariation(movement);
    if (variation > 0) return 'text-emerald-600';
    if (variation < 0) return 'text-red-600';
    return 'text-muted-foreground';
  }

  hasInventory(product: Partial<Product> | null | undefined): boolean {
    return hasInventoryControl(product);
  }

  isLowStock(product: Partial<Product> | null | undefined): boolean {
    return isLowStockProduct(product);
  }

  isOutOfStock(product: Partial<Product> | null | undefined): boolean {
    return isOutOfStockProduct(product);
  }

  canSell(product: Partial<Product> | null | undefined): boolean {
    return canSellProduct(product);
  }

  getInventoryUnit(product: Partial<Product> | null | undefined): string {
    return getInventoryUnit(product);
  }

  formatStock(product: Partial<Product> | null | undefined): string {
    if (!this.hasInventory(product)) {
      return 'No aplica';
    }

    return `${toInventoryNumber(product?.stock_actual, 0)} ${this.getInventoryUnit(product)}`;
  }

  getMovementTone(type: string | undefined): string {
    switch (type) {
      case 'Entrada':
      case 'Reversa Venta':
      case 'Devolucion':
        return 'badge-green';
      case 'Salida':
      case 'Venta':
      case 'Consumo':
        return 'badge-red';
      case 'Ajuste':
        return 'badge-yellow';
      default:
        return 'badge-gray';
    }
  }

  getMovementHint(): string {
    switch (this.currentMovementType) {
      case 'Entrada':
        return 'Escribe una cantidad positiva. Este movimiento suma existencias.';
      case 'Reversa Venta':
      case 'Devolucion':
        return 'Escribe una cantidad positiva. Este movimiento devuelve stock al inventario.';
      case 'Salida':
        return 'Escribe una cantidad positiva. Este movimiento descuenta stock manualmente.';
      case 'Venta':
        return 'Escribe una cantidad positiva. Este movimiento descuenta stock por una venta manual.';
      case 'Consumo':
        return 'Escribe una cantidad positiva. Este movimiento descuenta producto por uso interno.';
      case 'Ajuste':
        return this.isLiteMode
          ? 'Indica el stock objetivo después del conteo físico.'
          : 'Puedes usar positivo o negativo segun la correccion que necesites hacer.';
      default:
        return '';
    }
  }

  getMovementOptionLabel(type: InventoryMovementType | string | undefined): string {
    if (!type) {
      return 'Movimiento';
    }

    return this.movementTypeMeta[type as InventoryMovementType]?.label || type;
  }

  getMovementOptionDescription(type: InventoryMovementType | string | undefined): string {
    if (!type) {
      return '';
    }

    return this.movementTypeMeta[type as InventoryMovementType]?.description || '';
  }

  getProductStatusSummary(product: InventoryProduct): string {
    if (!this.hasInventory(product)) {
      return 'Sin control de inventario';
    }

    if (this.isOutOfStock(product)) {
      return 'Agotado';
    }

    if (this.isLowStock(product)) {
      return 'Bajo stock';
    }

    return 'Stock saludable';
  }

  resolveProductName(productName: string): string {
    const match = this.productOptions.find((item) => item.name === productName);
    return match?.nombre || productName;
  }

  /** "PRUEBA · Color: Azul · Talla: 28" cuando el producto es una variante; null si no lo es. */
  describeVariantContext(product: Partial<Product> | null | undefined): string | null {
    if (!product?.variant_of_name) return null;
    const attrs = formatVariantAttributes(product);
    return attrs && attrs !== '—' ? `${product.variant_of_name} · ${attrs}` : String(product.variant_of_name);
  }

  /** Etiqueta para los <option> de los selectores de producto (historial y formulario de movimiento). */
  describeProductOption(product: Partial<Product> | null | undefined): string {
    const context = this.describeVariantContext(product);
    const base = context ? `${product?.nombre} (${context})` : String(product?.nombre || '');
    // El código queda dentro del mismo texto para que la búsqueda del
    // selector (que solo mira esta etiqueta) también encuentre por código.
    return product?.codigo ? `${base} · ${product.codigo}` : base;
  }

  extractReference(movement: InventoryMovement): string {
    const doctype = movement?.reference_doctype || '';
    const name = movement?.reference_name || movement?.reference || '';
    return doctype || name ? `${doctype || 'Ref'} ${name}`.trim() : 'Sin referencia';
  }

  trackByProduct = (_: number, item: InventoryProduct) => item?.name || item?.codigo || _;
  trackByMovement = (_: number, item: InventoryMovement) => item?.name || item?.creation || _;

  private extractList(res: any, preferredPath: string[]): any[] {
    if (Array.isArray(res)) return res;
    const fromPreferred = preferredPath.reduce((acc: any, key: string) => acc?.[key], res);
    if (Array.isArray(fromPreferred)) {
      return fromPreferred;
    }

    const candidates = [
      res?.message,
      res?.data,
      res?.message?.movements,
      res?.message?.products,
      res?.movements,
      res?.products,
    ];

    const found = candidates.find((item) => Array.isArray(item));
    return Array.isArray(found) ? found : [];
  }

  private extractData(res: any): any {
    const data = res?.message?.data ?? res?.data ?? (res && typeof res === 'object' && !Array.isArray(res) ? res : null);
    return data?.summary && typeof data.summary === 'object' ? data.summary : data;
  }

}
