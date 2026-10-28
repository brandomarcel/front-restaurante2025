import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { toast } from 'ngx-sonner';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import {
  Ingredient,
  IngredientFilter,
  IngredientState,
  KITCHEN_UNITS,
  KitchenSuppliesService,
} from 'src/app/services/kitchen-supplies.service';
import { KitchenWarehousePickerComponent } from './kitchen-warehouse-picker.component';
import { InventoryNavComponent } from 'src/app/shared/components/inventory-nav/inventory-nav.component';
import { debouncedCallback } from 'src/app/shared/utils/debounced-callback';

type MovementKind = 'Entrada' | 'Salida' | 'Ajuste';

@Component({
  selector: 'app-ingredients',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, InventoryNavComponent, KitchenWarehousePickerComponent],
  templateUrl: './ingredients.component.html',
})
export class IngredientsComponent implements OnInit {
  private readonly supplies = inject(KitchenSuppliesService);
  private readonly capabilities = inject(CompanyCapabilitiesService);
  private readonly alerts = inject(AlertService);
  private readonly errors = inject(FrappeErrorService);
  private readonly destroyRef = inject(DestroyRef);

  readonly units = KITCHEN_UNITS;
  readonly unitGroups = ['Peso', 'Volumen', 'Conteo'];

  rows: Ingredient[] = [];
  counts: Record<string, number> = { all: 0, ok: 0, low: 0, out: 0 };
  filter: IngredientFilter = 'all';
  search = '';
  loading = true;
  loadError = '';
  /** La primera carga sin insumos muestra la guía de arranque en vez de una tabla vacía. */
  loadedOnce = false;

  // Alta / edición
  formOpen = false;
  editing: Ingredient | null = null;
  form = { name: '', unit: 'kg', minimum_stock: 0, initial_stock: 0 };
  formSubmitted = false;
  saving = false;

  // Movimiento
  moveTarget: Ingredient | null = null;
  moveKind: MovementKind = 'Entrada';
  moveQty: number | null = null;
  moveNote = '';
  moveSubmitted = false;

  private readonly reloadSearch = debouncedCallback(this.destroyRef, () => this.load(), 300);

  ngOnInit(): void {
    this.load();
  }

  get enabled(): boolean {
    return this.capabilities.isEnabled('inventory') && this.capabilities.isEnabled('restaurant');
  }

  get canCreate(): boolean {
    return this.capabilities.hasPermission('products.manage');
  }

  get canMove(): boolean {
    return this.capabilities.hasPermission('inventory.manage');
  }

  /** Solo administradores, y solo mientras el negocio use inventario Simple (el restaurante no ve bodegas si no las necesita). */
  get canOfferWarehouses(): boolean {
    return !this.capabilities.isWarehouseMode && this.capabilities.hasPermission('business.settings.manage');
  }

  get needsWarehouse(): boolean {
    return this.capabilities.isWarehouseMode && !this.supplies.warehouse;
  }

  get hasFilters(): boolean {
    return !!this.search.trim() || this.filter !== 'all';
  }

  load(): void {
    if (this.needsWarehouse) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.loadError = '';
    this.supplies
      .getIngredients({ search: this.search, filter: this.filter })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.rows = page.data;
          this.counts = { all: 0, ok: 0, low: 0, out: 0, ...page.counts };
          this.loading = false;
          this.loadedOnce = true;
        },
        error: (error) => {
          this.loading = false;
          this.loadError = this.errors.handle(error) || 'No se pudieron cargar los insumos.';
        },
      });
  }

  onSearch(value: string): void {
    this.search = value;
    this.reloadSearch();
  }

  setFilter(filter: IngredientFilter): void {
    this.filter = this.filter === filter ? 'all' : filter;
    this.load();
  }

  clearFilters(): void {
    this.search = '';
    this.filter = 'all';
    this.load();
  }

  get isFirstRun(): boolean {
    return this.loadedOnce && !this.loading && !this.loadError && !this.counts['all'] && !this.hasFilters;
  }

  stateLabel(state: IngredientState): string {
    return state === 'out' ? 'Agotado' : state === 'low' ? 'Por reponer' : 'Disponible';
  }

  stateTone(state: IngredientState): string {
    return state === 'out'
      ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
      : state === 'low'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
  }

  /** Barra de stock respecto al doble del mínimo: da una idea de cuánto falta sin números. */
  fillPercent(row: Ingredient): number {
    const reference = Math.max(Number(row.minimum_stock) * 2, Number(row.current_stock), 1);
    return Math.max(0, Math.min(100, (Number(row.current_stock) / reference) * 100));
  }

  trackByName = (_: number, row: Ingredient) => row.name;

  // ---------- Alta / edición ----------

  openCreate(): void {
    this.editing = null;
    this.form = { name: '', unit: 'kg', minimum_stock: 0, initial_stock: 0 };
    this.formSubmitted = false;
    this.formOpen = true;
  }

  openEdit(row: Ingredient): void {
    this.editing = row;
    this.form = { name: row.item_name, unit: row.unit || 'und', minimum_stock: Number(row.minimum_stock) || 0, initial_stock: 0 };
    this.formSubmitted = false;
    this.formOpen = true;
  }

  closeForm(): void {
    if (this.saving) return;
    this.formOpen = false;
    this.editing = null;
  }

  get nameInvalid(): boolean {
    return this.formSubmitted && !this.form.name.trim();
  }

  get unitOptions() {
    const current = this.form.unit;
    return current && !this.units.some((unit) => unit.value === current)
      ? [...this.units, { group: 'Conteo', value: current, label: current }]
      : this.units;
  }

  unitsOf(group: string) {
    return this.unitOptions.filter((unit) => unit.group === group);
  }

  save(keepOpen = false): void {
    this.formSubmitted = true;
    if (!this.form.name.trim() || this.saving) return;
    const minimum = Math.max(0, Number(this.form.minimum_stock) || 0);
    this.saving = true;

    if (this.editing) {
      this.supplies
        .updateIngredient(this.editing.name, { name: this.form.name, unit: this.form.unit, minimum_stock: minimum })
        .subscribe({
          next: () => {
            this.saving = false;
            this.formOpen = false;
            this.editing = null;
            toast.success('Insumo actualizado');
            this.load();
          },
          error: (error) => this.fail(error),
        });
      return;
    }

    this.supplies
      .createIngredient({ name: this.form.name, unit: this.form.unit, minimum_stock: minimum, initial_stock: Math.max(0, Number(this.form.initial_stock) || 0) })
      .subscribe({
        next: ({ stockError }) => {
          this.saving = false;
          if (stockError) {
            this.alerts.error(this.errors.handle(stockError) || 'El insumo se creó, pero no se pudo registrar el stock inicial.');
          } else {
            toast.success(keepOpen ? 'Insumo guardado. Puedes agregar otro.' : 'Insumo creado');
          }
          if (keepOpen) {
            this.form = { name: '', unit: this.form.unit, minimum_stock: 0, initial_stock: 0 };
            this.formSubmitted = false;
          } else {
            this.formOpen = false;
          }
          this.load();
        },
        error: (error) => this.fail(error),
      });
  }

  async deactivate(): Promise<void> {
    const row = this.editing;
    if (!row || this.saving) return;
    const detail = row.used_in
      ? `Se usa en ${row.used_in} ${row.used_in === 1 ? 'plato' : 'platos'}: dejará de descontarse de sus recetas.`
      : 'No se usa en ninguna receta.';
    const result = await this.alerts.confirm(detail, `¿Desactivar ${row.item_name}?`);
    if (!result.isConfirmed) return;
    this.saving = true;
    this.supplies.updateIngredient(row.name, { status: 'Inactivo' }).subscribe({
      next: () => {
        this.saving = false;
        this.formOpen = false;
        this.editing = null;
        toast.success('Insumo desactivado');
        this.load();
      },
      error: (error) => this.fail(error),
    });
  }

  // ---------- Movimientos ----------

  openMove(row: Ingredient, kind: MovementKind = 'Entrada'): void {
    this.moveTarget = row;
    this.moveKind = kind;
    this.moveQty = null;
    this.moveNote = '';
    this.moveSubmitted = false;
  }

  closeMove(): void {
    if (this.saving) return;
    this.moveTarget = null;
  }

  setMoveKind(kind: MovementKind): void {
    this.moveKind = kind;
    this.moveQty = null;
    this.moveSubmitted = false;
  }

  get moveQtyInvalid(): boolean {
    if (this.moveQty === null || this.moveQty === ('' as any)) return true;
    const value = Number(this.moveQty);
    if (!Number.isFinite(value)) return true;
    if (this.moveKind === 'Ajuste') return value < 0;
    if (this.moveKind === 'Salida') return value <= 0 || value > Number(this.moveTarget?.current_stock || 0);
    return value <= 0;
  }

  get moveError(): string {
    if (!this.moveSubmitted || !this.moveQtyInvalid) return '';
    if (this.moveKind === 'Salida' && Number(this.moveQty) > Number(this.moveTarget?.current_stock || 0)) {
      return 'No puedes sacar más de lo que hay.';
    }
    return this.moveKind === 'Ajuste' ? 'Escribe cuánto hay realmente (0 o más).' : 'Escribe una cantidad mayor a 0.';
  }

  /** Stock resultante para mostrar antes de confirmar. */
  get moveResult(): number | null {
    if (!this.moveTarget || this.moveQtyInvalid) return null;
    const current = Number(this.moveTarget.current_stock);
    const qty = Number(this.moveQty);
    return this.moveKind === 'Entrada' ? current + qty : this.moveKind === 'Salida' ? current - qty : qty;
  }

  moveCopy(): { title: string; qtyLabel: string; cta: string; placeholder: string } {
    switch (this.moveKind) {
      case 'Salida':
        return { title: 'Se dañó o se gastó', qtyLabel: 'Cantidad que sale', cta: 'Registrar salida', placeholder: 'Ej. se dañó, venció' };
      case 'Ajuste':
        return { title: 'Contar stock', qtyLabel: 'Cantidad real que hay ahora', cta: 'Corregir stock', placeholder: 'Ej. conteo del cierre' };
      default:
        return { title: 'Registrar compra', qtyLabel: 'Cantidad que entra', cta: 'Registrar entrada', placeholder: 'Ej. factura del proveedor' };
    }
  }

  confirmMove(): void {
    this.moveSubmitted = true;
    if (!this.moveTarget || this.moveQtyInvalid || this.saving) return;
    this.saving = true;
    this.supplies.registerMovement(this.moveTarget.name, this.moveKind, Number(this.moveQty), this.moveNote.trim()).subscribe({
      next: () => {
        this.saving = false;
        this.moveTarget = null;
        toast.success(this.moveKind === 'Entrada' ? 'Compra registrada' : this.moveKind === 'Salida' ? 'Salida registrada' : 'Stock corregido');
        this.load();
      },
      error: (error) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.saving = false;
    this.alerts.error(this.errors.handle(error));
  }
}
