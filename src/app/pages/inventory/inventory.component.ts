import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  getAvailableStock,
  getInventoryUnit,
  hasInventoryControl,
  isLowStockProduct,
  isOutOfStockProduct,
  toInventoryNumber,
} from 'src/app/shared/utils/inventory.utils';
import { formatVariantAttributes } from 'src/app/shared/utils/product-variants.utils';
import { InventoryNavComponent } from 'src/app/shared/components/inventory-nav/inventory-nav.component';
import { debouncedCallback } from 'src/app/shared/utils/debounced-callback';

export type StockFilter = 'all' | 'available' | 'low' | 'out';

/** Sentido visual de cada tipo de movimiento: suma, resta o fija el stock. */
const MOVEMENT_DIRECTION: Record<InventoryMovementType, 'in' | 'out' | 'set'> = {
  Entrada: 'in', 'Reversa Venta': 'in', Devolucion: 'in',
  Salida: 'out', Venta: 'out', Consumo: 'out',
  Ajuste: 'set'
};

@Component({
  selector: 'app-inventory',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgSelectModule, RouterLink, InventoryNavComponent],
  templateUrl: './inventory.component.html'
})
export class InventoryComponent implements OnInit {
  readonly movementTypeMeta: Record<InventoryMovementType, { label: string; description: string }> = {
    Entrada: {
      label: 'Ingreso de stock',
      description: 'Llegó mercadería, una compra o una reposición.',
    },
    Salida: {
      label: 'Salida manual',
      description: 'Salió producto por merma, pérdida o uso no comercial.',
    },
    Ajuste: {
      label: 'Corrección de stock',
      description: 'El conteo físico no coincide con el sistema.',
    },
    Venta: {
      label: 'Descuento por venta',
      description: 'Solo si necesitas registrar una venta a mano.',
    },
    'Reversa Venta': {
      label: 'Devolver por venta anulada',
      description: 'Una venta se anuló y el producto regresa.',
    },
    Consumo: {
      label: 'Consumo interno',
      description: 'El negocio usó producto sin venderlo.',
    },
    Devolucion: {
      label: 'Devolución al inventario',
      description: 'El producto regresó y vuelve a estar disponible.',
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
  /** Filtro por estado de stock, aplicado sobre la lista cargada al pulsar las tarjetas de resumen. */
  stockFilter: StockFilter = 'all';
  visibleProducts: InventoryProduct[] = [];
  private readonly searchBackend: () => void;
  /**
   * `get_productos` no tiene un modo "todos": siempre hay que pedir
   * explícitamente `isactive=1` o `isactive=0`. Selector de dos estados en
   * vez de un checkbox "solo activos" que sugería que desmarcado traía todo.
   */
  estadoFiltro: 'Activo' | 'Inactivo' = 'Activo';

  historyProduct = '';
  historyMovementType = '';
  historyLimit = 20;
  historyOffset = 0;
  historyLoadingMore = false;
  /** false mientras la última página traiga exactamente `historyLimit` filas: puede haber más. */
  historyHasMore = true;
  /** true si el backend respondió con un error de permisos: no se vuelve a intentar solo. */
  historyAccessDenied = false;

  /**
   * Vista alterna del historial: en vez de una fila por movimiento (un
   * traslado siempre deja una Salida en origen + una Entrada en destino para
   * el mismo producto), agrupa ambas en una sola fila "Origen → Destino" para
   * que se entienda de un vistazo. Solo tiene sentido en modo Por Bodega.
   */
  soloTraslados = false;
  traslados: Array<{
    reference_name?: string;
    item?: string;
    item_name?: string;
    quantity: number;
    timestamp?: string | null;
    source_warehouse?: string;
    target_warehouse?: string;
  }> = [];
  loadingTraslados = false;

  showMovementModal = false;
  showOptionalReferenceFields = false;
  submittedMovement = false;
  movementForm!: FormGroup;

  /**
   * Bodega activa elegida en ESTA pantalla, independiente de la del terminal
   * POS: un administrador debe poder revisar cualquier bodega, no solo la de
   * su terminal. Se persiste por negocio en localStorage. `null` en modo
   * Simple (no aplica) o mientras no haya ninguna elegida en modo Por Bodega.
   */
  selectedWarehouseId = '';

  constructor(
    private inventoryService: InventoryService,
    private productsService: ProductsService,
    private fb: FormBuilder,
    private spinner: NgxSpinnerService,
    private frappeErrorService: FrappeErrorService,
    private alertService: AlertService,
    private capabilities: CompanyCapabilitiesService,
    private route: ActivatedRoute,
    private router: Router,
    destroyRef: DestroyRef
  ) {
    this.searchBackend = debouncedCallback(destroyRef, () => this.cargarProductosInventario());
    // La pestaña vive en la URL (?tab=history) para que la navegación común de
    // inventario pueda enlazar directo a Movimientos.
    this.route.queryParamMap.pipe(takeUntilDestroyed(destroyRef)).subscribe((params) => {
      this.activeTab = params.get('tab') === 'history' ? 'history' : 'overview';
    });
  }

  ngOnInit(): void {
    this.initMovementForm();
    if (!this.inventoryEnabled) return;
    // El modo/lista de bodegas no siempre llegó ya al estado compartido (solo
    // se carga en las pantallas de configuración); Inventario lo consulta de
    // entrada para poder resolver la bodega activa antes de pedir datos.
    this.inventoryService.getInventoryConfiguration().subscribe({
      next: (response) => {
        this.capabilities.setInventoryConfiguration(response);
        this.startLoadingInventoryData();
      },
      error: () => this.startLoadingInventoryData()
    });
  }

  private startLoadingInventoryData(): void {
    this.resolveSelectedWarehouse();
    if (!this.canLoadInventory) return;
    this.cargarProductosInventario();
    this.cargarOpcionesProducto();
    this.cargarMovimientos();
  }

  get isWarehouseMode(): boolean {
    return this.capabilities.isWarehouseMode;
  }

  get warehouseOptions(): any[] {
    return this.capabilities.activeWarehouses;
  }

  /** En modo Por Bodega no se carga nada (ni se permite registrar movimientos) sin una bodega elegida. */
  get canLoadInventory(): boolean {
    return !this.isWarehouseMode || !!this.selectedWarehouseId;
  }

  /**
   * Prioridad: 1) selección persistida (si sigue siendo una bodega activa),
   * 2) la bodega del terminal POS del operador, 3) la predeterminada del
   * negocio. Si nada aplica, queda vacío y la pantalla bloquea la carga.
   */
  private resolveSelectedWarehouse(): void {
    if (!this.isWarehouseMode) {
      this.selectedWarehouseId = '';
      return;
    }
    const persisted = localStorage.getItem(this.warehouseStorageKey());
    const options = this.warehouseOptions;
    if (persisted && options.some((item: any) => String(item?.name || '') === persisted)) {
      this.selectedWarehouseId = persisted;
      return;
    }
    const terminalWarehouse = String(this.capabilities.activePosTerminal?.warehouse || '').trim();
    if (terminalWarehouse && options.some((item: any) => String(item?.name || '') === terminalWarehouse)) {
      this.selectedWarehouseId = terminalWarehouse;
      return;
    }
    this.selectedWarehouseId = String(this.capabilities.defaultWarehouse?.name || '');
  }

  onWarehouseChange(warehouseId: string): void {
    this.selectedWarehouseId = warehouseId;
    const business = this.capabilities.activeBusinessId;
    if (business) {
      if (warehouseId) localStorage.setItem(this.warehouseStorageKey(), warehouseId);
      else localStorage.removeItem(this.warehouseStorageKey());
    }
    if (!this.canLoadInventory) {
      this.inventoryProducts = [];
      this.visibleProducts = [];
      this.inventorySummary = null;
      this.movements = [];
      return;
    }
    this.cargarProductosInventario();
    this.historyOffset = 0;
    this.cargarMovimientos();
  }

  private warehouseStorageKey(): string {
    return `inventory_active_warehouse:${this.capabilities.activeBusinessId || ''}`;
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

  /** Visible solo en modo Por Bodega, con permiso de inventario, con al menos 2 bodegas. */
  get canTransferStock(): boolean {
    return this.isWarehouseMode && this.canManageInventory && this.warehouseOptions.length >= 2;
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

  /**
   * Inventario es un módulo compartido entre negocios Lite y de restaurante:
   * ambos usan el mismo catálogo (`get_productos`) y el mismo modelo de
   * bodegas, así que la carga es siempre la misma sin importar `isLiteMode`.
   * (Antes había una rama alterna con `InventoryService.getInventoryProducts`
   * para negocios no-Lite, pero esa nunca mandaba `flatten_variants` ni
   * `warehouse`: devolvía el producto agrupador de la variante —siempre con
   * `maneja_stock: 0`, porque el stock real vive en la variante— y el filtro
   * de abajo lo descartaba, dejando la lista y el resumen vacíos para
   * cualquier negocio de restaurante con productos con variantes.)
   */
  cargarProductosInventario(): void {
    if (!this.canLoadInventory) return;
    this.spinner.show();
    forkJoin({
      // `flatten_variants`: acá se administra el stock real, que vive en
      // las variantes, no en el producto agrupador (siempre en 0).
      // `isactive` siempre explícito: el backend no tiene un modo "todos".
      products: this.productsService.getAll(
        this.estadoFiltro === 'Activo' ? 1 : 0,
        undefined,
        0,
        this.search,
        undefined,
        undefined,
        false,
        true,
        this.isWarehouseMode ? this.selectedWarehouseId : undefined
      ),
      summary: this.inventoryService.getStockSummary(this.isWarehouseMode ? this.selectedWarehouseId : undefined)
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
        this.applyStockFilter();
      },
      error: (error) => {
        this.alertService.error(this.frappeErrorService.handle(error));
        this.spinner.hide();
      },
      complete: () => this.spinner.hide()
    });
  }

  cargarOpcionesProducto(): void {
    this.productsService.getAll(1, undefined, 0, '', undefined, undefined, false, true, this.isWarehouseMode ? this.selectedWarehouseId : undefined).subscribe({
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
    if (this.historyAccessDenied || !this.canLoadInventory) return;
    if (append) this.historyLoadingMore = true;
    else this.spinner.show();

    this.inventoryService.getInventoryMovements({
      limit: this.historyLimit,
      offset: this.historyOffset,
      product: this.historyProduct || undefined,
      movementType: this.historyMovementType || undefined,
      warehouse: this.isWarehouseMode ? this.selectedWarehouseId : undefined,
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

  toggleSoloTraslados(value: boolean): void {
    this.soloTraslados = value;
    if (value) this.cargarTraslados();
  }

  /**
   * Trae movimientos SIN restringir a la bodega elegida en esta pantalla: un
   * traslado siempre involucra dos bodegas a la vez (origen y destino), así
   * que agruparlos exige ver ambas, no solo la seleccionada arriba.
   */
  private cargarTraslados(): void {
    this.loadingTraslados = true;
    this.inventoryService.getInventoryMovements({
      limit: 200,
      offset: 0,
      warehouse: ''
    }).subscribe({
      next: (res: any) => {
        const list = this.extractList(res, ['message', 'data']) as InventoryMovement[];
        this.traslados = this.groupTransferMovements(list);
      },
      error: (error) => {
        const mensaje = this.frappeErrorService.handle(error);
        this.alertService.error(mensaje);
      },
      complete: () => {
        this.loadingTraslados = false;
      }
    });
  }

  /**
   * Un traslado deja dos movimientos con la MISMA referencia (el `transfer_id`,
   * ej. "TRF-...") para el mismo producto: una Salida en origen y una Entrada
   * en destino. Se identifican por esa referencia (no hay otro campo que los
   * marque como "traslado" en vez de un movimiento manual) y se combinan en
   * una sola fila legible.
   */
  private groupTransferMovements(list: InventoryMovement[]): typeof this.traslados {
    const transferMovements = list.filter((movement) => this.isTransferMovement(movement));
    const byKey = new Map<string, InventoryMovement[]>();
    transferMovements.forEach((movement) => {
      const key = `${movement.reference_name}::${movement.item}`;
      const group = byKey.get(key) || [];
      group.push(movement);
      byKey.set(key, group);
    });

    return Array.from(byKey.values())
      .map((group) => {
        const salida = group.find((movement) => movement.movement_type === 'Salida');
        const entrada = group.find((movement) => movement.movement_type === 'Entrada');
        const any = salida || entrada;
        return {
          reference_name: any?.reference_name,
          item: any?.item,
          item_name: any?.item_name || this.resolveProductName(any?.item || ''),
          quantity: Number(entrada?.quantity ?? salida?.quantity ?? 0),
          timestamp: this.movementTimestamp(any),
          source_warehouse: salida?.warehouse,
          target_warehouse: entrada?.warehouse,
        };
      })
      .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
  }

  private isTransferMovement(movement: InventoryMovement): boolean {
    const reference = String(movement?.reference_name || '');
    const doctype = String(movement?.reference_doctype || '').toLowerCase();
    return /^TRF-/i.test(reference) || doctype.includes('transfer') || doctype.includes('traslado');
  }

  /**
   * `movement_datetime` trae fecha y hora reales del registro; `created_at`
   * es el respaldo si faltara. `posting_date`/`creation` solo quedan como
   * último recurso (fecha sin hora, o auditoría genérica).
   */
  movementTimestamp(movement: InventoryMovement | null | undefined): string | null {
    const raw = movement?.movement_datetime || movement?.created_at || movement?.posting_date || movement?.creation || null;
    if (!raw) return null;
    // El backend envía "YYYY-MM-DD HH:mm:ss.ffffff" (espacio, sin zona) en vez
    // de ISO 8601: no todos los navegadores lo interpretan igual con
    // `new Date(...)`, así que se normaliza a un formato que el DatePipe
    // siempre reconoce.
    return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw) ? raw.replace(' ', 'T') : raw;
  }

  warehouseLabel(id?: string): string {
    if (!id) return '—';
    const warehouse = this.capabilities.warehouses.find((item: any) => String(item?.name || '') === String(id));
    return warehouse?.warehouse_name || warehouse?.name || id;
  }

  private isPermissionError(error: any): boolean {
    const status = Number(error?.status ?? error?.error?.status ?? 0);
    return status === 403;
  }

  aplicarFiltrosInventario(): void {
    this.cargarProductosInventario();
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.searchBackend();
  }

  setStockFilter(filter: StockFilter): void {
    this.stockFilter = this.stockFilter === filter && filter !== 'all' ? 'all' : filter;
    this.applyStockFilter();
  }

  get hasActiveFilters(): boolean {
    return !!this.search.trim() || this.stockFilter !== 'all' || this.estadoFiltro !== 'Activo';
  }

  limpiarFiltrosInventario(): void {
    this.search = '';
    this.stockFilter = 'all';
    this.estadoFiltro = 'Activo';
    this.cargarProductosInventario();
  }

  private readonly stockFilters: Record<StockFilter, (product: InventoryProduct) => boolean> = {
    all: () => true,
    available: (product) => this.canSell(product) && !this.isLowStock(product) && !this.isOutOfStock(product),
    low: (product) => this.isLowStock(product) && !this.isOutOfStock(product),
    out: (product) => this.isOutOfStock(product)
  };

  /** Cantidad de productos que muestra cada filtro (las tarjetas de resumen usan el mismo criterio). */
  stockFilterCount(filter: StockFilter): number {
    return this.inventoryProducts.filter(this.stockFilters[filter]).length;
  }

  private applyStockFilter(): void {
    this.visibleProducts = this.inventoryProducts.filter(this.stockFilters[this.stockFilter]);
  }

  /** Estado único de stock para la tabla: evita repetir "Disponible/Agotado" en dos columnas. */
  stockStatus(product: InventoryProduct): { label: string; tone: string } {
    if (this.isOutOfStock(product)) return { label: 'Agotado', tone: 'bg-red-100 text-red-800' };
    if (this.isLowStock(product)) return { label: 'Bajo mínimo', tone: 'bg-amber-100 text-amber-900' };
    return { label: 'Disponible', tone: 'bg-emerald-100 text-emerald-800' };
  }

  stockNumber(product: Partial<Product> | null | undefined): number {
    return getAvailableStock(product);
  }

  movementDirection(type: InventoryMovementType | string | undefined): 'in' | 'out' | 'set' {
    return MOVEMENT_DIRECTION[type as InventoryMovementType] || 'in';
  }

  selectMovementType(type: InventoryMovementType): void {
    this.movementForm.patchValue({ movement_type: type });
  }

  /**
   * Vista previa de cómo queda el stock de una fila del movimiento. Es solo
   * orientativa: el backend calcula el stock real al registrar.
   */
  movementPreview(index: number): { current: number; result: number; unit: string } | null {
    const row = this.movementItems.at(index)?.value;
    const product = this.productOptions.find((item) => item.name === row?.product);
    if (!product) return null;
    const current = this.stockNumber(product);
    const direction = this.movementDirection(this.currentMovementType);
    let result = current;
    if (direction === 'set' && this.isLiteMode) {
      const target = Number(row?.target_stock);
      if (row?.target_stock === null || row?.target_stock === '' || !Number.isFinite(target)) return { current, result: current, unit: this.getInventoryUnit(product) };
      result = target;
    } else {
      const quantity = Number(row?.quantity) || 0;
      result = direction === 'out' ? current - quantity : current + quantity;
    }
    return { current, result, unit: this.getInventoryUnit(product) };
  }

  selectedWarehouseLabel(): string {
    return this.warehouseLabel(this.selectedWarehouseId);
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
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'history' ? 'history' : null }, queryParamsHandling: 'merge' });
  }

  abrirMovimientoModal(): void {
    if (!this.canManageInventory) {
      this.alertService.error(this.inventoryEnabled
        ? 'No tienes permisos para administrar inventario.'
        : 'El inventario no está incluido en el plan actual.');
      return;
    }
    if (!this.canLoadInventory) {
      this.alertService.error('Selecciona una bodega activa antes de registrar movimientos.');
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

    this.alertService.confirm('Se registrará el movimiento de inventario.', 'Confirmar').then((result) => {
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
      this.alertService.error('Agrega al menos un producto válido.');
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
      // En modo Por Bodega la bodega es obligatoria en todo movimiento: sin
      // ella el backend no sabría a qué stock aplicarlo.
      if (this.isWarehouseMode && !this.selectedWarehouseId) {
        this.alertService.error('Selecciona una bodega activa antes de registrar el movimiento.');
        return null;
      }
      const payload: LiteStockMovementPayload & { warehouse?: string } = {
        business,
        item: row.product,
        movement_type: movementType as 'Entrada' | 'Salida' | 'Ajuste',
        notes: raw.notes || ''
      };
      if (this.isWarehouseMode) payload.warehouse = this.selectedWarehouseId;
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
      this.alertService.error('Todas las cantidades deben ser válidas y distintas de cero.');
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
          ? 'Escribe cuántas unidades contaste: el sistema ajusta la diferencia.'
          : 'Usa un número positivo para sumar o negativo para restar.';
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
