import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable, map, throwError } from 'rxjs';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeData } from '../core/utils/frappe-response';
import { LiteEmissionResult, normalizeLiteEmissionResponse } from '../core/utils/lite-invoice-emission';
import { SriAnnulmentRequest } from './invoices.service';

export interface CodeLabel { code: string; label: string }

/** `get_purchase_settlement_setup`: catálogos del formulario y por qué no se puede emitir. */
export interface PurchaseSettlementSetup {
  block_message: string | null;
  /** Para ofrecer «Crear retención» cuando la liquidación queda autorizada. */
  withholding_agent: boolean;
  tax_codes: (CodeLabel & { rate: number })[];
  payment_methods: CodeLabel[];
  identification_types: CodeLabel[];
}

export interface PurchaseSettlementItemInput {
  descripcion: string;
  codigo?: string;
  unidad_medida?: string;
  cantidad: number;
  precio_unitario: number;
  descuento?: number;
  tax_code: string;
}

export interface PurchaseSettlementInput {
  name?: string;
  establishment?: string;
  emission_point?: string;
  environment?: 'Pruebas' | 'Produccion';
  supplier: string;
  forma_pago: string;
  items: PurchaseSettlementItemInput[];
  additional_fields?: { field_name: string; field_value: string }[];
  notes?: string;
}

/**
 * Liquidación de compra de bienes y prestación de servicios (SRI 03) de FacturADA Lite: lo que el negocio le compra
 * a quien no puede darle factura. Mismo ciclo que la retención: borrador → emitir → estados SRI compartidos.
 * Contrato: `docs/frontend_purchase_settlements.md`.
 */
@Injectable({ providedIn: 'root' })
export class PurchaseSettlementsService {
  private readonly api = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private capabilities: CompanyCapabilitiesService
  ) {}

  /** `dates`: rango de fecha de emisión (`YYYY-MM-DD`); búsqueda, estado y fechas se aplican en el backend. */
  getAll(limit = 10, offset = 0, status?: string, search = '', dates?: { from?: string; to?: string }) {
    const pageSize = Math.max(1, Number(limit) || 10);
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para consultar las liquidaciones de compra.'));
    let params = new HttpParams()
      .set('business', business)
      .set('limit', String(pageSize))
      .set('offset', String(offset));
    if (status) params = params.set('status', status);
    if (search.trim()) params = params.set('search', search.trim());
    if (dates?.from) params = params.set('from_date', dates.from);
    if (dates?.to) params = params.set('to_date', dates.to);

    return this.http.get<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.get_all_purchase_settlements`,
      { context: new HttpContext().set(REQUIRE_AUTH, true), params }
    ).pipe(map((res: any) => {
      const message = res?.message ?? res ?? {};
      const rows = Array.isArray(message?.data) ? message.data : [];
      const totalCandidate = Number(message?.total ?? rows.length);
      const total = Number.isFinite(totalCandidate) && totalCandidate >= 0 ? totalCandidate : rows.length;
      return {
        message: {
          ...message,
          data: rows,
          total,
          limit: Number(message?.limit ?? pageSize),
          offset: Number(message?.offset ?? offset),
          has_next: Boolean(message?.has_next ?? (offset + rows.length < total))
        }
      };
    }));
  }

  getDetail(name: string): Observable<any> {
    if (!name) return throwError(() => new Error('Liquidación de compra no especificada.'));
    const business = this.activeBusiness();
    let params = new HttpParams().set('name', name);
    if (business) params = params.set('business', business);
    return this.http.get<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.get_lite_purchase_settlement_detail`,
      { context: new HttpContext().set(REQUIRE_AUTH, true), params }
    ).pipe(map((res: any) => frappeData<any>(res)));
  }

  getSetup(): Observable<PurchaseSettlementSetup> {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para emitir liquidaciones de compra.'));
    return this.http.get<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.get_purchase_settlement_setup`,
      { context: new HttpContext().set(REQUIRE_AUTH, true), params: new HttpParams().set('business', business) }
    ).pipe(map((res: any) => frappeData<PurchaseSettlementSetup>(res)));
  }

  /** Sin `payload.name`: crea un borrador. Con `payload.name`: actualiza ese borrador. */
  saveDraft(payload: PurchaseSettlementInput): Observable<any> {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para guardar la liquidación de compra.'));
    return this.http.post<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.create_lite_purchase_settlement`,
      { business, payload },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(map((res: any) => frappeData<any>(res)));
  }

  /** Crea y emite en un solo paso: reserva secuencial y clave de acceso de inmediato. */
  createAndEmit(payload: PurchaseSettlementInput): Observable<LiteEmissionResult> {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para emitir la liquidación de compra.'));
    return this.http.post<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.create_and_emit_lite_purchase_settlement`,
      { business, payload },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(map((res: any) => normalizeLiteEmissionResponse(res)));
  }

  /** Emite un borrador guardado: solo entonces se reserva secuencial y clave de acceso. */
  emitDraft(settlementName: string): Observable<LiteEmissionResult> {
    return this.postAction('emit_lite_purchase_settlement', settlementName);
  }

  /** Consulta el estado en el SRI. Nunca reemite: es la acción segura ante 43/70, tiempo agotado o error ambiguo. */
  refreshStatus(settlementName: string): Observable<LiteEmissionResult> {
    return this.postAction('refresh_lite_purchase_settlement_status', settlementName);
  }

  /** Reintento manual (nunca automático): solo se ofrece en estados que lo permiten. */
  retry(settlementName: string): Observable<LiteEmissionResult> {
    return this.postAction('retry_lite_purchase_settlement', settlementName);
  }

  /** Registra una liquidación autorizada que el negocio ya anuló en el portal del SRI (no envía nada al SRI). */
  registerSriAnnulment(settlementName: string, data: SriAnnulmentRequest): Observable<{ data: any }> {
    const business = this.activeBusiness();
    return this.http.post<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.register_lite_purchase_settlement_sri_annulment`, {
      settlement_name: settlementName, sri_annulment_date: data.date, reason: data.reason,
      sri_reference: data.reference || null, confirmed_in_sri: data.confirmed ? 1 : 0, ...(business ? { business } : {})
    }, { context: new HttpContext().set(REQUIRE_AUTH, true) }).pipe(map((res: any) => res?.message ?? res));
  }

  private postAction(method: string, settlementName: string): Observable<LiteEmissionResult> {
    const business = this.activeBusiness();
    return this.http.post<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.${method}`,
      { settlement_name: settlementName, ...(business ? { business } : {}) },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(map((res: any) => normalizeLiteEmissionResponse(res)));
  }

  private activeBusiness(): string {
    return String(
      this.capabilities.activeBusinessId
      || this.capabilities.businessId
      || localStorage.getItem('active_business')
      || localStorage.getItem('businessId')
      || ''
    ).trim();
  }
}
