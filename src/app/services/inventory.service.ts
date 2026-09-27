import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { InventoryMovementPayload, LiteStockMovementPayload } from '../models/inventory';
import { environment } from 'src/environments/environment';
import { map, throwError } from 'rxjs';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeData, frappeList } from '../core/utils/frappe-response';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly apiUrl = environment.apiUrl;
  constructor(private http: HttpClient, private capabilities: CompanyCapabilitiesService) { }

  createInventoryMovement(payload: (InventoryMovementPayload | LiteStockMovementPayload) & { warehouse?: string }) {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para registrar un movimiento.'));
    const litePayload: any = { business, ...payload };
    if (Array.isArray((payload as InventoryMovementPayload).items)) {
      const first = (payload as InventoryMovementPayload).items[0];
      litePayload.item = first?.product;
      litePayload.quantity = first?.quantity;
      delete litePayload.items;
    }
    return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.create_stock_movement`, litePayload, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
    }).pipe(map((response: any) => frappeData<any>(response)));
  }

  getInventoryMovements(filters?: {
    limit?: number;
    offset?: number;
    product?: string;
    movementType?: string;
    /** Sobrescribe la bodega derivada del terminal activo (ver `getStockSummary`). */
    warehouse?: string;
  }) {
    let params = new HttpParams();

    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para consultar movimientos.'));
    params = params.set('business', business);

    if (filters?.limit !== undefined) params = params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined) params = params.set('offset', String(filters.offset));
    // El backend filtra por `item` (el ID del producto), no por `product`.
    if (filters?.product) params = params.set('item', filters.product);
    if (filters?.movementType) params = params.set('movement_type', filters.movementType);
    // En modo "Por Bodega" el historial es siempre el de una bodega concreta;
    // nunca se mezcla con el de otro local.
    const warehouse = filters?.warehouse !== undefined ? filters.warehouse : this.activeWarehouse();
    if (warehouse) params = params.set('warehouse', warehouse);
    const url = `${this.apiUrl}${API_ENDPOINT.FacturadaLiteInventory}.get_stock_movements`;

    const request$ = this.http.get(url, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params
    });
    return request$.pipe(map((response: any) => frappeList<any>(response)));
  }

  /**
   * `warehouse` explícito permite que una pantalla (ej. Inventario) elija su
   * propia bodega activa en vez de heredar siempre la del terminal POS; si se
   * omite, cae al comportamiento anterior (bodega del terminal/predeterminada).
   */
  getStockSummary(warehouse?: string) {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para consultar inventario.'));
    let params = new HttpParams().set('business', business);
    const effectiveWarehouse = warehouse !== undefined ? warehouse : this.activeWarehouse();
    if (effectiveWarehouse) params = params.set('warehouse', effectiveWarehouse);
    return this.http.get(`${this.apiUrl}${API_ENDPOINT.FacturadaLiteInventory}.get_stock_summary`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params
    }).pipe(map((response: any) => frappeData<any>(response)));
  }

  /** Configuración de bodegas del negocio (modo + lista). No requiere permiso especial para consultar. */
  getInventoryConfiguration() {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para consultar la configuración de inventario.'));
    const params = new HttpParams().set('business', business);
    return this.http.get(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_inventory_configuration`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params
    });
  }

  /** Crear (sin `name`) o editar (con `name`) una bodega. */
  saveWarehouse(payload: {
    name?: string;
    warehouse_name: string;
    establishment?: string;
    is_default?: boolean | number;
    status: 'Activo' | 'Inactivo';
    notes?: string;
  }) {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para guardar la bodega.'));
    const body: any = {
      business,
      warehouse_name: payload.warehouse_name,
      // Siempre se envía explícito (null para desvincular): omitir la clave
      // cuando el valor queda vacío no le indica al backend que debe borrar
      // el establecimiento ya guardado en una edición.
      establishment: payload.establishment || null,
      is_default: payload.is_default ? 1 : 0,
      status: payload.status,
      notes: payload.notes || ''
    };
    if (payload.name) body.name = payload.name;
    return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.save_warehouse`, body, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(map((response: any) => frappeData<any>(response)));
  }

  /**
   * Cambia el modo de inventario. `migrateExistingStock` solo se envía si el
   * usuario confirmó explícitamente mover el stock global existente a la
   * bodega predeterminada; nunca se manda automáticamente.
   */
  saveInventoryConfiguration(inventoryMode: 'Simple' | 'Por Bodega', migrateExistingStock = false) {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para guardar la configuración.'));
    const body: any = { business, inventory_mode: inventoryMode };
    if (migrateExistingStock) body.migrate_existing_stock = 1;
    return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.save_inventory_configuration`, body, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(map((response: any) => frappeData<any>(response)));
  }

  /** Traslado de stock entre bodegas. El backend valida existencia de stock en origen. */
  transferStock(payload: {
    source_warehouse: string;
    target_warehouse: string;
    posting_date: string;
    notes?: string;
    items: Array<{ item: string; qty: number }>;
  }) {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para trasladar inventario.'));
    if (payload.source_warehouse === payload.target_warehouse) {
      return throwError(() => new Error('La bodega de origen y destino deben ser distintas.'));
    }
    if (!payload.items.length || payload.items.some((item) => !(Number(item.qty) > 0))) {
      return throwError(() => new Error('Todas las cantidades a trasladar deben ser mayores que cero.'));
    }
    const body = { business, ...payload };
    return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.transfer_stock`, body, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(map((response: any) => frappeData<any>(response)));
  }

  private activeWarehouse(): string {
    return String(this.capabilities.activeWarehouse?.name || '').trim();
  }

  private activeBusiness(): string {
    return String(this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId') || '').trim();
  }
}
