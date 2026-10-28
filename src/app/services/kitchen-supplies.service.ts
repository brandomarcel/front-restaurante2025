import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, switchMap, throwError, of, catchError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeData } from '../core/utils/frappe-response';
import { InventoryService } from './inventory.service';

export type IngredientState = 'ok' | 'low' | 'out';
export type IngredientFilter = 'all' | IngredientState;
export type RecipeFilter = 'with' | 'without' | 'low';

export interface Ingredient {
  name: string;
  item_code: string;
  item_name: string;
  unit: string;
  minimum_stock: number;
  current_stock: number;
  state: IngredientState;
  /** Cuántos platos usan este insumo en su receta. */
  used_in: number;
}

export interface RecipeLine {
  ingredient: string;
  ingredient_name?: string;
  quantity: number | null;
  unit?: string;
  waste_pct: number;
  removable: boolean;
  current_stock?: number;
  portions_available?: number | null;
}

export interface Dish {
  name: string;
  item_code: string;
  item_name: string;
  standard_rate: number;
  track_stock: number;
  image?: string;
  has_recipe: boolean;
  lines: RecipeLine[];
  portions_available?: number | null;
  limiting_ingredient?: string | null;
  state?: IngredientState;
}

export interface Page<T> {
  data: T[];
  total: number;
  counts: Record<string, number>;
  has_next: boolean;
}

export interface NewIngredientInput {
  name: string;
  unit: string;
  minimum_stock: number;
  initial_stock: number;
}

/** Un insumo se mide en una unidad de cocina; la etiqueta es la que ve el usuario. */
export const KITCHEN_UNITS = [
  { group: 'Peso', value: 'kg', label: 'Kilos (kg)' },
  { group: 'Peso', value: 'g', label: 'Gramos (g)' },
  { group: 'Peso', value: 'lb', label: 'Libras (lb)' },
  { group: 'Volumen', value: 'lt', label: 'Litros (lt)' },
  { group: 'Volumen', value: 'ml', label: 'Mililitros (ml)' },
  { group: 'Conteo', value: 'und', label: 'Unidades (und)' },
];

/** Insumos y recetas del restaurante: lecturas agregadas del backend más altas y cambios de receta. */
@Injectable({ providedIn: 'root' })
export class KitchenSuppliesService {
  private readonly apiUrl = environment.apiUrl;
  private readonly lite = `${environment.apiUrl}${API_ENDPOINT.FacturadaLite}`;

  constructor(
    private http: HttpClient,
    private capabilities: CompanyCapabilitiesService,
    private inventory: InventoryService,
  ) {}

  /** Bodega elegida en Inventario (solo en modo Por Bodega). */
  get warehouse(): string {
    if (!this.capabilities.isWarehouseMode) return '';
    const business = this.capabilities.activeBusinessId || '';
    const persisted = localStorage.getItem(`inventory_active_warehouse:${business}`) || '';
    const options = this.capabilities.activeWarehouses || [];
    if (persisted && options.some((item: any) => String(item?.name || '') === persisted)) return persisted;
    return String(this.capabilities.defaultWarehouse?.name || '');
  }

  /** Recuerda la bodega elegida (la misma que usa Inventario) para esta y las demás pantallas. */
  selectWarehouse(warehouseId: string): void {
    const key = `inventory_active_warehouse:${this.capabilities.activeBusinessId || ''}`;
    try {
      if (warehouseId) localStorage.setItem(key, warehouseId);
      else localStorage.removeItem(key);
    } catch {
      /* sin almacenamiento local: la elección dura solo la sesión */
    }
  }

  getIngredients(opts: { search?: string; filter?: IngredientFilter; status?: 'Activo' | 'Inactivo' } = {}): Observable<Page<Ingredient>> {
    let params = this.baseParams().set('limit', '500').set('status', opts.status || 'Activo');
    if (opts.search?.trim()) params = params.set('search', opts.search.trim());
    if (opts.filter && opts.filter !== 'all') params = params.set('stock_filter', opts.filter);
    return this.http
      .get<any>(`${this.lite}.get_insumos`, { context: new HttpContext().set(REQUIRE_AUTH, true), params })
      .pipe(map((res) => this.asPage<Ingredient>(res)));
  }

  getDishes(opts: { search?: string; filter?: 'with' | 'without' } = {}): Observable<Page<Dish>> {
    let params = this.baseParams().set('limit', '500').set('recipe_filter', opts.filter || 'with');
    if (opts.search?.trim()) params = params.set('search', opts.search.trim());
    return this.http
      .get<any>(`${this.lite}.get_recetas`, { context: new HttpContext().set(REQUIRE_AUTH, true), params })
      .pipe(map((res) => this.asPage<Dish>(res)));
  }

  /** Alta de insumo; el stock inicial se registra como una Entrada para que quede en el historial. */
  createIngredient(input: NewIngredientInput): Observable<{ item: any; stockError: unknown }> {
    const business = this.business();
    if (!business) return throwError(() => new Error('Selecciona un negocio para crear el insumo.'));
    const payload = {
      business,
      item_name: input.name.trim().toUpperCase(),
      item_type: 'Producto',
      unit: input.unit,
      is_ingredient: 1,
      track_stock: 1,
      minimum_stock: input.minimum_stock,
      standard_rate: 0,
      tax_rate: 0,
      status: 'Activo',
    };
    return this.http
      .post(`${this.lite}.create_producto`, payload, { context: new HttpContext().set(REQUIRE_AUTH, true) })
      .pipe(
        map((res: any) => frappeData<any>(res)),
        switchMap((item) =>
          input.initial_stock > 0
            ? this.registerMovement(item.name, 'Entrada', input.initial_stock, 'Stock inicial').pipe(
                map(() => ({ item, stockError: null as unknown })),
                catchError((stockError) => of({ item, stockError })),
              )
            : of({ item, stockError: null as unknown }),
        ),
      );
  }

  updateIngredient(name: string, changes: { name?: string; unit?: string; minimum_stock?: number; status?: 'Activo' | 'Inactivo' }) {
    const business = this.business();
    if (!business) return throwError(() => new Error('Selecciona un negocio para editar el insumo.'));
    const payload: any = { name, business };
    if (changes.name !== undefined) payload.item_name = changes.name.trim().toUpperCase();
    if (changes.unit !== undefined) payload.unit = changes.unit;
    if (changes.minimum_stock !== undefined) payload.minimum_stock = changes.minimum_stock;
    if (changes.status !== undefined) payload.status = changes.status;
    return this.http
      .post(`${this.lite}.update_producto`, payload, { context: new HttpContext().set(REQUIRE_AUTH, true) })
      .pipe(map((res: any) => frappeData<any>(res)));
  }

  /** Entrada (compra), Salida (merma/consumo) o Ajuste (conteo físico: `quantity` es el stock real). */
  registerMovement(item: string, type: 'Entrada' | 'Salida' | 'Ajuste', quantity: number, notes = '') {
    const payload: any = { item, movement_type: type, notes: notes || undefined };
    if (type === 'Ajuste') payload.target_stock = quantity;
    else payload.quantity = quantity;
    if (this.warehouse) payload.warehouse = this.warehouse;
    return this.inventory.createInventoryMovement(payload);
  }

  /**
   * Guarda la receta de un plato. Un plato con receta no lleva stock propio: si todavía lo
   * controlaba, se apaga aquí (el backend exige que su saldo esté en 0).
   */
  saveRecipe(dish: Pick<Dish, 'name' | 'track_stock'>, lines: RecipeLine[]) {
    const business = this.business();
    if (!business) return throwError(() => new Error('Selecciona un negocio para guardar la receta.'));
    const payload: any = {
      name: dish.name,
      business,
      recipe: lines.map((line) => ({
        ingredient: line.ingredient,
        quantity: Number(line.quantity),
        waste_pct: Math.min(100, Math.max(0, Number(line.waste_pct || 0))),
        removable: line.removable ? 1 : 0,
      })),
    };
    if (lines.length && dish.track_stock) payload.track_stock = 0;
    return this.http
      .post(`${this.lite}.update_producto`, payload, { context: new HttpContext().set(REQUIRE_AUTH, true) })
      .pipe(map((res: any) => frappeData<any>(res)));
  }

  private asPage<T>(res: any): Page<T> {
    const body = res?.message ?? res ?? {};
    return {
      data: body.data ?? [],
      total: Number(body.total ?? (body.data || []).length),
      counts: body.counts ?? {},
      has_next: !!body.has_next,
    };
  }

  private baseParams(): HttpParams {
    let params = new HttpParams();
    const business = this.business();
    if (business) params = params.set('business', business);
    if (this.warehouse) params = params.set('warehouse', this.warehouse);
    return params;
  }

  private business(): string {
    return this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || '';
  }
}
