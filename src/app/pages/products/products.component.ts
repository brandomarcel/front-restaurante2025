import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { Product } from 'src/app/core/models/product';
import { AlertService } from 'src/app/core/services/alert.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CategoryService } from 'src/app/services/category.service';
import { ProductsService } from 'src/app/services/products.service';
import { TaxesService } from 'src/app/services/taxes.service';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import {
  getInventoryUnit,
  hasInventoryControl,
  isLowStockProduct,
  isOutOfStockProduct,
  toInventoryBool,
  toInventoryNumber,
} from 'src/app/shared/utils/inventory.utils';

type StockEditMode = 'absolute' | 'delta';

@Component({
  selector: 'app-products',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgxPaginationModule, ButtonComponent],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css'
})
export class ProductsComponent implements OnInit {
  readonly inventoryUnitOptions = [
    { value: 'und', label: 'Unidad (und)' },
    { value: 'kg', label: 'Kilogramo (kg)' },
    { value: 'g', label: 'Gramo (g)' },
    { value: 'lt', label: 'Litro (lt)' },
    { value: 'ml', label: 'Mililitro (ml)' },
    { value: 'porcion', label: 'Porcion' },
    { value: 'caja', label: 'Caja' },
    { value: 'paquete', label: 'Paquete' },
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
  stockEditMode: StockEditMode = 'absolute';

  page = 1;
  pageSize = 10;

  constructor(
    private productsService: ProductsService,
    private categoryService: CategoryService,
    private taxesService: TaxesService,
    public spinner: NgxSpinnerService,
    private fb: FormBuilder,
    private frappeErrorService: FrappeErrorService,
    private alertService: AlertService,
    private capabilities: CompanyCapabilitiesService
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
    return this.capabilities.isEnabled('products');
  }

  get canManageProducts(): boolean {
    return this.capabilities.isEnabled('products');
  }

  get searchTerm(): string {
    return this._searchTerm;
  }

  set searchTerm(value: string) {
    this._searchTerm = value || '';
    this.actualizarProductosFiltrados();
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
    this.productsService.getAll().subscribe({
      next: (res: any) => {
        const data = Array.isArray(res) ? res : (res?.message?.data || []);
        this.productos = Array.isArray(data) ? data : [];
        this.actualizarProductosFiltrados();
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
    const term = (this._searchTerm || '').toLowerCase();
    const cat = this.categoriaFiltro || '';

    this.productosFiltradosList = (this.productos || []).filter((product) => {
      const nombre = String(product?.nombre || '').toLowerCase();
      const codigo = String(product?.codigo || '').toLowerCase();
      const byText = !term || nombre.includes(term) || codigo.includes(term);
      const productCategory = product?.categoria || (product as any)?.category || '';
      const byCat = !cat || String(productCategory).toLowerCase().includes(cat.toLowerCase());
      const byActive = !this.soloActivos || toInventoryBool(product?.isactive);
      const byLowStock = !this.soloBajoStock || this.isLowStock(product);

      return byText && byCat && byActive && byLowStock;
    }).sort((a, b) => String(a?.nombre || '').localeCompare(String(b?.nombre || '')));

    if (this.page > 1 && (this.productosFiltradosList.length || 0) <= ((this.page - 1) * this.pageSize)) {
      this.page = 1;
    }
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
    this.stockEditMode = 'absolute';
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
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.submitted = false;
    this.productoEditando = null;
    this.stockEditMode = 'absolute';
    this.resetForm();
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
    this.productsService.create(data).subscribe({
      next: () => {
        toast.success('Producto creado con exito');
        this.cerrarModal();
        this.cargarProductos();
      },
      error: (error: any) => {
        const mensaje = this.frappeErrorService.handle(error);
        this.alertService.error(mensaje);
        this.spinner.hide();
      },
      complete: () => {
        this.spinner.hide();
      }
    });
  }

  updateProduct(data: any) {
    if (!this.productoEditando?.name) {
      return;
    }

    this.spinner.show();
    this.productsService.update(this.productoEditando.name, data).subscribe({
      next: () => {
        toast.success('Producto actualizado con exito');
        this.cerrarModal();
        this.cargarProductos();
      },
      error: (error: any) => {
        const mensaje = this.frappeErrorService.handle(error);
        this.alertService.error(mensaje);
        this.spinner.hide();
      },
      complete: () => {
        this.spinner.hide();
      }
    });
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
    const controlsInventory = !!this.f['controlar_inventario'].value;

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
      nombre: raw.nombre,
      descripcion: raw.descripcion,
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
}
