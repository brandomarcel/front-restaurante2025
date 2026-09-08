// src/app/services/orders.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, EMPTY, map, Observable, of, switchMap, throwError } from 'rxjs';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { toast } from 'ngx-sonner';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';

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
    private capabilities: CompanyCapabilitiesService,
  ) {
    this.urlBase = this.apiUrl + API_ENDPOINT.FacturadaRestaurant;
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
      .set('offset', String(offset));

    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    params = params.set('business', business);

    if (createdFrom) params = params.set('created_from', createdFrom);
    if (createdTo) params = params.set('created_to', createdTo);
    if (status) params = params.set('status', status);

    return this.http.get<OrdersListResponse>(`${this.urlBase}.get_all_orders`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params
    }).pipe(map((response: any) => this.normalizeListResponse(response)));
  }

  get_dashboard_metrics() {
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    return this.http.get(`${this.urlBase}.get_dashboard_metrics`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params: new HttpParams().set('business', business)
    });
  }


  getById(name: string) {
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    return this.http.get<{ data?: OrderDTO; message?: OrderDTO;[k: string]: any }>(
      `${this.urlBase}.get_order_with_details`,
      { context: new HttpContext().set(REQUIRE_AUTH, true), params: new HttpParams().set('order_name', name).set('business', business) }
    ).pipe(map((response: any) => this.normalizeDetailResponse(response)));
  }

  getTables(active: boolean | null = true): Observable<any> {
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    return this.http.get<any>(`${this.urlBase}.get_tables`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params: active === null
        ? new HttpParams().set('business', business)
        : new HttpParams().set('business', business).set('active', active ? '1' : '0')
    }).pipe(map((response: any) => {
      const message = response?.message ?? response ?? {};
      const rows = Array.isArray(message?.data) ? message.data : [];
      return {
        ...response,
        message: {
          ...message,
          data: rows.map((table: any) => ({
            ...table,
            table_name: table?.table_name ?? table?.nombre ?? table?.number_mesa ?? table?.name,
            display_name: table?.table_name ?? table?.nombre ?? table?.number_mesa ?? table?.name,
            active: table?.active ?? table?.isactive ?? 1,
            isactive: table?.isactive ?? table?.active ?? 1,
            assigned_waiter: table?.assigned_waiter ?? table?.mesero ?? null,
            mesero: table?.mesero ?? table?.assigned_waiter ?? null
          }))
        }
      };
    }));
  }

  createTable(payload: any): Observable<any> {
    return this.postRestaurant('create_table', this.normalizeTablePayload(payload));
  }

  updateTable(payload: any): Observable<any> {
    return this.postRestaurant('update_table', this.normalizeTablePayload(payload, true));
  }

  getKitchenOrders(): Observable<any> {
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    return this.http.get<any>(`${this.urlBase}.get_kitchen_orders`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params: new HttpParams().set('business', business)
    });
  }

  updateKitchenItemStatus(orderName: string, itemName: string, kitchenStatus: 'Pendiente' | 'En preparacion' | 'Listo' | 'Entregado' | 'Cancelado'): Observable<any> {
    return this.postRestaurant('update_kitchen_item_status', {
      order_name: orderName,
      item_name: itemName,
      kitchen_status: kitchenStatus
    });
  }

  create_order_v2(payload: any): Observable<any> {
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    const url = `${this.urlBase}.create_order_v2`;
    return this.http.post<any>(url, this.normalizeOrderPayload(payload, business), { context: new HttpContext().set(REQUIRE_AUTH, true) }).pipe(
      map((response: any) => this.normalizeCreateResponse(response)),
      catchError((error) => {
        const msg = this.frappeErr.handle(error) || 'Error al crear la orden.';
        toast.error(msg);
        return throwError(() => error);
      })
    );
  }


  create(order: any): Observable<any> {
    return this.create_order_v2(order);
  }

  update(payload: any): Observable<any> {
    if (payload?.name && payload?.status) return this.updateStatus(payload.name, payload.status);
    return throwError(() => new Error('La edición de ítems aún no está disponible en el contrato nuevo de restaurante.'));
  }

  // delete/invoice: solo si tus endpoints existen:
  // delete(id: number) { return this.http.delete(`${this.apiUrl}/${id}`); }
  // invoice(id: number) { return this.http.post(`${this.apiUrl}/${id}/invoice`, {}); }

  getFilteredOrders(filters: any): Observable<any> {
    if (this.capabilities.isLiteMode) {
      return throwError(() => new Error('Los reportes de órdenes no están disponibles en FacturADA Lite.'));
    }

    const params = new HttpParams({ fromObject: filters });
    return this.http.get(`${this.apiUrl}/filter`, { params });
  }

getOrdersReport(filters: Record<string, any>): Observable<any> {
  const business = this.activeBusinessOrError();
  if (business instanceof Error) return throwError(() => business);
  const reportName = 'FacturADA Restaurant Orders';
  const reportFilters = { ...(filters || {}), business };

  const url = `${this.apiUrl}/method/frappe.desk.query_report.run`;

  const params = new HttpParams()
    .set('report_name', reportName)
    .set('filters', JSON.stringify(reportFilters))
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
  const business = this.activeBusinessOrError();
  if (business instanceof Error) return throwError(() => business);
  const reportFilters = { ...(filters || {}), business };
  return this.logReportExport('FacturADA Restaurant Orders', reportFilters).pipe(
    switchMap(() => this.downloadOrdersReportExcel(reportFilters)),
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
    .set('report_name', 'FacturADA Restaurant Orders')
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
updateStatus(
  name: string,
  status: 'Ingresada' | 'Preparacion' | 'Preparación' | 'Lista' | 'Cerrada' | 'Cancelada',
  currentStatus?: string
) {
  const business = this.activeBusinessOrError();
  if (business instanceof Error) return throwError(() => business);
  if (currentStatus && !this.canTransitionOrder(currentStatus, status)) {
    return throwError(() => new Error('La transición de estado solicitada no está permitida para esta orden.'));
  }
  const normalizedStatus = status === 'Preparación' ? 'Preparacion' : status;
  return this.http.post<any>(
    `${this.urlBase}.set_order_status`,
    { name, status: normalizedStatus, business },
    { context: new HttpContext().set(REQUIRE_AUTH, true) }
  ).pipe(map((response: any) => this.normalizeDetailResponse(response)));
}

/** Transiciones operativas permitidas por FacturADA Restaurante. */
canTransitionOrder(currentStatus: string | null | undefined, targetStatus: string): boolean {
  const current = this.canonicalOrderStatus(currentStatus);
  const target = this.canonicalOrderStatus(targetStatus);
  if (!current || !target) return false;

  const transitions: Record<string, string[]> = {
    Ingresada: ['Preparacion', 'Cancelada'],
    Preparacion: ['Lista', 'Cerrada', 'Cancelada'],
    Lista: ['Cerrada', 'Cancelada']
  };
  return transitions[current]?.includes(target) ?? false;
}

/** Emite la factura Lite asociada a una orden de restaurante ya creada. */
emitInvoiceForOrder(orderName: string): Observable<any> {
  const business = this.activeBusinessOrError();
  if (business instanceof Error) return throwError(() => business);
  return this.http.post<any>(
    `${this.urlBase}.emit_invoice_for_order`,
    {
      order_name: orderName,
      business,
      ...(this.capabilities.activePosTerminal?.name ? { pos_terminal: this.capabilities.activePosTerminal.name } : {})
    },
    { context: new HttpContext().set(REQUIRE_AUTH, true) }
  ).pipe(map((response: any) => this.normalizeDetailResponse(response)));
}

/** Actualiza datos facturables sin cambiar el estado operativo de la orden. */
updateOrderForInvoice(payload: any): Observable<any> {
  return this.postRestaurant('update_order_for_invoice', {
    order_name: payload?.order_name ?? payload?.name,
    customer: payload?.customer,
    alias: payload?.alias ?? '',
    items: (payload?.items ?? []).map((item: any) => ({
      product: item?.product ?? item?.item,
      qty: Number(item?.qty ?? item?.quantity ?? 0),
      rate: Number(item?.rate ?? item?.price ?? 0),
      tax_rate: Number(item?.tax_rate ?? item?.tax_value ?? 0),
      ...(item?.notes ? { notes: String(item.notes) } : {})
    })),
    payments: (payload?.payments ?? []).map((payment: any) => ({
      payment_method: payment?.payment_method ?? payment?.formas_de_pago,
      payment_code: payment?.payment_code ?? payment?.forma_pago ?? '',
      amount: Number(payment?.amount ?? payment?.monto ?? 0),
      reference: payment?.reference ?? ''
    })),
    notes: payload?.notes ?? ''
  });
}

  private activeBusinessOrError(): string | Error {
    const business = this.capabilities.activeBusinessId || localStorage.getItem('active_business') || localStorage.getItem('businessId');
    return business ? business : new Error('Selecciona un negocio para operar órdenes de restaurante.');
  }

  private normalizeOrderPayload(payload: any, business: string): any {
    const source = payload || {};
    const sourceStatus = String(source.status ?? 'Ingresada');
    const items = Array.isArray(source.items) ? source.items.map((item: any) => ({
      product: item?.product ?? item?.item ?? item?.productId ?? item?.name,
      qty: Number(item?.qty ?? item?.quantity ?? 1),
      rate: Number(item?.rate ?? item?.price ?? 0),
      tax_rate: Number(item?.tax_rate ?? item?.tax_value ?? 0),
      ...(item?.notes ? { notes: String(item.notes) } : {})
    })) : [];
    const payments = Array.isArray(source.payments) ? source.payments.map((payment: any) => {
      const amount = payment?.amount ?? payment?.monto;
      return {
        formas_de_pago: payment?.formas_de_pago ?? payment?.payment_method ?? payment?.name,
        ...(payment?.payment_code ?? payment?.forma_pago ? { payment_code: payment?.payment_code ?? payment?.forma_pago } : {}),
        ...(amount !== undefined && amount !== null && amount !== '' ? { amount: Number(amount) } : {})
      };
    }) : [];
    const fiscalStatus = String(source.fiscal_status ?? source.estado ?? 'Nota Venta').trim();
    const terminalName = String(source.pos_terminal || source.posTerminal || this.capabilities.activePosTerminal?.name || '').trim();
    return {
      business,
      // `table` siempre transporta el ID interno FRTBL-xxxxx. Nunca enviar
      // el nombre visible de la mesa al backend de restaurante.
      table: source.table ?? source.mesa ?? null,
      waiter: source.waiter ?? source.usuario ?? source.user ?? this.currentUserIdentifier(),
      customer: source.customer ?? null,
      alias: source.alias ?? '',
      order_type: source.order_type ?? source.type_orden ?? 'Servirse',
      fiscal_status: fiscalStatus,
      status: sourceStatus === 'Preparación' ? 'Preparacion' : sourceStatus,
      items,
      payments,
      notes: source.notes ?? source.observaciones ?? '',
      ...(terminalName && (fiscalStatus === 'Factura' || source.pos_terminal || source.posTerminal) ? { pos_terminal: terminalName } : {})
    };
  }

  private normalizeTablePayload(payload: any, includeName = false): any {
    const source = payload || {};
    const active = source.active ?? source.isactive ?? 1;
    return {
      ...(includeName && source?.name ? { name: String(source.name) } : {}),
      table_name: String(source?.table_name ?? source?.nombre ?? '').trim(),
      capacity: Number(source?.capacity ?? 1),
      status: String(source?.status ?? 'Libre').trim(),
      active: active ? 1 : 0,
      assigned_waiter: source?.assigned_waiter ?? source?.mesero ?? null,
      notes: String(source?.notes ?? source?.observaciones ?? '')
    };
  }

  private postRestaurant(method: string, payload: any): Observable<any> {
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    return this.http.post<any>(`${this.urlBase}.${method}`, { ...(payload || {}), business }, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(map((response: any) => this.normalizeDetailResponse(response)));
  }

  private currentUserIdentifier(): string | null {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return user?.email ?? user?.user ?? user?.name ?? null;
    } catch {
      return null;
    }
  }

  private canonicalOrderStatus(value: string | null | undefined): string | null {
    const normalized = String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    if (normalized === 'ingresada') return 'Ingresada';
    if (normalized === 'preparacion') return 'Preparacion';
    if (normalized === 'lista') return 'Lista';
    if (normalized === 'cerrada') return 'Cerrada';
    if (normalized === 'cancelada') return 'Cancelada';
    return null;
  }

  private normalizeListResponse(response: any): OrdersListResponse {
    const message = response?.message ?? response ?? {};
    const rows = Array.isArray(message?.data) ? message.data : [];
    return { message: { ...message, data: rows.map((row: any) => this.normalizeRestaurantOrder(row)), total: Number(message?.total ?? message?.total_count ?? rows.length), limit: Number(message?.limit ?? rows.length), offset: Number(message?.offset ?? 0) } };
  }

  private normalizeDetailResponse(response: any): any {
    const message = response?.message ?? response ?? {};
    const rawData = message?.data ?? message;
    const data = this.normalizeRestaurantOrder(rawData);
    return { ...response, data, message: { ...(typeof message === 'object' ? message : {}), data } };
  }

  private normalizeCreateResponse(response: any): any {
    const message = response?.message ?? response ?? {};
    const data = this.normalizeRestaurantOrder(message?.data ?? message);
    // Se conserva message.data como contrato nuevo y se exponen aliases para
    // pantallas existentes que aún leen message.name durante la migración.
    return { ...response, data, message: { ...(typeof message === 'object' ? message : {}), ...data, data, emission: message?.emission ?? data?.emission } };
  }

  private normalizeRestaurantOrder(order: any): any {
    if (!order || typeof order !== 'object' || Array.isArray(order)) return order;
    // El contrato nuevo entrega el identificador en `customer` y el detalle
    // fiscal en `customer_data`; se conservan además los aliases planos para
    // que el resto de las vistas reciba un único cliente normalizado.
    const customerData = order.customer_data && typeof order.customer_data === 'object'
      ? order.customer_data
      : {};
    const embeddedCustomer = order.customer && typeof order.customer === 'object'
      ? order.customer
      : {};
    const customer = { ...embeddedCustomer, ...customerData };
    const customerId = customer.name
      ?? (typeof order.customer === 'string' ? order.customer : null)
      ?? order.customer_name
      ?? null;
    const customerName = customer.customer_name
      ?? customer.nombre
      ?? customer.fullName
      ?? order.nombre_cliente
      ?? order.customer_name
      ?? 'Consumidor Final';
    const customerIdentification = customer.identification_number
      ?? customer.num_identificacion
      ?? order.identificacion_cliente
      ?? order.customer_identification_number
      ?? '';
    const customerIdentificationType = customer.identification_type
      ?? customer.tipo_identificacion
      ?? order.tipo_identificacion_cliente
      ?? '';
    const customerEmail = customer.email ?? customer.correo ?? order.correo_cliente ?? '';
    const customerPhone = customer.phone ?? customer.telefono ?? order.telefono_cliente ?? '';
    const customerAddress = customer.address ?? customer.direccion ?? order.direccion_cliente ?? '';
    const electronic = order.electronic ?? order.sri ?? {};
    const items = Array.isArray(order.items) ? order.items.map((item: any) => ({
      ...item,
      productId: item?.productId ?? item?.product ?? item?.item,
      productName: item?.productName ?? item?.item_name ?? item?.product_name ?? item?.nombre,
      quantity: Number(item?.quantity ?? item?.qty ?? 0),
      price: Number(item?.price ?? item?.rate ?? 0),
      tax_rate: Number(item?.tax_rate ?? 0)
    })) : [];
    return {
      ...order,
      type: order.type ?? order.estado ?? 'Nota Venta',
      createdAt: order.createdAt ?? order.creation ?? order.posting_date ?? '',
      subtotal: Number(order.subtotal ?? order.totals?.subtotal ?? 0),
      iva: Number(order.iva ?? order.totals?.iva ?? 0),
      total: Number(order.total ?? order.grand_total ?? order.totals?.grand_total ?? 0),
      customer: {
        ...customer,
        name: customerId,
        customer_name: customerName,
        fullName: customerName,
        nombre: customerName,
        identification_type: customerIdentificationType,
        tipo_identificacion: customerIdentificationType,
        identification_number: customerIdentification,
        num_identificacion: customerIdentification,
        email: customerEmail,
        correo: customerEmail,
        phone: customerPhone,
        telefono: customerPhone,
        address: customerAddress,
        direccion: customerAddress
      },
      customer_data: {
        ...customer,
        name: customerId,
        customer_name: customerName,
        nombre: customerName,
        identification_type: customerIdentificationType,
        tipo_identificacion: customerIdentificationType,
        identification_number: customerIdentification,
        num_identificacion: customerIdentification,
        email: customerEmail,
        correo: customerEmail,
        phone: customerPhone,
        telefono: customerPhone,
        address: customerAddress,
        direccion: customerAddress
      },
      sri: {
        ...electronic,
        status: electronic.status ?? electronic.provider_status ?? order.provider_status ?? '',
        invoice: electronic.invoice ?? order.lite_invoice ?? '',
        number: electronic.number ?? electronic.document_number ?? '',
        access_key: electronic.access_key ?? '',
        authorization_datetime: electronic.authorization_datetime ?? ''
      },
      usuario: order.usuario ?? order.waiter ?? '',
      items
    };
  }



}
