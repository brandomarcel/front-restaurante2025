import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import {
  CreateProveedorPayload,
  Supplier,
  SupplierQueryParams,
  UpdateProveedorPayload,
} from '../models/supplier';

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private readonly apiUrl = environment.apiUrl;
  private readonly urlBase = `${this.apiUrl}${API_ENDPOINT.Proveedor}`;

  constructor(private http: HttpClient) {}

  getProveedores(params?: SupplierQueryParams) {
    let httpParams = new HttpParams();

    if (params?.isactive !== undefined && params?.isactive !== null) {
      httpParams = httpParams.set('isactive', String(params.isactive));
    }

    if (params?.search) {
      httpParams = httpParams.set('search', params.search.trim());
    }

    return this.http.get<{ message?: { data?: Supplier[] } }>(`${this.urlBase}.get_proveedores`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params: httpParams,
    });
  }

  getProveedorById(name: string) {
    const params = new HttpParams().set('name', name);

    return this.http.get<{ message?: { data?: Supplier } }>(`${this.urlBase}.get_proveedor_by_id`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params,
    });
  }

  getProveedorByIdentificacion(num_identificacion: string) {
    const params = new HttpParams().set('num_identificacion', num_identificacion.trim());

    return this.http.get<{ message?: { data?: Supplier } }>(`${this.urlBase}.get_proveedor_by_identificacion`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params,
    });
  }

  createProveedor(payload: CreateProveedorPayload) {
    return this.http.post<{ message?: Supplier }>(`${this.urlBase}.create_proveedor`, payload, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
    });
  }

  updateProveedor(payload: UpdateProveedorPayload) {
    return this.http.put<{ message?: Supplier }>(`${this.urlBase}.update_proveedor`, payload, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
    });
  }
}
