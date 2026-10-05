import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from 'src/app/core/constants/api.constants';
import { REQUIRE_AUTH } from 'src/app/core/interceptor/auth-context';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { parseLocalizedDecimal } from 'src/app/shared/utils/decimal.utils';

export interface InvoiceCollectionPayload {
  business: string;
  invoice: string;
  payment_method: string;
  payment_code: string;
  amount: number;
  reference?: string;
  notes?: string;
}

export interface ReceivablesFilters {
  customer?: string;
  collection_status?: 'Pendiente' | 'Abonada' | 'Pagada' | '';
  only_open?: boolean;
  limit?: number;
  offset?: number;
}

/** API de cartera. No interpreta estados SRI: solo collection_status y saldos. */
@Injectable({ providedIn: 'root' })
export class InvoiceCollectionsService {
  private readonly endpoint = `${environment.apiUrl}${API_ENDPOINT.FacturadaLite}`;

  constructor(
    private readonly http: HttpClient,
    private readonly capabilities: CompanyCapabilitiesService
  ) {}

  getReceivables(filters: ReceivablesFilters = {}): Observable<any> {
    const business = this.businessOrEmpty();
    if (!business) return throwError(() => new Error('Selecciona un negocio para consultar la cartera.'));
    let params = new HttpParams()
      .set('business', business)
      .set('only_open', filters.only_open === false ? '0' : '1')
      .set('limit', String(Math.max(1, Number(filters.limit) || 20)))
      .set('offset', String(Math.max(0, Number(filters.offset) || 0)));
    if (filters.customer) params = params.set('customer', filters.customer);
    if (filters.collection_status) params = params.set('collection_status', filters.collection_status);
    return this.http.get<any>(`${this.endpoint}.get_lite_invoice_receivables`, {
      params,
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  getCollections(invoiceName: string, limit = 50, offset = 0): Observable<any> {
    const business = this.businessOrEmpty();
    if (!business || !invoiceName) return throwError(() => new Error('Factura o negocio no disponible para consultar abonos.'));
    const params = new HttpParams()
      .set('business', business)
      .set('invoice_name', invoiceName)
      .set('limit', String(Math.max(1, limit)))
      .set('offset', String(Math.max(0, offset)));
    return this.http.get<any>(`${this.endpoint}.get_lite_invoice_collections`, {
      params,
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  /**
   * La caja es una validación previa para cobros en efectivo. Se consulta sin
   * inferirla desde el estado SRI ni desde una caja de otro negocio; el
   * backend sigue siendo quien autoriza finalmente el abono.
   */
  getCurrentCashOpening(): Observable<any> {
    const business = this.businessOrEmpty();
    if (!business) return throwError(() => new Error('Selecciona un negocio antes de consultar la caja.'));
    return this.http.get<any>(
      `${environment.apiUrl}/method/facturada_restaurante.api.frontend.get_current_cash_opening`,
      {
        params: new HttpParams().set('business', business),
        context: new HttpContext().set(REQUIRE_AUTH, true)
      }
    ).pipe(map((response: any) => {
      const message = response?.message ?? response ?? {};
      const raw = message?.data ?? response?.data ?? message;
      const opening = raw?.cash_opening ?? raw?.apertura ?? raw?.opening
        ?? (raw?.name ? raw : null);
      const status = String(opening?.status ?? opening?.estado ?? raw?.status ?? '').trim().toLowerCase();
      const name = typeof opening === 'string' ? opening : String(opening?.name || '').trim();
      if (!name || status === 'cerrada' || status === 'closed') {
        throw new Error('Debe abrir caja antes de registrar un abono en efectivo.');
      }
      return response;
    }));
  }

  createCollection(payload: Omit<InvoiceCollectionPayload, 'business'>): Observable<any> {
    const business = this.businessOrEmpty();
    if (!business) return throwError(() => new Error('Selecciona un negocio antes de registrar el abono.'));
    return this.http.post<any>(`${this.endpoint}.create_lite_invoice_collection`, {
      business,
      ...payload,
      amount: parseLocalizedDecimal(payload.amount) ?? 0,
      reference: String(payload.reference || '').trim(),
      notes: String(payload.notes || '').trim()
    }, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }

  cancelCollection(collectionName: string, reason: string): Observable<any> {
    const business = this.businessOrEmpty();
    if (!business || !collectionName) return throwError(() => new Error('Abono o negocio no disponible para anular.'));
    return this.http.post<any>(`${this.endpoint}.cancel_lite_invoice_collection`, {
      collection_name: collectionName,
      business,
      reason: String(reason || '').trim()
    }, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }

  private businessOrEmpty(): string {
    return String(
      this.capabilities.activeBusinessId
      || this.capabilities.businessId
      || localStorage.getItem('active_business')
      || localStorage.getItem('businessId')
      || ''
    ).trim();
  }
}
