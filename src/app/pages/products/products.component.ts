import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { catchError, finalize, map, of, Subscription, switchMap } from 'rxjs';
import { Product } from 'src/app/core/models/product';
import { AlertService } from 'src/app/core/services/alert.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CategoryService } from 'src/app/services/category.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { ProductsService } from 'src/app/services/products.service';
import { TaxesService } from 'src/app/services/taxes.service';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { IconActionButtonComponent } from 'src/app/shared/components/icon-action-button/icon-action-button.component';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { AppPaginationComponent } from 'src/app/shared/components/pagination/app-pagination.component';
import {
  getInventoryUnit,
  hasInventoryControl,
  isLowStockProduct,
  isOutOfStockProduct,
  toInventoryBool,
  toInventoryNumber,
} from 'src/app/shared/utils/inventory.utils';
import {
  formatVariantAttributes,
  getVariantAttributeDefinitions,
  VariantAttributeDefinition,
} from 'src/app/shared/utils/product-variants.utils';

type StockEditMode = 'absolute' | 'delta';

@Component({
  selector: 'app-products',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonComponent, AppPaginationComponent, IconActionButtonComponent],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css'
})
export class ProductsComponent implements OnInit {
  readonly inventoryUnitOptions = [
    { value: 'und', label: 'Unidad (und)' },
    // { value: 'kg', label: 'Kilogramo (kg)' },
    // { value: 'g', label: 'Gramo (g)' },
    // { value: 'lt', label: 'Litro (lt)' },
    // { value: 'ml', label: 'Mililitro (ml)' },
    // { value: 'porcion', label: 'Porcion' },
    // { value: 'caja', label: 'Caja' },
    // { value: 'paquete', label: 'Paquete' },
  ];

  productos: Product[] = [];
  productosFiltradosList: Product[] = [];
  categories: any[] = [];
  taxes: any[] = [];

  private _searchTerm = '';
  categoriaFiltro = '';
  soloActivos = false;
  soloBajoStock = false;

  mostrarModal = false;
  submitted = false;
  productoEditando: Product | null = null;
  productoForm!: FormGroup;
  /**
   * 'choose': paso previo al crear, elige entre producto simple o con
   * variantes. 'simple': formulario completo de siempre. 'grouped': igual,
   * pero sin precio/impuesto/inventario (esos viven en cada variante). Al
   * editar un producto existente se salta directo a 'simple', el tipo ya
   * quedó definido por si tiene variantes o no.
   */
  productModalStep: 'choose' | 'simple' | 'grouped' = 'simple';
  stockEditMode: StockEditMode = 'absolute';
  selectedImageFile: File | null = null;
  imagePreview = '';

  page = 1;
  pageSize = 10;
  totalProducts = 0;
  totalPages = 1;

  // --- Variantes de producto ---
  variantesModalVisible = false;
  variantesParent: Product | null = null;
  variantes: Product[] = [];
  variantesLoading = false;
  variantesPage = 1;
  variantesPageSize = 20;
  variantesTotal = 0;
  variantesTotalPages = 1;
  variantesFiltroAtributos: Record<string, string> = {};
  private variantesRequestSub?: Subscription;

  varianteFormVisible = false;
  varianteEditando: Product | null = null;
  varianteForm!: FormGroup;
  varianteSubmitted = false;

  onPaginationPage(page: number): void {
    if (page === this.page) return;
    this.page = page;
    this.cargarProductos();
  }
  onPaginationPageSize(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.cargarProductos();
  }

  constructor(
    private productsService: ProductsService,
    private categoryService: CategoryService,
    private taxesService: TaxesService,
    public spinner: NgxSpinnerService,
    private fb: FormBuilder,
    private frappeErrorService: FrappeErrorService,
    private alertService: AlertService,
    private capabilities: CompanyCapabilitiesService,
    private inventoryService: InventoryService
  ) { }

  ngOnInit() {
    this.resetForm();

    // El contexto de Lite puede negar products.read aunque el módulo haya
    // quedado visible por un contexto antiguo. Evita una llamada innecesaria
    // y conserva al usuario en la pantalla para que pueda continuar con los
    // módulos que sí tiene habilitados.
    if (!this.canReadProducts) {
      this.alertService.error('No tienes permisos para consultar productos en la empresa seleccionada.');
      return;
    }

    this.cargarProductos();
    this.loadCategory();
    this.loadTaxes();
  }

  get isLiteMode(): boolean {
    return this.capabilities.isLiteMode;
  }

  get inventoryEnabled(): boolean {
    return this.capabilities.isEnabled('inventory');
  }

  get canReadProducts(): boolean {
    return this.capabilities.isEnabled('products') && this.capabilities.hasPermission('products.read');
  }

  get canManageProducts(): boolean {
    return this.capabilities.isEnabled('products') && this.capabilities.hasPermission('products.manage');
  }

  get searchTerm(): string {
    return this._searchTerm;
  }

  set searchTerm(value: string) {
    this._searchTerm = value || '';
    this.page = 1;
    this.cargarProductos();
  }

  get inventoryControlledCount(): number {
    return this.productos.filter((item) => this.hasInventory(item)).length;
  }

  get lowStockCount(): number {
    return this.productos.filter((item) => this.isLowStock(item)).length;
  }

  get outOfStockCount(): number {
    return this.productos.filter((item) => this.isOutOfStock(item)).length;
  }

  get f() {
    return this.productoForm.controls;
  }

  cargarProductos() {
    this.spinner.show();
    const offset = (this.page - 1) * this.pageSize;
    const activeFilter = this.soloActivos ? 1 : null;
    const statusFilter = this.soloActivos ? 'Activo' : undefined;
    this.productsService.getAll(activeFilter, this.pageSize, offset, this._searchTerm, statusFilter, this.categoriaFiltro, this.soloBajoStock).subscribe({
      next: (res: any) => {
        const message = res?.message ?? res ?? {};
        const data = Array.isArray(message?.data) ? message.data : (Array.isArray(res) ? res : []);
        // `get_productos` ya excluye las variantes (is_variant = 1) y calcula
        // `variant_count`/`total` sobre esa base; no se vuelve a filtrar acá
        // para no esconder en silencio un futuro cambio de contrato.
        this.productos = Array.isArray(data) ? data : [];
        this.pageSize = Number(message?.limit ?? this.pageSize) || this.pageSize;
        const responseOffset = Number(message?.offset);
        if (Number.isFinite(responseOffset) && responseOffset >= 0) {
          this.page = Math.floor(responseOffset / this.pageSize) + 1;
        }
        this.totalProducts = Number(message?.total ?? this.productos.length) || 0;
        const hasNext = Boolean(message?.has_next ?? message?.hasNext);
        this.totalPages = Math.max(1, Math.ceil(this.totalProducts / this.pageSize), hasNext ? this.page + 1 : 1);
        this.productosFiltradosList = [...this.productos];
      },
      error: (error: any) => {
        const mensaje = this.frappeErrorService.handle(error);
        this.alertService.error(mensaje);
      },
      complete: () => {
        this.spinner.hide();
      }
    });
  }

  loadCategory() {
    this.spinner.show();
    this.categoryService.getAll(this.isLiteMode ? 1 : undefined).subscribe({
      next: (res: any) => {
        this.categories = Array.isArray(res) ? res : (res?.message?.data || res?.data || []);
      },
      error: (error: any) => {
        this.categories = [];
        this.alertService.error(this.frappeErrorService.handle(error));
      },
      complete: () => {
        this.spinner.hide();
      }
    });
  }

  loadTaxes() {
    this.spinner.show();
    this.taxesService.getAll().subscribe({
      next: (res: any) => {
        this.taxes = res?.data || [];
      },
      error: () => {
        this.taxes = [];
      },
      complete: () => {
        this.spinner.hide();
      }
    });
  }

  actualizarProductosFiltrados() {
    this.page = 1;
    this.cargarProductos();
  }

  limpiarFiltros() {
    this._searchTerm = '';
    this.categoriaFiltro = '';
    this.soloActivos = false;
    this.soloBajoStock = false;
    this.page = 1;
    this.actualizarProductosFiltrados();
  }

  abrirModal(producto: Product | null = null) {
    if (!this.canManageProducts) {
      this.alertService.error('No tienes permiso products.manage para crear o editar productos.');
      return;
    }

    this.mostrarModal = true;
    this.submitted = false;
    this.productoEditando = producto;
    // Al crear, primero preguntamos qué tipo de producto es. Al editar, el
    // tipo ya está definido por si el producto tiene variantes o no.
    this.productModalStep = producto ? 'simple' : 'choose';
    this.stockEditMode = 'absolute';
    this.selectedImageFile = null;
    this.imagePreview = producto?.image_url || producto?.image || '';
    this.resetForm();

    if (!producto) {
      return;
    }

    this.productoForm.patchValue({
      name: producto.name,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      precio: producto.precio,
      tax: this.resolveTaxControlValue(producto),
      categoria: producto.categoria,
      codigo: producto.codigo,
      isactive: toInventoryBool(producto.isactive),
      controlar_inventario: this.hasInventory(producto),
      unidad_inventario: producto.unidad_inventario || 'und',
      stock_minimo: toInventoryNumber(producto.stock_minimo, 0),
      permitir_stock_negativo: toInventoryBool(producto.permitir_stock_negativo),
      stock_inicial: '',
      stock_actual: toInventoryNumber(producto.stock_actual, 0),
      stock_objetivo: '',
      stock_ajuste: '',
      ultima_actualizacion_stock: producto.ultima_actualizacion_stock || '',
      is_out_of_stock: toInventoryBool(producto.is_out_of_stock),
    });

    this.syncInventoryValidators();

    // El precio/impuesto de un producto que ya tiene variantes no se usa
    // para nada al vender (cada variante tiene el suyo): se deshabilitan
    // para que no parezca editable algo que no hace efecto.
    if ((producto.variant_count || 0) > 0) {
      this.f['precio'].disable();
      this.f['tax'].disable();
    }
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.submitted = false;
    this.productoEditando = null;
    this.productModalStep = 'simple';
    this.stockEditMode = 'absolute';
    this.selectedImageFile = null;
    this.imagePreview = '';
    this.resetForm();
  }

  /** El usuario elige el tipo de producto en el paso previo a crear. */
  seleccionarTipoProducto(tipo: 'simple' | 'grouped'): void {
    this.productModalStep = tipo;
    this.syncInventoryValidators();
  }

  onProductImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    const extension = file.name.toLowerCase().split('.').pop() || '';
    if (!allowed.includes(file.type) && !['png', 'jpg', 'jpeg', 'webp'].includes(extension)) {
      this.alertService.error('La imagen debe estar en formato PNG, JPG, JPEG o WEBP.');
      input.value = '';
      return;
    }
    this.selectedImageFile = file;
    this.imagePreview = URL.createObjectURL(file);
  }

  guardarProducto() {
    if (!this.canManageProducts) {
      this.alertService.error('No tienes permiso products.manage para guardar productos.');
      return;
    }

    this.submitted = true;
    this.syncInventoryValidators();

    if (this.productoForm.invalid) {
      this.productoForm.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    if (this.productoEditando) {
      this.updateProduct(payload);
      return;
    }

    this.createProduct(payload);
  }

  createProduct(data: any) {
    this.spinner.show();
    const image = this.selectedImageFile;
    // Se captura antes de guardar: cerrarModal() ya deja productModalStep en
    // 'simple' apenas la petición resuelve.
    const isGroupedCreation = this.productModalStep === 'grouped';
    this.productsService.create(data).pipe(
      switchMap((created: any) => {
        const itemName = String(created?.name || created?.item || '').trim();
        if (!image) return of({ product: created, imageError: null });
        if (!itemName) return of({ product: created, imageError: new Error('El backend no devolvió el nombre del producto creado para cargar la imagen.') });
        return this.productsService.uploadImage(itemName, image).pipe(
          map((uploaded: any) => ({ product: { ...created, ...uploaded }, imageError: null })),
          catchError((error: any) => of({ product: created, imageError: error }))
        );
      }),
      finalize(() => this.spinner.hide())
    ).subscribe({
      next: (result: any) => {
        this.upsertProduct(result.product);
        this.cerrarModal();
        if (result.imageError) {
          this.alertService.error(this.frappeErrorService.handle(result.imageError) || 'Producto creado, pero no se pudo cargar la imagen.');
          toast.success('Producto creado');
        } else {
          toast.success(image ? 'Producto creado con imagen' : 'Producto creado con exito');
        }
        // El producto agrupador ya existe; se pasa directo a definir su
        // primera variante en vez de mandar al usuario a buscarla aparte.
        if (isGroupedCreation && result.product) {
          this.abrirVariantes(result.product);
          this.abrirFormVariante();
        }
      },
      error: (error: any) => {
        const mensaje = this.frappeErrorService.handle(error);
        this.alertService.error(mensaje);
      }
    });
  }

  updateProduct(data: any) {
    if (!this.productoEditando?.name) {
      return;
    }

    this.spinner.show();
    const image = this.selectedImageFile;
    this.productsService.update(this.productoEditando.name, data).pipe(
      switchMap((updated: any) => {
        if (!image) return of({ product: updated, imageError: null });
        return this.productsService.uploadImage(String(this.productoEditando?.name || updated?.name || ''), image).pipe(
          map((uploaded: any) => ({ product: { ...updated, ...uploaded }, imageError: null })),
          catchError((error: any) => of({ product: updated, imageError: error }))
        );
      }),
      finalize(() => this.spinner.hide())
    ).subscribe({
      next: (result: any) => {
        this.upsertProduct(result.product);
        this.cerrarModal();
        if (result.imageError) {
          this.alertService.error(this.frappeErrorService.handle(result.imageError) || 'Producto actualizado, pero no se pudo cargar la imagen.');
        } else {
          toast.success(image ? 'Producto actualizado con imagen' : 'Producto actualizado con exito');
        }
      },
      error: (error: any) => {
        const mensaje = this.frappeErrorService.handle(error);
        this.alertService.error(mensaje);
      }
    });
  }

  private upsertProduct(product: Product | null | undefined): void {
    if (!product) return;
    const index = this.productos.findIndex((item) => item.name === product.name);
    if (index >= 0) {
      this.productos = this.productos.map((item, i) => i === index ? { ...item, ...product } : item);
    } else {
      this.productos = [...this.productos, product];
    }
    this.actualizarProductosFiltrados();
  }

  eliminar(id: string) {
    if (!this.canManageProducts) {
      this.alertService.error('No tienes permiso products.manage para eliminar productos.');
      return;
    }

    this.alertService.confirm('Se eliminara el producto seleccionado.', 'Confirmar').then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.spinner.show();
      this.productsService.delete(id).subscribe({
        next: () => {
          toast.success('Producto eliminado con exito');
          this.cargarProductos();
        },
        error: (err) => {
          const mensaje = this.frappeErrorService.handle(err);
          this.alertService.error(mensaje);
          this.spinner.hide();
        },
        complete: () => {
          this.spinner.hide();
        }
      });
    });
  }

  onInventoryToggle() {
    if (!this.f['controlar_inventario'].value) {
      this.f['unidad_inventario'].setValue('und');
      this.f['stock_minimo'].setValue(0);
      this.f['permitir_stock_negativo'].setValue(false);
      this.f['stock_inicial'].setValue(0);
      this.f['stock_objetivo'].setValue('');
      this.f['stock_ajuste'].setValue('');
    } else if (!this.f['unidad_inventario'].value) {
      this.f['unidad_inventario'].setValue('und');
    }

    this.syncInventoryValidators();
  }

  setStockMode(mode: StockEditMode) {
    this.stockEditMode = mode;
    if (mode === 'absolute') {
      this.f['stock_ajuste'].setValue('');
    } else {
      this.f['stock_objetivo'].setValue('');
    }
    this.syncInventoryValidators();
  }

  resetForm() {
    this.productoForm = this.fb.group({
      name: [''],
      nombre: ['', Validators.required],
      descripcion: [''],
      precio: [null, [Validators.required, Validators.min(0)]],
      tax: [null, Validators.required],
      categoria: ['', this.isLiteMode ? [] : [Validators.required]],
      codigo: [''],
      isactive: [true],
      controlar_inventario: [false],
      unidad_inventario: ['und'],
      stock_minimo: [0],
      permitir_stock_negativo: [false],
      stock_inicial: [0],
      stock_actual: [{ value: 0, disabled: false }],
      stock_objetivo: [''],
      stock_ajuste: [''],
      ultima_actualizacion_stock: [''],
      is_out_of_stock: [false],
    });

    this.syncInventoryValidators();
  }

  syncInventoryValidators() {
    const isGrouped = this.productModalStep === 'grouped';

    // Un producto agrupador no tiene precio/impuesto/categoría propios: cada
    // variante los define por su cuenta. Se dejan sin validar y en blanco
    // para no pedir datos que no significan nada en este registro.
    if (isGrouped) {
      this.f['precio'].clearValidators();
      this.f['tax'].clearValidators();
      this.f['categoria'].clearValidators();
    } else {
      this.f['precio'].setValidators([Validators.required, Validators.min(0)]);
      this.f['tax'].setValidators([Validators.required]);
      this.f['categoria'].setValidators(this.isLiteMode ? [] : [Validators.required]);
    }
    this.f['precio'].updateValueAndValidity({ emitEvent: false });
    this.f['tax'].updateValueAndValidity({ emitEvent: false });
    this.f['categoria'].updateValueAndValidity({ emitEvent: false });

    const controlsInventory = !isGrouped && !!this.f['controlar_inventario'].value;

    this.f['unidad_inventario'].clearValidators();
    this.f['stock_minimo'].clearValidators();
    this.f['stock_inicial'].clearValidators();
    this.f['stock_objetivo'].clearValidators();
    this.f['stock_ajuste'].clearValidators();

    if (controlsInventory) {
      this.f['unidad_inventario'].setValidators([Validators.required, Validators.maxLength(12)]);
      this.f['stock_minimo'].setValidators([Validators.required, Validators.min(0)]);

      if (!this.isLiteMode && !this.productoEditando) {
        this.f['stock_inicial'].setValidators([Validators.required, Validators.min(0)]);
      } else if (!this.isLiteMode && this.stockEditMode === 'absolute') {
        this.f['stock_objetivo'].setValidators([Validators.min(0)]);
      }
    }

    this.f['unidad_inventario'].updateValueAndValidity({ emitEvent: false });
    this.f['stock_minimo'].updateValueAndValidity({ emitEvent: false });
    this.f['stock_inicial'].updateValueAndValidity({ emitEvent: false });
    this.f['stock_objetivo'].updateValueAndValidity({ emitEvent: false });
    this.f['stock_ajuste'].updateValueAndValidity({ emitEvent: false });
  }

  buildPayload(): any {
    const raw = this.productoForm.getRawValue();
    const payload: any = {
      // Refuerzo al guardar, no solo al tipear: un producto viejo en
      // minúscula que se edita sin retocar el nombre también debe quedar
      // en mayúscula (mismo criterio que Clientes).
      nombre: String(raw.nombre || '').toUpperCase().trim(),
      descripcion: String(raw.descripcion || '').toUpperCase().trim(),
      precio: Number(raw.precio || 0),
      tax: raw.tax,
      tax_value: this.resolveTaxRate(raw.tax),
      codigo: String(raw.codigo || '').trim(),
      isactive: !!raw.isactive,
      controlar_inventario: !!raw.controlar_inventario,
    };

    if (!this.isLiteMode || raw.categoria) {
      payload.categoria = raw.categoria;
    }
    if (this.isLiteMode) {
      const rawCategory = String(raw.categoria || '').trim();
      const selectedCategory = this.categories.find((category: any) =>
        String(category?.name || '') === rawCategory ||
        String(category?.category_name || category?.nombre || '').trim().toLowerCase() === rawCategory.toLowerCase()
      );
      // Solo se envía el identificador interno. Si la lista aún no llegó,
      // conservamos el valor para permitir editar sin perder una referencia
      // válida; las nuevas selecciones siempre provienen del <select>.
      payload.category = selectedCategory?.name || (this.categories.length === 0 ? rawCategory : '');
      payload.description = String(raw.descripcion || '').trim();
    }

    if (payload.controlar_inventario) {
      payload.unidad_inventario = String(raw.unidad_inventario || '').trim();
      payload.stock_minimo = Number(raw.stock_minimo || 0);
      payload.permitir_stock_negativo = !!raw.permitir_stock_negativo;

      if (!this.productoEditando) {
        payload.stock_inicial = Number(raw.stock_inicial || 0);
      } else if (this.stockEditMode === 'absolute' && raw.stock_objetivo !== '' && raw.stock_objetivo !== null) {
        payload.stock_actual = Number(raw.stock_objetivo);
      } else if (this.stockEditMode === 'delta' && raw.stock_ajuste !== '' && raw.stock_ajuste !== null && Number(raw.stock_ajuste) !== 0) {
        payload.stock_ajuste = Number(raw.stock_ajuste);
      }
    }

    return payload;
  }

  getNameCategory(categoryId?: string | null): string {
    const document = this.categories.find((d) => d.name === categoryId);
    return document?.nombre || categoryId || '—';
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

  getInventoryUnit(product: Partial<Product> | null | undefined): string {
    return getInventoryUnit(product);
  }

  formatStock(product: Partial<Product> | null | undefined): string {
    if (!this.hasInventory(product)) {
      return 'No aplica';
    }

    return `${toInventoryNumber(product?.stock_actual, 0)} ${this.getInventoryUnit(product)}`;
  }

  private resolveTaxRate(selectedTax: any): number {
    const tax = this.taxes.find((item) =>
      String(item?.name ?? '').trim() === String(selectedTax ?? '').trim() ||
      String(item?.value ?? '').trim() === String(selectedTax ?? '').trim()
    );

    const value = tax?.value ?? tax?.rate ?? tax?.tax_rate ?? selectedTax;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

    const direct = Number(value);
    if (Number.isFinite(direct)) return direct;

    const match = String(value || '').match(/\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  private resolveTaxControlValue(product: Partial<Product> | null | undefined): any {
    const selected = (product as any)?.tax ?? (product as any)?.tax_id;
    const rate = Number((product as any)?.tax_value ?? (product as any)?.iva ?? (product as any)?.tax_rate);

    if (selected && this.taxes.some((tax) => String(tax?.name ?? '') === String(selected))) {
      return selected;
    }

    if (Number.isFinite(rate)) {
      const match = this.taxes.find((tax) => Number(tax?.value ?? tax?.rate ?? tax?.tax_rate) === rate);
      if (match) return match.name ?? match.value;
    }

    return selected ?? null;
  }

  trackByName = (_: number, item: Product) => item?.name || item?.codigo || item?.nombre;

  // ================================================================
  // Variantes de producto (Color/Talla, boutique)
  // ================================================================

  /** Todo producto sin variante propia puede tener variantes; el botón queda visible siempre para no exigir un flag adicional del backend. */
  canHaveVariants(product: Partial<Product> | null | undefined): boolean {
    return product?.is_variant !== 1 && product?.is_variant !== true;
  }

  /** Atajo desde "Editar Producto": cierra el modal de edición (donde precio/stock no aplican) y abre directo las variantes. */
  irAVariantesDesdeEdicion(): void {
    const producto = this.productoEditando;
    this.cerrarModal();
    if (producto) this.abrirVariantes(producto);
  }

  abrirVariantes(producto: Product): void {
    this.variantesParent = producto;
    this.variantesModalVisible = true;
    this.variantesPage = 1;
    this.variantesFiltroAtributos = {};
    this.cargarVariantes();
  }

  cerrarVariantes(): void {
    this.variantesRequestSub?.unsubscribe();
    this.variantesModalVisible = false;
    this.variantesParent = null;
    this.variantes = [];
    this.variantesAttributeDefinitions = [];
    this.varianteFormVisible = false;
  }

  cargarVariantes(): void {
    if (!this.variantesParent?.name) return;
    // Si había una consulta anterior en curso (por ejemplo, el usuario volvió
    // a apretar "Variantes" o cambió de página antes de que respondiera),
    // se cancela: nunca deben quedar dos peticiones al mismo endpoint
    // corriendo a la vez ni una respuesta vieja pisando el estado actual.
    this.variantesRequestSub?.unsubscribe();
    this.variantesLoading = true;
    const offset = (this.variantesPage - 1) * this.variantesPageSize;
    this.variantesRequestSub = this.productsService.getVariantes(this.variantesParent.name, this.variantesPageSize, offset).pipe(
      finalize(() => { this.variantesLoading = false; })
    ).subscribe({
      next: (res: any) => {
        this.variantes = res.data;
        this.variantesTotal = res.total;
        this.variantesTotalPages = Math.max(1, Math.ceil(this.variantesTotal / this.variantesPageSize));
        // Se calcula una sola vez por respuesta, no en cada ciclo de detección
        // de cambios: `getVariantAttributeDefinitions` crea objetos nuevos en
        // cada llamada, y usarla como getter en el *ngFor del filtro hacía que
        // Angular recreara el <select> con [ngModel] en cada ciclo, lo que a
        // su vez disparaba otro ciclo — un bucle infinito que congelaba la
        // pestaña en cuanto había al menos una variante.
        this.variantesAttributeDefinitions = getVariantAttributeDefinitions(this.variantes);
        // La cuenta que muestra la tabla principal (badge y botón "Variantes")
        // viene de `get_productos` y queda desactualizada apenas se crea o
        // elimina una variante desde este modal. Se sincroniza acá porque
        // `variantesTotal` siempre refleja el total real recién consultado.
        this.syncParentVariantCount(this.variantesTotal);
      },
      error: (error: any) => {
        this.variantes = [];
        this.variantesAttributeDefinitions = [];
        this.alertService.error(this.frappeErrorService.handle(error) || 'No se pudo consultar las variantes de este producto.');
      }
    });
  }

  /**
   * Refleja el total real de variantes en el producto principal, tanto en el
   * modal abierto como en la tabla de fondo — sin recargar el catálogo desde
   * el servidor (eso resetearía la página/búsqueda actual del listado).
   */
  private syncParentVariantCount(count: number): void {
    const parentId = this.variantesParent?.name;
    if (!parentId) return;
    if (this.variantesParent) this.variantesParent = { ...this.variantesParent, variant_count: count };
    const patch = (list: Product[]) => list.map((item) => item.name === parentId ? { ...item, variant_count: count } : item);
    this.productos = patch(this.productos);
    this.productosFiltradosList = patch(this.productosFiltradosList);
  }

  onVariantesPage(page: number): void {
    if (page === this.variantesPage) return;
    this.variantesPage = page;
    this.cargarVariantes();
  }

  onVariantesPageSize(size: number): void {
    this.variantesPageSize = size;
    this.variantesPage = 1;
    this.cargarVariantes();
  }

  /**
   * Atributos disponibles (Color, Talla...) derivados de las variantes ya
   * cargadas, para el filtro de la lista. Se recalcula explícitamente en
   * `cargarVariantes()`, nunca como getter leído desde el template: ver la
   * nota en esa función.
   */
  variantesAttributeDefinitions: VariantAttributeDefinition[] = [];

  trackByAttribute = (_: number, def: VariantAttributeDefinition) => def.attribute;

  get variantesFiltradas(): Product[] {
    const filtros = Object.entries(this.variantesFiltroAtributos).filter(([, value]) => !!value);
    if (!filtros.length) return this.variantes;
    return this.variantes.filter((variante) =>
      filtros.every(([attribute, value]) =>
        (variante.attributes || []).some((attr) => attr.attribute === attribute && attr.value === value)
      )
    );
  }

  onVariantesFiltroChange(attribute: string, value: string): void {
    this.variantesFiltroAtributos = { ...this.variantesFiltroAtributos, [attribute]: value };
  }

  formatAttributes(variante: Partial<Product> | null | undefined): string {
    return formatVariantAttributes(variante);
  }

  eliminarVariante(name: string): void {
    if (!this.canManageProducts) {
      this.alertService.error('No tienes permiso products.manage para eliminar variantes.');
      return;
    }

    this.alertService.confirm('Se eliminara la variante seleccionada.', 'Confirmar').then((result) => {
      if (!result.isConfirmed) return;

      this.spinner.show();
      this.productsService.delete(name).subscribe({
        next: () => {
          toast.success('Variante eliminada con exito');
          this.cargarVariantes();
        },
        error: (err) => {
          this.alertService.error(this.frappeErrorService.handle(err));
          this.spinner.hide();
        },
        complete: () => this.spinner.hide()
      });
    });
  }

  // --- Formulario de variante ---

  get vf() {
    return this.varianteForm.controls;
  }

  get vfAttributes(): FormArray {
    return this.varianteForm.get('attributes') as FormArray;
  }

  abrirFormVariante(variante: Product | null = null): void {
    if (!this.canManageProducts) {
      this.alertService.error('No tienes permiso products.manage para crear o editar variantes.');
      return;
    }

    this.varianteEditando = variante;
    this.varianteSubmitted = false;
    this.resetVarianteForm();
    this.varianteFormVisible = true;

    if (variante) this.prefillVarianteForm(variante);
  }

  /**
   * Abre "Nueva variante" precargada con los datos de una variante existente
   * (nombre, código, precio, impuesto, atributos). Pensado para variantes muy
   * parecidas entre sí: solo hay que ajustar el atributo que cambia (color,
   * talla) y el código, en vez de tipear el formulario completo de nuevo.
   */
  duplicarVariante(variante: Product): void {
    if (!this.canManageProducts) {
      this.alertService.error('No tienes permiso products.manage para duplicar variantes.');
      return;
    }

    this.varianteEditando = null;
    this.varianteSubmitted = false;
    this.resetVarianteForm();
    this.varianteFormVisible = true;
    this.prefillVarianteForm(variante);
  }

  private prefillVarianteForm(variante: Product): void {
    this.varianteForm.patchValue({
      item_name: variante.nombre,
      item_code: variante.codigo,
      standard_rate: variante.precio,
      tax_rate: variante.tax_value ?? 0,
      track_stock: !!variante.track_stock,
      isactive: toInventoryBool(variante.isactive ?? true),
    });

    this.vfAttributes.clear();
    const attrs = Array.isArray(variante.attributes) ? variante.attributes : [];
    attrs.forEach((a) => this.addAtributoRow(a.attribute, a.value));
    if (!this.vfAttributes.length) this.addAtributoRow();
  }

  cerrarFormVariante(): void {
    this.varianteFormVisible = false;
    this.varianteEditando = null;
    this.varianteSubmitted = false;
  }

  resetVarianteForm(): void {
    this.varianteForm = this.fb.group({
      item_name: ['', Validators.required],
      item_code: ['', Validators.required],
      standard_rate: [null, [Validators.required, Validators.min(0)]],
      tax_rate: [0, Validators.required],
      track_stock: [true],
      isactive: [true],
      // Solo se usa al crear (nunca al editar): registra un movimiento de
      // Entrada después de crear la variante, igual que si se hiciera desde
      // Inventario, para no perder el historial de movimientos.
      stock_inicial: [0, [Validators.min(0)]],
      attributes: this.fb.array([]),
    });
    this.vfAttributes.clear();
    // Color y Talla son los atributos habituales en boutique; quedan como
    // punto de partida editable, no como una lista cerrada de opciones.
    this.addAtributoRow('Color', '');
    this.addAtributoRow('Talla', '');
  }

  addAtributoRow(attribute = '', value = ''): void {
    this.vfAttributes.push(this.fb.group({
      attribute: [attribute, Validators.required],
      value: [value, Validators.required],
    }));
  }

  removeAtributoRow(index: number): void {
    if (this.vfAttributes.length <= 1) return;
    this.vfAttributes.removeAt(index);
  }

  guardarVariante(): void {
    if (!this.canManageProducts) {
      this.alertService.error('No tienes permiso products.manage para guardar variantes.');
      return;
    }

    this.varianteSubmitted = true;
    if (this.varianteForm.invalid || !this.vfAttributes.length) {
      this.varianteForm.markAllAsTouched();
      return;
    }

    if (!this.variantesParent?.name) return;

    const raw = this.varianteForm.getRawValue();
    const payload = this.buildVariantePayload();
    const isCreate = !this.varianteEditando;
    // El stock inicial nunca se manda dentro del alta del Item: se registra
    // como un movimiento de Entrada aparte (el mismo que usa Inventario), así
    // queda el historial igual que si se hubiera cargado desde esa pantalla.
    const stockInicial = isCreate && raw.track_stock ? Number(raw.stock_inicial || 0) : 0;

    this.spinner.show();
    const request$ = this.varianteEditando
      ? this.productsService.updateVariante(this.varianteEditando.name, payload)
      : this.productsService.createVariante(payload);

    request$.pipe(
      switchMap((variante: any) => {
        if (stockInicial <= 0) return of({ variante, stockError: null });
        const itemName = String(variante?.name || '').trim();
        if (!itemName) {
          return of({ variante, stockError: new Error('El backend no devolvió el nombre de la variante para registrar el stock inicial.') });
        }
        return this.inventoryService.createInventoryMovement({
          item: itemName,
          movement_type: 'Entrada',
          quantity: stockInicial,
          notes: 'Stock inicial al crear la variante'
        }).pipe(
          map(() => ({ variante, stockError: null })),
          catchError((error: any) => of({ variante, stockError: error }))
        );
      }),
      finalize(() => this.spinner.hide())
    ).subscribe({
      next: (result: any) => {
        this.cerrarFormVariante();
        this.cargarVariantes();
        if (result.stockError) {
          this.alertService.error(this.frappeErrorService.handle(result.stockError) || 'La variante se creó, pero no se pudo registrar el stock inicial.');
          toast.success('Variante creada');
        } else {
          toast.success(this.varianteEditando
            ? 'Variante actualizada con exito'
            : (stockInicial > 0 ? 'Variante creada con stock inicial registrado' : 'Variante creada con exito'));
        }
      },
      error: (error: any) => {
        this.alertService.error(this.frappeErrorService.handle(error));
      }
    });
  }

  private buildVariantePayload(): any {
    const raw = this.varianteForm.getRawValue();
    return {
      item_name: String(raw.item_name || '').toUpperCase().trim(),
      item_code: String(raw.item_code || '').trim(),
      item_type: 'Producto',
      variant_of: this.variantesParent?.name,
      is_variant: 1,
      attributes: (raw.attributes || [])
        .map((a: any) => ({ attribute: String(a.attribute || '').trim(), value: String(a.value || '').trim() }))
        .filter((a: any) => a.attribute && a.value),
      standard_rate: Number(raw.standard_rate || 0),
      tax_rate: Number(raw.tax_rate || 0),
      track_stock: raw.track_stock ? 1 : 0,
      isactive: !!raw.isactive,
    };
  }

  trackByVarianteName = (_: number, item: Product) => item?.name;
}
