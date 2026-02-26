// src/app/services/orders.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, EMPTY, Observable, of, switchMap, throwError } from 'rxjs';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { toast } from 'ngx-sonner';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';

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
  status: string;              // "Pendiente" | "Enviado" | "Cancelado"
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
  message?: {
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
  getAll(
    limit: number = 10,
    offset: number = 0,
    createdFrom?: string,
    createdTo?: string,
    order: 'asc' | 'desc' = 'desc',
    status?: string
  ): Observable<OrdersListResponse> {
    let params = new HttpParams()
      .set('limit', String(limit))
      .set('offset', String(offset))
      .set('order', order);

    if (createdFrom) params = params.set('created_from', createdFrom);
    if (createdTo) params = params.set('created_to', createdTo);
    if (status) params = params.set('status', status);

    return this.http.get<OrdersListResponse>(`${this.urlBase}.get_all_orders`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params
    });
  }

  get_dashboard_metrics() {
    return this.http.get(`${this.urlBase}.get_dashboard_metrics`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }


  getById(name: string) {
    return this.http.get<{ data?: OrderDTO; message?: OrderDTO;[k: string]: any }>(
      `${this.urlBase}.get_order_with_details?order_name=${encodeURIComponent(name)}`,
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    );
  }

  create_order_v2(payload: any): Observable<any> {
    const url = `${this.urlBase}.create_order_v2`;
    return this.http.post<any>(url, payload, { context: new HttpContext().set(REQUIRE_AUTH, true) }).pipe(
      catchError((error) => {
        const msg = this.frappeErr.handle(error) || 'Error al crear la orden.';
        toast.error(msg);
        return EMPTY;
      })
    );
  }


  create(order: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/resource/orders`, order, { context: new HttpContext().set(REQUIRE_AUTH, true) }).pipe(
      catchError((error) => {
        const msg = this.frappeErr.handle(error) || 'Error al crear la orden.';
        toast.error(msg);
        return EMPTY;
      })
    );
  }

  update(payload: any): Observable<any> {
    const url = `${this.urlBase}.update_order`;
    return this.http.post<any>(url, payload, { context: new HttpContext().set(REQUIRE_AUTH, true) }).pipe(
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

getOrdersReport(filters: Record<string, any>): Observable<any> {
  const reportName = 'Orders Report';

  const url = `${this.apiUrl}/method/frappe.desk.query_report.run`;

  const params = new HttpParams()
    .set('report_name', reportName)
    .set('filters', JSON.stringify(filters))
    .set('ignore_prepared_report', 'false')
    .set('are_default_filters', 'false');

  return this.http.get<any>(url, { params, context: new HttpContext().set(REQUIRE_AUTH, true) })
    .pipe(
      catchError((e) => {
        const msg = this.frappeErr.handle(e) || 'No se pudo obtener el reporte de ordenes.';
        return throwError(() => new Error(msg));
      }),
    );
}

exportOrdersReportExcel(filters: Record<string, any>): Observable<Blob> {
  return this.logReportExport('Orders Report', filters).pipe(
    switchMap(() => this.downloadOrdersReportExcel(filters)),
  );
}

private logReportExport(reportName: string, filters: Record<string, any>): Observable<unknown> {
  const url = `${this.apiUrl}/method/frappe.core.doctype.access_log.access_log.make_access_log`;
  const body = new HttpParams()
    .set('doctype', '')
    .set('report_name', reportName)
    .set('filters', JSON.stringify(filters))
    .set('file_type', 'Excel')
    .set('method', 'Export');

  return this.http.post(url, body.toString(), {
    headers: new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }),
    context: new HttpContext().set(REQUIRE_AUTH, true),
  }).pipe(
    catchError(() => of(null)),
  );
}

private downloadOrdersReportExcel(filters: Record<string, any>): Observable<Blob> {
  const apiRoot = this.apiUrl.endsWith('/api') ? this.apiUrl.slice(0, -4) : this.apiUrl;
  const url = `${apiRoot}/`;
  const appliedFilters = {
    'Compañía': filters['company'] || '',
    'Desde Fecha': filters['from_date'] || '',
    'Hasta Fecha': filters['to_date'] || '',
    'Estado': filters['estado'] || 'Todos',
    'Número de datos': filters['limit'] || '',
  };
  const body = new HttpParams()
    .set('cmd', 'frappe.desk.query_report.export_query')
    .set('report_name', 'Orders Report')
    .set('custom_columns', JSON.stringify([]))
    .set('file_format_type', 'Excel')
    .set('filters', JSON.stringify(filters))
    .set('applied_filters', JSON.stringify(appliedFilters))
    .set('visible_idx', JSON.stringify([]))
    .set('csv_delimiter', ',')
    .set('csv_quoting', '2')
    .set('include_indentation', 'undefined')
    .set('include_filters', '0');

  return this.http.post(url, body.toString(), {
    headers: new HttpHeaders({ 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }),
    withCredentials: true,
    responseType: 'blob',
    context: new HttpContext().set(REQUIRE_AUTH, true),
  }).pipe(
    catchError((e) => {
      const msg = this.frappeErr.handle(e) || 'No se pudo exportar el reporte de ordenes.';
      return throwError(() => new Error(msg));
    }),
  );
}



  // src/app/services/orders.service.ts
updateStatus(name: string, status: 'Ingresada' | 'Preparación' | 'Cerrada') {
  const body = new FormData();
  body.set('name', name);
  body.set('status', status);
  // o HttpParams si prefieres GET/qs
  return this.http.post<any>(`${this.urlBase}.set_order_status`, body, { context: new HttpContext().set(REQUIRE_AUTH, true) });
}



}
