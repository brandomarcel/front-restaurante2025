import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { InventoryMovementPayload } from '../models/inventory';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly apiUrl = environment.apiUrl;
  private readonly urlBase = this.apiUrl + API_ENDPOINT.Inventory;

  constructor(private http: HttpClient) { }

  getInventoryProducts(filters?: {
    search?: string;
    onlyLowStock?: boolean;
    onlyActive?: boolean;
  }) {
    let params = new HttpParams();

    if (filters?.search) params = params.set('search', filters.search);
    if (filters?.onlyLowStock) params = params.set('only_low_stock', '1');
    if (filters?.onlyActive) params = params.set('only_active', '1');

    return this.http.get(`${this.urlBase}.get_inventory_products`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params
    });
  }

  createInventoryMovement(payload: InventoryMovementPayload) {
    return this.http.post(`${this.urlBase}.create_inventory_movement`, payload, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
    });
  }

  getInventoryMovements(filters?: {
    limit?: number;
    offset?: number;
    product?: string;
    movementType?: string;
  }) {
    let params = new HttpParams();

    if (filters?.limit !== undefined) params = params.set('limit', String(filters.limit));
    if (filters?.offset !== undefined) params = params.set('offset', String(filters.offset));
    if (filters?.product) params = params.set('product', filters.product);
    if (filters?.movementType) params = params.set('movement_type', filters.movementType);

    return this.http.get(`${this.urlBase}.get_inventory_movements`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params
    });
  }
}
