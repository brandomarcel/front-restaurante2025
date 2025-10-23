// src/app/services/orders.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, EMPTY, Observable } from 'rxjs';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { toast } from 'ngx-sonner';
import { API_ENDPOINT } from '../core/constants/api.constants';

// 👇 Interface alineada a tu payload
export interface OrderItemDTO {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  tax_rate: number;
  subtotal: number;
  iva: number;
  total: number;
}

export interface OrderDTO {
  name: string;                // "ORD-00884"
  type: string;                // "Nota Venta" | "Factura" | ...
  createdAt: string;           // "YYYY-MM-DD HH:mm:ss"
  subtotal: number;
  iva: number;
  total: number;
  customer: {
    nombre: string;
    num_identificacion: string;
    correo: string;
    telefono: string;
    direccion: string;
  };
  sri?: {
    status: string;            // "Sin factura" | "AUTORIZADO" | ...
    authorization_datetime?: string;
    access_key?: string;
    invoice?: string;
    number?: string;
    grand_total?: number;
  };
  usuario?: string;
  items?: OrderItemDTO[];
}

export interface OrdersListResponse {
  message?:{
  data: OrderDTO[];
  total: number;
  limit: number;
  offset: number;
  filters?: any;
  }
}

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly apiUrl = environment.apiUrl;
  private urlBase = '';

  constructor(
    private http: HttpClient,
    private frappeErr: FrappeErrorService,
  ) {
    this.urlBase = this.apiUrl + API_ENDPOINT.Orden;
  }

  /** Lista paginada tal cual devuelve tu backend */
  getAll(limit: number = 10, offset: number = 0): Observable<OrdersListResponse> {
    const params = new HttpParams()
      .set('limit', String(limit))
      .set('offset', String(offset));

    return this.http.get<OrdersListResponse>(`${this.urlBase}.get_all_orders`, {
      withCredentials: true,
      params
    });
  }

  get_dashboard_metrics() {
    return this.http.get(`${this.urlBase}.get_dashboard_metrics`, {
      withCredentials: true
    });
  }

  /** 🔧 Bugfix: el name es string tipo "ORD-00884" y faltaba "=" en la URL */
  getById(name: string) {
    return this.http.get<{ data?: OrderDTO; message?: OrderDTO; [k: string]: any }>(
      `${this.urlBase}.get_order_with_details?order_name=${encodeURIComponent(name)}`,
      { withCredentials: true }
    );
  }

  create_order_v2(payload: any): Observable<any> {
    const url = `${this.urlBase}.create_order_v2`;
    return this.http.post<any>(url, payload, { withCredentials: true }).pipe(
      catchError((error) => {
        const msg = this.frappeErr.handle(error) || 'Error al crear la orden.';
        toast.error(msg);
        return EMPTY;
      })
    );
  }

  create_and_emit_from_ui_v2_from_order(payload: any): Observable<any> {
    const url = `${this.urlBase}.create_and_emit_from_ui_v2_from_order`;
    return this.http.post<any>(url, payload, { withCredentials: true }).pipe(
      catchError((e) => {
        const msg = this.frappeErr.handle(e) || 'Error al crear la orden.';
        toast.error(msg);
        return EMPTY;
      })
    );
  }

  /** Estos dos revísalos si existen realmente en tu backend */
  create(order: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/resource/orders`, order, { withCredentials: true }).pipe(
      catchError((error) => {
        const msg = this.frappeErr.handle(error) || 'Error al crear la orden.';
        toast.error(msg);
        return EMPTY;
      })
    );
  }

  update(payload: any): Observable<any> {
    const url = `${this.urlBase}.update_order`;
    return this.http.post<any>(url, payload, { withCredentials: true }).pipe(
      catchError((e) => {
        const msg = this.frappeErr.handle(e) || 'Error al actualizar la orden.';
        toast.error(msg);
        return EMPTY;
      })
    );
  }

  // delete/invoice: solo si tus endpoints existen:
  // delete(id: number) { return this.http.delete(`${this.apiUrl}/${id}`); }
  // invoice(id: number) { return this.http.post(`${this.apiUrl}/${id}/invoice`, {}); }

  getFilteredOrders(filters: any): Observable<any> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.get(`${this.apiUrl}/filter`, { params });
  }
}
