import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { InventoryMovement, InventoryMovementPayload, InventoryMovementType, InventoryProduct } from 'src/app/models/inventory';
import { Product } from 'src/app/core/models/product';
import { AlertService } from 'src/app/core/services/alert.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { ProductsService } from 'src/app/services/products.service';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import {
  canSellProduct,
  getInventoryUnit,
  hasInventoryControl,
  isLowStockProduct,
  isOutOfStockProduct,
  toInventoryNumber,
} from 'src/app/shared/utils/inventory.utils';

@Component({
  selector: 'app-inventory',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonComponent],
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
  movements: InventoryMovement[] = [];
  activeTab: 'overview' | 'history' = 'overview';

  search = '';
  onlyLowStock = false;
  onlyActive = true;

  historyProduct = '';
  historyMovementType = '';
  historyLimit = 10;
  historyOffset = 0;
  historyTotal = 0;

  expandedMovementName = '';
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
    private alertService: AlertService
  ) { }

  ngOnInit(): void {
    this.initMovementForm();
    this.cargarProductosInventario();
    this.cargarOpcionesProducto();
    this.cargarMovimientos();
  }

  get movementItems(): FormArray {
    return this.movementForm.get('items') as FormArray;
  }

  get controlledProductsCount(): number {
    return this.inventoryProducts.filter((item) => this.hasInventory(item)).length;
  }

  get lowStockCount(): number {
    return this.inventoryProducts.filter((item) => this.isLowStock(item)).length;
  }

  get outOfStockCount(): number {
    return this.inventoryProducts.filter((item) => this.isOutOfStock(item)).length;
  }

  get availableProductsCount(): number {
    return this.inventoryProducts.filter((item) => this.canSell(item)).length;
  }

  get currentMovementType(): InventoryMovementType {
    return this.movementForm.get('movement_type')?.value as InventoryMovementType;
  }

  get canGoPrevHistory(): boolean {
    return this.historyOffset > 0;
  }

  get canGoNextHistory(): boolean {
    return this.historyOffset + this.historyLimit < this.historyTotal;
  }

  get historyRangeLabel(): string {
    if (!this.historyTotal) {
      return 'Sin movimientos';
    }

    const start = this.historyOffset + 1;
    const end = Math.min(this.historyOffset + this.historyLimit, this.historyTotal);
    return `${start}-${end} de ${this.historyTotal}`;
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
      quantity: [null, Validators.required],
    });
  }

  cargarProductosInventario(): void {
    this.spinner.show();
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
      },
      complete: () => {
        this.spinner.hide();
      }
    });
  }

  cargarOpcionesProducto(): void {
    this.productsService.getAll(1).subscribe({
      next: (res: any) => {
        const data = res?.message?.data || [];
        this.productOptions = ((Array.isArray(data) ? data : []) as Product[])
          .filter((product) => this.hasInventory(product));
      },
      error: () => {
        this.productOptions = [];
      }
    });
  }

  cargarMovimientos(): void {
    this.spinner.show();
    this.inventoryService.getInventoryMovements({
      limit: this.historyLimit,
      offset: this.historyOffset,
      product: this.historyProduct || undefined,
      movementType: this.historyMovementType || undefined,
    }).subscribe({
      next: (res: any) => {
        const list = this.extractList(res, ['message', 'data']);
        this.movements = (Array.isArray(list) ? list : []) as InventoryMovement[];
        this.historyTotal = this.extractTotal(res, this.movements.length);
      },
      error: (error) => {
        const mensaje = this.frappeErrorService.handle(error);
        this.alertService.error(mensaje);
      },
      complete: () => {
        this.spinner.hide();
      }
    });
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

  nextHistoryPage(): void {
    if (!this.canGoNextHistory) {
      return;
    }
    this.historyOffset += this.historyLimit;
    this.cargarMovimientos();
  }

  prevHistoryPage(): void {
    if (!this.canGoPrevHistory) {
      return;
    }
    this.historyOffset = Math.max(0, this.historyOffset - this.historyLimit);
    this.cargarMovimientos();
  }

  abrirMovimientoModal(): void {
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
      this.movementItems.at(0).reset({ product: '', quantity: null });
      return;
    }
    this.movementItems.removeAt(index);
  }

  guardarMovimiento(): void {
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

  buildMovementPayload(): InventoryMovementPayload | null {
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

  toggleMovementDetail(movement: InventoryMovement): void {
    const key = movement?.name || movement?.creation || '';
    this.expandedMovementName = this.expandedMovementName === key ? '' : key;
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
        return 'Puedes usar positivo o negativo segun la correccion que necesites hacer.';
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

  extractReference(movement: InventoryMovement): string {
    const doctype = movement?.reference_doctype || '';
    const name = movement?.reference_name || '';
    return doctype || name ? `${doctype || 'Ref'} ${name}`.trim() : 'Sin referencia';
  }

  trackByProduct = (_: number, item: InventoryProduct) => item?.name || item?.codigo || _;
  trackByMovement = (_: number, item: InventoryMovement) => item?.name || item?.creation || _;

  private extractList(res: any, preferredPath: string[]): any[] {
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

  private extractTotal(res: any, fallback: number): number {
    return Number(
      res?.message?.total ??
      res?.total ??
      res?.message?.count ??
      fallback
    ) || fallback;
  }
}
