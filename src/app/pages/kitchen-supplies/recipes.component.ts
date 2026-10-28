import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { toast } from 'ngx-sonner';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { Dish, Ingredient, KitchenSuppliesService, RecipeFilter, RecipeLine } from 'src/app/services/kitchen-supplies.service';
import { KitchenWarehousePickerComponent } from './kitchen-warehouse-picker.component';
import { InventoryNavComponent } from 'src/app/shared/components/inventory-nav/inventory-nav.component';
import { debouncedCallback } from 'src/app/shared/utils/debounced-callback';

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, InventoryNavComponent, KitchenWarehousePickerComponent],
  templateUrl: './recipes.component.html',
})
export class RecipesComponent implements OnInit {
  private readonly supplies = inject(KitchenSuppliesService);
  private readonly capabilities = inject(CompanyCapabilitiesService);
  private readonly alerts = inject(AlertService);
  private readonly errors = inject(FrappeErrorService);
  private readonly destroyRef = inject(DestroyRef);

  dishes: Dish[] = [];
  counts: Record<string, number> = { with: 0, without: 0, low: 0 };
  filter: RecipeFilter = 'with';
  search = '';
  loading = true;
  loadError = '';
  loadedOnce = false;

  // Editor
  editing: Dish | null = null;
  lines: RecipeLine[] = [];
  insumos: Ingredient[] = [];
  insumosLoaded = false;
  linesSubmitted = false;
  saving = false;

  private readonly reloadSearch = debouncedCallback(this.destroyRef, () => this.load(), 300);

  ngOnInit(): void {
    this.load();
  }

  get enabled(): boolean {
    return this.capabilities.isEnabled('inventory') && this.capabilities.isEnabled('restaurant');
  }

  get canEdit(): boolean {
    return this.capabilities.hasPermission('products.manage');
  }

  get needsWarehouse(): boolean {
    return this.capabilities.isWarehouseMode && !this.supplies.warehouse;
  }

  get hasFilters(): boolean {
    return !!this.search.trim();
  }

  get isFirstRun(): boolean {
    return this.loadedOnce && !this.loading && !this.loadError && !this.counts['with'] && !this.hasFilters && this.filter === 'with';
  }

  load(): void {
    if (this.needsWarehouse) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.loadError = '';
    this.supplies
      .getDishes({ search: this.search, filter: this.filter === 'without' ? 'without' : 'with' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.dishes = this.filter === 'low' ? page.data.filter((dish) => dish.state === 'low' || dish.state === 'out') : page.data;
          this.counts = { with: 0, without: 0, low: 0, ...page.counts };
          this.loading = false;
          this.loadedOnce = true;
        },
        error: (error) => {
          this.loading = false;
          this.loadError = this.errors.handle(error) || 'No se pudieron cargar las recetas.';
        },
      });
  }

  onSearch(value: string): void {
    this.search = value;
    this.reloadSearch();
  }

  setFilter(filter: RecipeFilter): void {
    if (this.filter === filter) return;
    this.filter = filter;
    this.load();
  }

  trackByName = (_: number, dish: Dish) => dish.name;

  chips(dish: Dish): RecipeLine[] {
    return dish.lines.slice(0, 4);
  }

  portionsLabel(dish: Dish): string {
    const portions = dish.portions_available;
    if (portions === null || portions === undefined) return 'Sin dato';
    if (portions === 0) return 'Agotado';
    return `${portions} ${portions === 1 ? 'porción' : 'porciones'}`;
  }

  portionsTone(state?: string): string {
    return state === 'out'
      ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300'
      : state === 'low'
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
  }

  // ---------- Editor ----------

  open(dish: Dish): void {
    this.editing = dish;
    this.lines = dish.lines.map((line) => ({ ...line }));
    this.linesSubmitted = false;
    if (!this.lines.length) this.addLine();
    this.loadInsumos();
  }

  close(): void {
    if (this.saving) return;
    this.editing = null;
  }

  private loadInsumos(): void {
    this.insumosLoaded = false;
    this.supplies.getIngredients().subscribe({
      next: (page) => {
        this.insumos = page.data;
        this.insumosLoaded = true;
      },
      error: (error) => {
        this.insumosLoaded = true;
        this.alerts.error(this.errors.handle(error) || 'No se pudieron cargar los insumos.');
      },
    });
  }

  addLine(): void {
    this.lines.push({ ingredient: '', quantity: null, waste_pct: 0, removable: false });
  }

  removeLine(index: number): void {
    this.lines.splice(index, 1);
  }

  /** Insumos que aún no están en otra línea de esta receta. */
  insumosFor(index: number): Ingredient[] {
    const used = new Set(this.lines.filter((_, i) => i !== index).map((line) => line.ingredient));
    return this.insumos.filter((insumo) => !used.has(insumo.name));
  }

  insumo(name: string): Ingredient | undefined {
    return this.insumos.find((insumo) => insumo.name === name);
  }

  unitOf(line: RecipeLine): string {
    return this.insumo(line.ingredient)?.unit || line.unit || '';
  }

  lineError(line: RecipeLine): string {
    if (!this.linesSubmitted) return '';
    if (!line.ingredient) return 'Elige un insumo.';
    if (!(Number(line.quantity) > 0)) return 'Escribe cuánto lleva.';
    return '';
  }

  /** Cuántas porciones alcanzan con el stock actual y qué insumo manda; se recalcula mientras editas. */
  get preview(): { portions: number | null; limiting: string | null } {
    let portions: number | null = null;
    let limiting: string | null = null;
    for (const line of this.lines) {
      const insumo = this.insumo(line.ingredient);
      const need = Number(line.quantity) * (1 + Number(line.waste_pct || 0) / 100);
      if (!insumo || !(need > 0)) continue;
      // Se redondea antes de truncar: 11 / (2 × 1,10) es 5, no 4 (2,2000000000000002 en coma flotante).
      const available = Math.floor(Math.round((Number(insumo.current_stock) / need) * 1e9) / 1e9);
      if (portions === null || available < portions) {
        portions = available;
        limiting = insumo.item_name;
      }
    }
    return { portions, limiting };
  }

  save(): void {
    if (!this.editing || this.saving) return;
    const filled = this.lines.filter((line) => line.ingredient || line.quantity);
    this.linesSubmitted = true;
    if (!filled.length || filled.some((line) => this.lineError(line))) {
      if (!filled.length) this.alerts.error('Agrega al menos un insumo, o usa «Quitar receta».');
      return;
    }
    this.saving = true;
    this.supplies.saveRecipe(this.editing, filled).subscribe({
      next: () => {
        this.saving = false;
        this.editing = null;
        toast.success('Receta guardada. Las próximas ventas descontarán estos insumos.');
        this.load();
      },
      error: (error) => {
        this.saving = false;
        this.alerts.error(this.errors.handle(error));
      },
    });
  }

  async removeRecipe(): Promise<void> {
    const dish = this.editing;
    if (!dish || this.saving) return;
    const result = await this.alerts.confirm('El plato dejará de descontar insumos al venderse.', `¿Quitar la receta de ${dish.item_name}?`);
    if (!result.isConfirmed) return;
    this.saving = true;
    this.supplies.saveRecipe(dish, []).subscribe({
      next: () => {
        this.saving = false;
        this.editing = null;
        toast.success('Receta quitada');
        this.load();
      },
      error: (error) => {
        this.saving = false;
        this.alerts.error(this.errors.handle(error));
      },
    });
  }
}
