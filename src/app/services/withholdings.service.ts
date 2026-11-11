import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable, map, throwError } from 'rxjs';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeData } from '../core/utils/frappe-response';
import { LiteEmissionResult, normalizeLiteEmissionResponse } from '../core/utils/lite-invoice-emission';
import { LiteSupplier } from './lite-suppliers.service';
import { PurchaseSettlementsService } from './purchase-settlements.service';
import { SriAnnulmentRequest } from './invoices.service';

export interface CodeLabel { code: string; label: string }

/** `get_withholding_setup`: catálogos del formulario y por qué no se puede emitir. */
export interface WithholdingSetup {
  withholding_agent: boolean;
  block_message: string | null;
  support_codes: CodeLabel[];
  document_types: CodeLabel[];
  tax_codes: (CodeLabel & { rate: number })[];
  vat_withholding_rates: number[];
  payment_methods: CodeLabel[];
  /** Conceptos de renta (código ATS = código de retención) con su % vigente; el SRI rechaza otro porcentaje. */
  income_concepts: IncomeConcept[];
}

export interface IncomeConcept {
  code: string;
  form_103: string;
  label: string;
  percentage: number;
  variable: boolean;
}

/** `lookup_lite_access_key`: datos leídos de la clave de acceso de la factura del proveedor. */
export interface AccessKeyLookup {
  valid: boolean;
  message?: string;
  test_environment: boolean;
  document_type: string;
  number: string;
  issue_date: string;
  ruc: string;
  supplier: LiteSupplier | null;
}

export type WithholdingTaxType = 'Renta' | 'IVA';

export interface WithholdingInput {
  name?: string;
  establishment?: string;
  emission_point?: string;
  environment?: 'Pruebas' | 'Produccion';
  supplier: string;
  support: {
    cod_sustento: string;
    cod_doc_sustento: string;
    num_doc_sustento: string;
    fecha_emision_doc_sustento: string;
    num_aut_doc_sustento?: string;
    forma_pago: string;
    taxes: { tax_code: string; base_imponible: number }[];
  };
  retentions: {
    tax_type: WithholdingTaxType;
    codigo_retencion?: string;
    base_imponible: number;
    porcentaje: number;
  }[];
  additional_fields?: { field_name: string; field_value: string }[];
  notes?: string;
}

/**
 * Comprobante de retención (SRI 07) de FacturADA Lite. Se emite como una guía de remisión: borrador → emitir →
 * estados SRI compartidos. Contrato: `docs/frontend_withholdings.md`.
 */
@Injectable({ providedIn: 'root' })
export class WithholdingsService {
  private readonly api = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private capabilities: CompanyCapabilitiesService,
    private purchaseSettlements: PurchaseSettlementsService
  ) {}

  /**
   * Liquidación de compra (SRI 03) que sirve de sustento a una retención nueva (`?liquidacion=` del formulario).
   * Pasa por aquí para que el formulario de retención dependa de un solo servicio.
   */
  getPurchaseSettlement(name: string): Observable<any> {
    return this.purchaseSettlements.getDetail(name);
  }

  /** `dates`: rango de fecha de emisión (`YYYY-MM-DD`); búsqueda, estado y fechas se aplican en el backend. */
  getAll(limit = 10, offset = 0, status?: string, search = '', dates?: { from?: string; to?: string }) {
    const pageSize = Math.max(1, Number(limit) || 10);
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para consultar las retenciones.'));
    let params = new HttpParams()
      .set('business', business)
      .set('limit', String(pageSize))
      .set('offset', String(offset));
    if (status) params = params.set('status', status);
    if (search.trim()) params = params.set('search', search.trim());
    if (dates?.from) params = params.set('from_date', dates.from);
    if (dates?.to) params = params.set('to_date', dates.to);

    return this.http.get<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.get_all_withholdings`,
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
    if (!name) return throwError(() => new Error('Retención no especificada.'));
    const business = this.activeBusiness();
    let params = new HttpParams().set('name', name);
    if (business) params = params.set('business', business);
    return this.http.get<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.get_lite_withholding_detail`,
      { context: new HttpContext().set(REQUIRE_AUTH, true), params }
    ).pipe(map((res: any) => frappeData<any>(res)));
  }

  getSetup(): Observable<WithholdingSetup> {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para emitir retenciones.'));
    return this.http.get<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.get_withholding_setup`,
      { context: new HttpContext().set(REQUIRE_AUTH, true), params: new HttpParams().set('business', business) }
    ).pipe(map((res: any) => frappeData<WithholdingSetup>(res)));
  }

  /** Lee número, fecha, tipo y RUC del emisor desde la clave de acceso de 49 dígitos de la factura del proveedor. */
  lookupAccessKey(accessKey: string): Observable<AccessKeyLookup> {
    const business = this.activeBusiness();
    return this.http.post<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.lookup_lite_access_key`,
      { access_key: accessKey, ...(business ? { business } : {}) },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(map((res: any) => frappeData<AccessKeyLookup>(res)));
  }

  /** Sin `payload.name`: crea un borrador. Con `payload.name`: actualiza ese borrador. */
  saveDraft(payload: WithholdingInput): Observable<any> {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para guardar la retención.'));
    return this.http.post<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.create_lite_withholding`,
      { business, payload },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(map((res: any) => frappeData<any>(res)));
  }

  /** Crea y emite en un solo paso: reserva secuencial y clave de acceso de inmediato. */
  createAndEmit(payload: WithholdingInput): Observable<LiteEmissionResult> {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para emitir la retención.'));
    return this.http.post<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.create_and_emit_lite_withholding`,
      { business, payload },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(map((res: any) => normalizeLiteEmissionResponse(res)));
  }

  /** Emite un borrador guardado: solo entonces se reserva secuencial y clave de acceso. */
  emitDraft(withholdingName: string): Observable<LiteEmissionResult> {
    return this.postAction('emit_lite_withholding', withholdingName);
  }

  /** Consulta el estado en el SRI. Nunca reemite: es la acción segura ante 43/70, tiempo agotado o error ambiguo. */
  refreshStatus(withholdingName: string): Observable<LiteEmissionResult> {
    return this.postAction('refresh_lite_withholding_status', withholdingName);
  }

  /** Reintento manual (nunca automático): solo se ofrece en estados que lo permiten. */
  retry(withholdingName: string): Observable<LiteEmissionResult> {
    return this.postAction('retry_lite_withholding', withholdingName);
  }

  /** Registra una retención autorizada que el negocio ya anuló en el portal del SRI (no envía nada al SRI). */
  registerSriAnnulment(withholdingName: string, data: SriAnnulmentRequest): Observable<{ data: any }> {
    const business = this.activeBusiness();
    return this.http.post<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.register_lite_withholding_sri_annulment`, {
      withholding_name: withholdingName, sri_annulment_date: data.date, reason: data.reason,
      sri_reference: data.reference || null, confirmed_in_sri: data.confirmed ? 1 : 0, ...(business ? { business } : {})
    }, { context: new HttpContext().set(REQUIRE_AUTH, true) }).pipe(map((res: any) => res?.message ?? res));
  }

  private postAction(method: string, withholdingName: string): Observable<LiteEmissionResult> {
    const business = this.activeBusiness();
    return this.http.post<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.${method}`,
      { withholding_name: withholdingName, ...(business ? { business } : {}) },
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
