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

  getInventoryProducts(filters?: {
    search?: string;
    onlyLowStock?: boolean;
    onlyActive?: boolean;
  }) {
    let params = new HttpParams();
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para consultar inventario.'));
    params = params.set('business', business);

    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.onlyLowStock) params = params.set('only_low_stock', '1');
    if (filters?.onlyActive) params = params.set('only_active', '1');

    return this.http.get(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_productos`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params
    }).pipe(map((response: any) => frappeList<any>(response)));
  }

  createInventoryMovement(payload: InventoryMovementPayload | LiteStockMovementPayload) {
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
    fromDate?: string;
    toDate?: string;
    reference?: string;
  }) {
    let params = new HttpParams();

    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para consultar movimientos.'));
    params = params.set('business', business);

    if (filters?.limit !== undefined) params = params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined) params = params.set('offset', String(filters.offset));
    if (filters?.product) params = params.set('product', filters.product);
    if (filters?.movementType) params = params.set('movement_type', filters.movementType);
    if (filters?.fromDate) params = params.set('from_date', filters.fromDate);
    if (filters?.toDate) params = params.set('to_date', filters.toDate);
    if (filters?.reference) params = params.set('reference', filters.reference);
    const url = `${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_stock_movements`;

    const request$ = this.http.get(url, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params
    });
    return request$.pipe(map((response: any) => frappeList<any>(response)));
  }

  getStockSummary() {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para consultar inventario.'));
    const params = new HttpParams().set('business', business);
    return this.http.get(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_stock_summary`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params
    }).pipe(map((response: any) => frappeData<any>(response)));
  }

  private activeBusiness(): string {
    return String(this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId') || '').trim();
  }
}
