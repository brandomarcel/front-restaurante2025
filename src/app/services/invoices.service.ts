// src/app/services/invoices.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, map, Observable, throwError } from 'rxjs';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { toast } from 'ngx-sonner';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeData, frappeList } from '../core/utils/frappe-response';
import { normalizeLiteEmissionResponse } from '../core/utils/lite-invoice-emission';

@Injectable({ providedIn: 'root' })
export class InvoicesService {
  private readonly api = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private err: FrappeErrorService,
    private capabilities: CompanyCapabilitiesService
  ) {}

  create_and_emit_from_ui_v2(payload: any): Observable<any> {

  const url = `${this.api}${API_ENDPOINT.FacturadaLite}.create_and_emit_from_ui_v2`;
    return this.http.post<any>(
      url,
      this.normalizeLiteInvoicePayload(payload),
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(
      // Keep `emission` and `data` together. Unwrapping with frappeData here
      // would discard the SRI result because body.data is the invoice itself.
      map((response: any) => normalizeLiteEmissionResponse(response)),
      catchError((e) => {
        const msg = this.err.handle(e) || 'Error al crear la factura.';
        toast.error(msg);
        return throwError(() => e);
      })
    );
  }

  emit_existing_invoice_v2(invoice_name: string): Observable<any> {
    return this.retryLiteInvoice(invoice_name);
  }

  refreshLiteInvoiceStatus(invoiceName: string): Observable<any> {
    const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId') || '';
    return this.http.post<any>(
      `${this.api}${API_ENDPOINT.FacturadaLite}.refresh_lite_invoice_status`,
      { invoice_name: invoiceName, ...(business ? { business } : {}) },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(
      map((response: any) => normalizeLiteEmissionResponse(response)),
      catchError((e) => {
        const msg = this.err.handle(e) || 'No se pudo refrescar el estado de la factura.';
        toast.error(msg);
        return throwError(() => e);
      })
    );
  }

  retryLiteInvoice(invoiceName: string): Observable<any> {
    const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId') || '';
    return this.http.post<any>(
      `${this.api}${API_ENDPOINT.FacturadaLite}.retry_lite_invoice`,
      { invoice_name: invoiceName, ...(business ? { business } : {}) },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(
      map((response: any) => normalizeLiteEmissionResponse(response)),
      catchError((e) => {
        const msg = this.err.handle(e) || 'No se pudo reintentar el envío.';
        toast.error(msg);
        return throwError(() => e);
      })
    );
  }

  reissueLiteInvoice(invoiceName: string, postingDate: string): Observable<any> {
    const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId') || '';
    return this.http.post<any>(
      `${this.api}${API_ENDPOINT.FacturadaLite}.reissue_lite_invoice`,
      { invoice_name: invoiceName, posting_date: postingDate, ...(business ? { business } : {}) },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(
      map((response: any) => normalizeLiteEmissionResponse(response)),
      catchError((e) => {
        const msg = this.err.handle(e) || 'No se pudo reemitir la factura.';
        toast.error(msg);
        return throwError(() => e);
      })
    );
  }

  sendLiteInvoiceEmail(invoiceName: string): Observable<any> {
    const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId') || '';
    return this.http.post<any>(
      `${this.api}${API_ENDPOINT.FacturadaLite}.send_lite_invoice_email`,
      { invoice_name: invoiceName, ...(business ? { business } : {}) },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(
      map((response: any) => response),
      catchError((e) => {
        const msg = this.err.handle(e) || 'No se pudo enviar la factura por correo.';
        toast.error(msg);
        return throwError(() => e);
      })
    );
  }


  queue(invoice_name: string): Observable<any> {
    return this.retryLiteInvoice(invoice_name);
  }

  getAllInvoices(limit: number = 10, offset: number = 0, status?: string) {
  let params = new HttpParams()
    .set('limit', limit.toString())
    .set('offset', offset.toString());
  if (status) params = params.set('status', this.normalizeLiteStatusFilter(status));
  const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId');
  if (business) params = params.set('business', business);

  const request$ = this.http.get(
    `${this.api}${API_ENDPOINT.FacturadaLite}.get_all_invoices`,
    { context: new HttpContext().set(REQUIRE_AUTH, true), params }
  );
  return request$.pipe(map((res: any) => {
        const rows = frappeList<any>(res).map((item) => this.fromLiteInvoice(item));
        const message = res?.message ?? res ?? {};
        return { data: rows, total: Number(message?.total ?? res?.total ?? rows.length) };
      }));
}

getOrderDetail(name: string) {
  return throwError(() => new Error('Consulta la orden mediante facturada_restaurante.api.frontend.get_order_with_details.'));
}

  getInvoiceDetail(name: string) {
    let params = new HttpParams().set('name', name);
    // El contrato Lite usa `name` para identificar la factura. Mantener el
    // business activo evita consultar documentos de otra empresa.
    params = new HttpParams().set('name', name);
    const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId');
    if (business) params = params.set('business', business);
    const request$ = this.http.get(
      `${environment.apiUrl}${API_ENDPOINT.FacturadaLite}.get_lite_invoice_detail`,
      { context: new HttpContext().set(REQUIRE_AUTH, true), params }
    );
    return request$.pipe(map((res: any) => this.fromLiteInvoice(frappeData<any>(res))));
  }

  /** Detalle de una nota de crédito Lite usando el parámetro contractual invoice_name. */
  getLiteCreditNoteDetail(invoiceName: string): Observable<any> {
    let params = new HttpParams().set('invoice_name', invoiceName);
    const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId');
    if (!business) return throwError(() => new Error('Selecciona un negocio para consultar la nota de crédito.'));
    params = params.set('business', business);
    return this.http.get<any>(
      `${this.api}${API_ENDPOINT.FacturadaLite}.get_lite_invoice_detail`,
      { context: new HttpContext().set(REQUIRE_AUTH, true), params }
    ).pipe(map((response: any) => {
      const normalized = this.fromLiteInvoice(frappeData<any>(response));
      // El endpoint se consulta exclusivamente para el detalle de una nota;
      // si una versión del backend omite document_type, no la presentamos
      // como factura.
      return normalized && typeof normalized === 'object'
        ? { ...normalized, type: normalized.type === 'Factura' ? 'Nota de Credito' : normalized.type, document_type: normalized.document_type === 'Factura' ? 'Nota de Credito' : normalized.document_type }
        : normalized;
    }));
  }

  private normalizeLiteInvoicePayload(payload: any): any {
    const normalized = { ...(payload || {}) };
    const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId') || payload?.business || '';
    if (business) normalized.business = business;
    delete normalized.company;
    delete normalized.company_id;

    normalized.posting_date = payload?.posting_date || payload?.fecha || new Date().toISOString().slice(0, 10);
    delete normalized.fecha;

    const environmentValue = payload?.environment
      || this.capabilities.business?.environment
      || this.capabilities.business?.ambiente
      || this.capabilities.business?.tax_profile?.environment;
    if (environmentValue) {
      const normalizedEnvironment = String(environmentValue)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
      normalized.environment = normalizedEnvironment.includes('PROD') ? 'Produccion' : 'Pruebas';
    }

    normalized.items = (payload?.items || []).map((item: any) => {
      const itemId = item?.item || item?.product || item?.item_code || item?.name || item?.productId;
      return {
        item: itemId,
        qty: Number(item?.qty ?? item?.quantity ?? 1),
        rate: Number(item?.rate ?? item?.price ?? 0),
        tax_rate: Number(item?.tax_rate ?? item?.tax_value ?? 0)
      };
    });

    normalized.payments = (payload?.payments || []).map((payment: any) => {
      const method = payment?.payment_method || payment?.formas_de_pago || payment?.name || payment?.codigo;
      const amount = Number(payment?.amount ?? payment?.monto ?? 0);
      return {
        payment_method: method,
        payment_code: payment?.payment_code || payment?.forma_pago || payment?.codigo || '',
        amount
      };
    });

    normalized.additional_fields = (payload?.additional_fields || payload?.additionalFields || [])
      .map((field: any) => ({
        field_name: String(field?.field_name ?? field?.name ?? '').trim(),
        field_value: String(field?.field_value ?? field?.value ?? '').trim()
      }))
      .filter((field: any) => field.field_name || field.field_value);
    delete normalized.additionalFields;

    delete normalized.order_name;
    delete normalized.auto_queue;

    return normalized;
  }

  private normalizeListResponse(res: any): any {
    const message = res?.message ?? res ?? {};
    const data = message?.data ?? res?.data ?? [];
    const rows = Array.isArray(data) ? data.map((item: any) => this.fromLiteInvoice(item)) : [];
    return {
      ...res,
      message: {
        ...(typeof message === 'object' ? message : {}),
        data: rows,
        total: Number(message?.total ?? res?.total ?? rows.length)
      }
    };
  }

  private normalizeDetailResponse(res: any): any {
    const message = res?.message ?? res ?? {};
    const data = message?.data ?? res?.data ?? message;
    const normalizedData = this.fromLiteInvoice(data);
    return {
      ...res,
      message: {
        ...(typeof message === 'object' ? message : {}),
        data: normalizedData
      }
    };
  }

  private fromLiteInvoice(invoice: any): any {
    if (!invoice || typeof invoice !== 'object') return invoice;

    const rawCustomerSource = invoice.customer_data ?? invoice.customer ?? {};
    const customerSource = rawCustomerSource && typeof rawCustomerSource === 'object'
      ? rawCustomerSource
      : { name: rawCustomerSource };
    const sriSource = invoice.sri && typeof invoice.sri === 'object'
      ? invoice.sri
      : (invoice.electronic && typeof invoice.electronic === 'object' ? invoice.electronic : {});
    const totals = invoice.totals && typeof invoice.totals === 'object' ? invoice.totals : {};
    const documentStatus = invoice.status ?? invoice.einvoice_status ?? invoice.document_status;
    const normalizedStatus = this.normalizeLiteStatus(documentStatus ?? sriSource.status ?? sriSource.provider_status);
    const providerStatus = String(sriSource.provider_status ?? invoice.provider_status ?? '').trim().toUpperCase();

    return {
      ...invoice,
      name: invoice.name ?? invoice.invoice_name ?? invoice.documento,
      createdAt: invoice.createdAt ?? invoice.posting_date ?? invoice.issue_date ?? invoice.fecha_emision,
      subtotal: Number(invoice.subtotal ?? invoice.net_total ?? totals.total_without_tax ?? totals.total_gross ?? 0) || 0,
      iva: Number(invoice.iva ?? invoice.tax_total ?? invoice.total_taxes_and_charges ?? totals.total_taxes ?? 0) || 0,
      total: Number(invoice.total ?? invoice.grand_total ?? totals.grand_total ?? 0) || 0,
      status: normalizedStatus,
      type: invoice.type ?? invoice.tipo ?? invoice.document_type ?? 'Factura',
      document_type: invoice.document_type ?? invoice.type ?? invoice.tipo ?? 'Factura',
      related_invoice: invoice.related_invoice ?? invoice.invoice_modified?.invoice_reference,
      related_document_number: invoice.related_document_number ?? invoice.invoice_modified?.secuencial_factura,
      related_access_key: invoice.related_access_key ?? invoice.invoice_modified?.access_key,
      related_issue_date: invoice.related_issue_date ?? invoice.invoice_modified?.issue_date,
      credit_note_reason: invoice.credit_note_reason ?? invoice.motivo ?? invoice.reason ?? invoice.invoice_modified?.motivo,
      customer: {
        ...customerSource,
        name: customerSource.name ?? invoice.customer,
        fullName: customerSource.fullName ?? customerSource.nombre ?? customerSource.customer_name ?? invoice.customer_name ?? invoice.nombre_cliente,
        nombre: customerSource.nombre ?? customerSource.customer_name ?? invoice.customer_name ?? invoice.nombre_cliente,
        num_identificacion: customerSource.num_identificacion ?? customerSource.identification_number ?? customerSource.customer_identification_number ?? invoice.identification_number ?? invoice.identificacion,
        telefono: customerSource.telefono ?? customerSource.phone ?? invoice.phone ?? invoice.telefono,
        correo: customerSource.correo ?? customerSource.email ?? invoice.email ?? invoice.correo,
        direccion: customerSource.direccion ?? customerSource.address ?? invoice.address ?? invoice.direccion,
        tipo_identificacion: customerSource.tipo_identificacion ?? customerSource.identification_type ?? invoice.identification_type
      },
      sri: {
        ...sriSource,
        invoice: sriSource.invoice ?? invoice.sales_invoice ?? invoice.invoice_name ?? invoice.name ?? sriSource.document_number,
        number: sriSource.number ?? sriSource.sequential_number ?? invoice.number ?? invoice.secuencial ?? invoice.sri_number ?? invoice.document_number,
        // En Lite el estado del documento (p. ej. "Emitida") viene en la
        // factura y el estado del proveedor llega separado como
        // `provider_status` (p. ej. "PROCESSING"). Mantener ambos separados
        // permite mostrar el botón de consultar sin confundir PROCESSING con
        // el estado documental.
        // `status` es el estado documental Lite; el del proveedor se conserva
        // separado para distinguir Emitida/PROCESSING de Autorizada.
        status: normalizedStatus,
        provider_status: providerStatus || undefined,
        sri_code: sriSource.sri_code ?? sriSource.codigo_sri ?? invoice.sri_code ?? invoice.sri_status_code ?? invoice.codigo_sri ?? invoice.status_code,
        status_code: sriSource.status_code ?? sriSource.provider_status_code ?? invoice.status_code ?? invoice.provider_status_code,
        access_key: sriSource.access_key ?? invoice.access_key ?? invoice.clave_acceso,
        authorization_number: sriSource.authorization_number ?? invoice.authorization_number ?? invoice.numero_autorizacion,
        authorization_datetime: sriSource.authorization_datetime ?? invoice.authorization_datetime ?? invoice.fecha_autorizacion,
        sri_message: sriSource.sri_message ?? sriSource.emission_error ?? invoice.sri_message ?? invoice.mensaje_sri,
        messages: sriSource.messages ?? invoice.messages ?? invoice.emission?.messages
      },
      items: Array.isArray(invoice.items) ? invoice.items.map((item: any) => ({
        ...item,
        name: item.name ?? item.item,
        item: item.item ?? item.item_code,
        item_code: item.item_code ?? item.item,
        productName: item.productName ?? item.item_name ?? item.nombre ?? item.product_name,
        quantity: item.quantity ?? item.qty,
        price: item.price ?? item.rate ?? item.standard_rate,
        subtotal: item.subtotal ?? item.taxable_amount ?? item.gross_amount ?? item.amount,
        total: item.total ?? item.total_amount ?? item.net_total,
        tax_rate: item.tax_rate ?? item.iva ?? item.tax_value ?? 0
      })) : [],
      payments: Array.isArray(invoice.payments) ? invoice.payments.map((payment: any) => ({
        ...payment,
        payment_method: payment.payment_method ?? payment.formas_de_pago ?? payment.name,
        forma_pago: payment.forma_pago ?? payment.codigo ?? payment.sri_code,
        monto: Number(payment.monto ?? payment.amount ?? payment.paid_amount ?? 0) || 0
      })) : [],
      additional_fields: invoice.additional_fields ?? invoice.additionalFields ?? [],
      email_status: invoice.email_status ?? invoice.mail_status ?? invoice.email_delivery_status ?? invoice.correo_status,
      email_sent: invoice.email_sent ?? invoice.mail_sent ?? invoice.correo_enviado,
      email_error: invoice.email_error ?? invoice.mail_error ?? invoice.correo_error
    };
  }

  private normalizeLiteStatus(value: any): string {
    const status = String(value ?? '').trim().toUpperCase();
    if (status === 'AUTORIZADA' || status === 'AUTHORIZED' || status === 'SRI_AUTHORIZED') return 'AUTORIZADO';
    if (status === 'RECHAZADA' || status === 'REJECTED' || status === 'SRI_REJECTED' || status === 'NOT_AUTHORIZED') return 'RECHAZADO';
    // Conservar "Pendiente Emision" para que la UI habilite el reintento;
    // "Emitida" con provider_status se reserva para consultar estado.
    if (status === 'QUEUED') return 'EN COLA';
    return status;
  }

  private normalizeLiteStatusFilter(value: any): string {
    const status = String(value ?? '').trim().toUpperCase();
    if (status === 'AUTORIZADO' || status === 'AUTORIZADA') return 'Autorizada';
    if (status === 'RECHAZADO' || status === 'RECHAZADA') return 'Rechazada';
    if (status === 'BORRADOR' || status === 'DRAFT') return 'Borrador';
    if (status === 'PROCESSING' || status === 'PENDIENTE EMISION' || status === 'PENDIENTE EMISIÓN') return 'Pendiente Emision';
    if (status === 'EMITIDA') return 'Emitida';
    if (status === 'ANULADA') return 'Anulada';
    return value;
  }


}
