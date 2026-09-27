import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { ProductsService } from 'src/app/services/products.service';

@Component({
  selector: 'app-lite-inventory-transfer',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule],
  templateUrl: './lite-inventory-transfer.component.html'
})
export class LiteInventoryTransferComponent implements OnInit {
  loading = false;
  loadingSource = false;
  loadingTarget = false;
  saving = false;
  submitted = false;
  error = '';

  form!: FormGroup;
  /** Productos con stock/atributos de la bodega ORIGEN actualmente seleccionada. Es el catálogo desde el que se agrega al traslado. */
  sourceProducts: any[] = [];
  /** Solo `name -> current_stock` de la bodega DESTINO, para mostrar contexto ("ya tiene X ahí"). */
  targetStockByItem: Record<string, number> = {};
  productSearch = '';
  /** Cantidad que el usuario está tipeando en el catálogo para cada producto, antes de apretar "Agregar". */
  catalogQty: Record<string, number | null> = {};

  lastResult: { transfer_id?: string; movements?: any[] } | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly inventoryService: InventoryService,
    private readonly productsService: ProductsService,
    public readonly capabilities: CompanyCapabilitiesService,
    private readonly frappeError: FrappeErrorService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      source_warehouse: ['', Validators.required],
      target_warehouse: ['', Validators.required],
      posting_date: [this.today(), Validators.required],
      notes: [''],
      // El "carrito" del traslado: arranca vacío, se llena agregando desde el
      // catálogo (no hay filas en blanco que el usuario tenga que completar).
      items: this.fb.array([])
    });
    this.form.get('source_warehouse')?.valueChanges.subscribe((warehouse) => {
      this.cargarProductosOrigen(warehouse);
      // Si ya no puede coincidir con el destino (se filtra de sus opciones),
      // pero el control de destino no se re-renderiza solo: se limpia a mano
      // para que el formulario y lo que se ve en pantalla no queden distintos.
      const targetControl = this.form.get('target_warehouse');
      if (warehouse && targetControl && targetControl.value === warehouse) {
        targetControl.setValue('', { emitEvent: false });
        this.cargarStockDestino('');
      }
    });
    this.form.get('target_warehouse')?.valueChanges.subscribe((warehouse) => {
      this.cargarStockDestino(warehouse);
      const sourceControl = this.form.get('source_warehouse');
      if (warehouse && sourceControl && sourceControl.value === warehouse) {
        sourceControl.setValue('', { emitEvent: false });
        this.cargarProductosOrigen('');
      }
    });
  }

  get warehouses(): any[] {
    return this.capabilities.activeWarehouses;
  }

  /** Excluye la bodega ya elegida como destino: no se puede repetir en origen. */
  get sourceWarehouseOptions(): any[] {
    const target = String(this.form?.get('target_warehouse')?.value || '');
    return this.warehouses.filter((warehouse: any) => String(warehouse?.name || '') !== target);
  }

  /** Excluye la bodega ya elegida como origen: no se puede repetir en destino. */
  get targetWarehouseOptions(): any[] {
    const source = String(this.form?.get('source_warehouse')?.value || '');
    return this.warehouses.filter((warehouse: any) => String(warehouse?.name || '') !== source);
  }

  get items(): FormArray {
    return this.form.get('items') as FormArray;
  }

  get sourceSelected(): boolean {
    return !!this.form?.get('source_warehouse')?.value;
  }

  get filteredProducts(): any[] {
    const search = this.productSearch.trim().toLowerCase();
    if (!search) return this.sourceProducts;
    return this.sourceProducts.filter((item: any) =>
      String(item?.nombre || '').toLowerCase().includes(search)
      || String(item?.codigo || '').toLowerCase().includes(search)
    );
  }

  get sameWarehouseSelected(): boolean {
    const value = this.form?.getRawValue();
    return !!value?.source_warehouse && value.source_warehouse === value.target_warehouse;
  }

  /** true si alguna línea del carrito pide trasladar más de lo disponible en la bodega origen: bloquea el envío. */
  get hasInsufficientStockLines(): boolean {
    return this.items.controls.some((group) => {
      const { item, qty } = group.getRawValue();
      return item && Number(qty) > this.availableStock(item);
    });
  }

  get totalUnitsInCart(): number {
    return this.items.controls.reduce((sum, group) => sum + (Number(group.get('qty')?.value) || 0), 0);
  }

  /** Ya está en el carrito del traslado: el catálogo lo marca en vez de dejarlo agregar dos veces por separado. */
  isInCart(itemId: string): boolean {
    return this.items.controls.some((group) => String(group.get('item')?.value) === String(itemId));
  }

  cartQtyFor(itemId: string): number {
    const group = this.items.controls.find((group) => String(group.get('item')?.value) === String(itemId));
    return Number(group?.get('qty')?.value) || 0;
  }

  /**
   * Agrega el producto al carrito con la cantidad tipeada en el catálogo. Si
   * ya estaba, suma en vez de duplicar la línea (mismo criterio que el
   * carrito del POS).
   */
  agregarAlCarrito(product: any): void {
    const itemId = String(product?.name || product?.codigo || '');
    if (!itemId) return;
    const available = this.availableStock(itemId);
    const qty = Number(this.catalogQty[itemId] || 0);
    if (available <= 0) {
      toast.error('Este producto no tiene stock en la bodega origen.');
      return;
    }
    if (!(qty > 0)) {
      toast.error('Ingresa una cantidad mayor a cero.');
      return;
    }
    const existing = this.items.controls.find((group) => String(group.get('item')?.value) === itemId);
    if (existing) {
      const nextQty = Number(existing.get('qty')?.value || 0) + qty;
      if (nextQty > available) {
        toast.error(`Ya tienes ${existing.get('qty')?.value} en el traslado; solo hay ${available} disponibles en origen.`);
        return;
      }
      existing.get('qty')?.setValue(nextQty);
    } else {
      if (qty > available) {
        toast.error(`Solo hay ${available} disponibles en origen.`);
        return;
      }
      this.items.push(this.fb.group({
        item: [itemId, Validators.required],
        qty: [qty, [Validators.required, Validators.min(0.0001)]]
      }));
    }
    this.catalogQty[itemId] = null;
  }

  removeItem(index: number): void {
    this.items.removeAt(index);
  }

  productLabel(id: string): string {
    const product = this.sourceProducts.find((item: any) => String(item?.name || item?.codigo) === String(id));
    return product ? `${product.codigo || ''} - ${product.nombre || product.name}` : String(id);
  }

  /**
   * Un traslado genera DOS movimientos de stock (salida en origen, entrada en
   * destino) para el mismo producto y cantidad; por eso el resultado siempre
   * trae cada línea "duplicada" — no es un error. Se etiqueta cada una con su
   * bodega y sentido para que se entienda a simple vista.
   */
  movementLabel(movement: any): string {
    const warehouseId = String(movement?.warehouse || '').trim();
    const warehouse = this.warehouses.find((item: any) => String(item?.name || '') === warehouseId);
    const warehouseName = warehouse?.warehouse_name || warehouse?.name || warehouseId || 'bodega';
    const type = String(movement?.movement_type || '').trim();
    if (type === 'Entrada') return `Entrada a ${warehouseName}`;
    if (type === 'Salida') return `Salida de ${warehouseName}`;
    return warehouseName;
  }

  /** Stock disponible del producto en la bodega ORIGEN seleccionada. 0 si aún no se eligió bodega o el producto no aparece ahí. */
  availableStock(itemId: string): number {
    const product = this.sourceProducts.find((item: any) => String(item?.name || item?.codigo) === String(itemId));
    return Number(product?.stock_actual ?? product?.current_stock ?? 0) || 0;
  }

  /** Stock actual del producto en la bodega DESTINO seleccionada (solo contexto, no bloquea nada). */
  targetStock(itemId: string): number {
    return Number(this.targetStockByItem[String(itemId)] ?? 0) || 0;
  }

  lineExceedsAvailable(group: AbstractControl): boolean {
    const { item, qty } = group.value;
    return !!item && Number(qty) > this.availableStock(item);
  }

  private cargarProductosOrigen(warehouse: string): void {
    this.sourceProducts = [];
    this.catalogQty = {};
    this.items.clear();
    if (!warehouse) return;
    this.loadingSource = true;
    // `flatten_variants`: el stock real vive en las variantes, no en el
    // producto agrupador. `warehouseOverride` obliga a que el stock devuelto
    // sea el de ESTA bodega, nunca el global ni el de otro local.
    this.productsService.getAll(1, 500, 0, '', undefined, undefined, false, true, warehouse).pipe(
      finalize(() => this.loadingSource = false)
    ).subscribe({
      next: (rows: any) => this.sourceProducts = Array.isArray(rows) ? rows : (rows?.message?.data || []),
      error: (err: any) => {
        this.error = this.readError(err);
        toast.error(this.error);
      }
    });
  }

  private cargarStockDestino(warehouse: string): void {
    this.targetStockByItem = {};
    if (!warehouse) return;
    this.loadingTarget = true;
    this.productsService.getAll(1, 500, 0, '', undefined, undefined, false, true, warehouse).pipe(
      finalize(() => this.loadingTarget = false)
    ).subscribe({
      next: (rows: any) => {
        const list = Array.isArray(rows) ? rows : (rows?.message?.data || []);
        this.targetStockByItem = list.reduce((acc: Record<string, number>, product: any) => {
          acc[String(product?.name)] = Number(product?.stock_actual ?? product?.current_stock ?? 0) || 0;
          return acc;
        }, {});
      },
      error: () => undefined
    });
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  trasladar(): void {
    this.submitted = true;
    this.error = '';
    this.lastResult = null;
    if (this.form.invalid) return;

    const value = this.form.getRawValue();
    if (value.source_warehouse === value.target_warehouse) {
      toast.error('La bodega de origen y destino deben ser distintas.');
      return;
    }
    const items = (value.items as Array<{ item: string; qty: number }>)
      .filter((item) => item.item && Number(item.qty) > 0)
      .map((item) => ({ item: item.item, qty: Number(item.qty) }));
    if (!items.length) {
      toast.error('Agrega al menos un producto con cantidad mayor a cero.');
      return;
    }
    if (this.hasInsufficientStockLines) {
      toast.error('No puedes trasladar más stock del disponible en la bodega origen.');
      return;
    }

    this.saving = true;
    this.inventoryService.transferStock({
      source_warehouse: value.source_warehouse,
      target_warehouse: value.target_warehouse,
      posting_date: value.posting_date,
      notes: String(value.notes || '').trim() || undefined,
      items
    }).pipe(
      finalize(() => this.saving = false)
    ).subscribe({
      next: (result: any) => {
        toast.success('Traslado de inventario realizado.');
        this.lastResult = {
          transfer_id: result?.transfer_id || result?.name,
          movements: Array.isArray(result?.movements) ? result.movements : []
        };
        this.submitted = false;
        this.form.reset({ source_warehouse: value.source_warehouse, target_warehouse: value.target_warehouse, posting_date: this.today(), notes: '' });
        // `form.reset` a los mismos valores no dispara `valueChanges`: se
        // refresca a mano el stock de origen/destino y se vacía el carrito.
        this.cargarProductosOrigen(value.source_warehouse);
        this.cargarStockDestino(value.target_warehouse);
      },
      error: (err: any) => toast.error(this.readError(err))
    });
  }

  private readError(error: any): string {
    const backendMessage = this.frappeError.handle(error);
    if (Number(error?.status) === 403) {
      return backendMessage || 'No tienes permisos para trasladar inventario.';
    }
    return backendMessage || (error?.message || 'No se pudo completar la operación.');
  }
}
