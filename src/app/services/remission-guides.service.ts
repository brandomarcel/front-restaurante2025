import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, map, Observable, throwError } from 'rxjs';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeData } from '../core/utils/frappe-response';
import { normalizeLiteEmissionResponse } from '../core/utils/lite-invoice-emission';

/**
 * Guías de Remisión (FacturADA Lite). Todos los endpoints son internos de
 * Frappe (`/api/method/...`), nunca la API externa `/api/v1`.
 *
 * Por ahora una guía NO afecta inventario: solo crea/emite/consulta el
 * documento electrónico de transporte.
 */
@Injectable({ providedIn: 'root' })
export class RemissionGuidesService {
  private readonly api = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private capabilities: CompanyCapabilitiesService
  ) {}

  getAll(limit = 10, offset = 0, status?: string, guideEnvironment?: string, search = '') {
    const pageSize = Math.max(1, Number(limit) || 10);
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para consultar las guías de remisión.'));
    let params = new HttpParams()
      .set('business', business)
      .set('limit', String(pageSize))
      .set('offset', String(offset));
    if (status) params = params.set('status', status);
    if (guideEnvironment) params = params.set('environment', guideEnvironment);
    if (search.trim()) params = params.set('search', search.trim());

    return this.http.get<any>(
      `${this.api}${API_ENDPOINT.FacturadaLite}.get_all_remission_guides`,
      { context: new HttpContext().set(REQUIRE_AUTH, true), params }
    ).pipe(map((res: any) => {
      const message = res?.message ?? res ?? {};
      const rows = Array.isArray(message?.data) ? message.data : [];
      const totalCandidate = Number(message?.total ?? message?.total_count ?? message?.count ?? rows.length);
      const total = Number.isFinite(totalCandidate) && totalCandidate >= 0 ? totalCandidate : rows.length;
      const hasNext = Boolean(message?.has_next ?? message?.hasNext ?? (offset + rows.length < total));
      return {
        message: {
          ...message,
          data: rows,
          total,
          limit: Number(message?.limit ?? pageSize),
          offset: Number(message?.offset ?? offset),
          has_next: hasNext
        }
      };
    }));
  }

  getDetail(name: string): Observable<any> {
    if (!name) return throwError(() => new Error('Guía de remisión no especificada.'));
    const business = this.activeBusiness();
    let params = new HttpParams().set('name', name);
    if (business) params = params.set('business', business);
    return this.http.get<any>(
      `${this.api}${API_ENDPOINT.FacturadaLite}.get_lite_remission_guide_detail`,
      { context: new HttpContext().set(REQUIRE_AUTH, true), params }
    ).pipe(map((res: any) => frappeData<any>(res)));
  }

  /** Sin `payload.name`: crea un borrador nuevo. Con `payload.name`: actualiza el borrador existente. */
  saveDraft(payload: any): Observable<any> {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para guardar la guía de remisión.'));
    return this.http.post<any>(
      `${this.api}${API_ENDPOINT.FacturadaLite}.create_lite_remission_guide`,
      { ...payload, business },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(map((res: any) => frappeData<any>(res)));
  }

  /** Crea y emite en un solo paso: reserva secuencial y clave de acceso de inmediato. */
  createAndEmit(payload: any): Observable<any> {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para emitir la guía de remisión.'));
    return this.http.post<any>(
      `${this.api}${API_ENDPOINT.FacturadaLite}.create_and_emit_lite_remission_guide`,
      { ...payload, business },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(
      map((res: any) => normalizeLiteEmissionResponse(res)),
      catchError((e) => throwError(() => e))
    );
  }

  /** Emite un borrador ya guardado: solo entonces se reserva secuencial y clave de acceso. */
  emitDraft(guideName: string): Observable<any> {
    const business = this.activeBusiness();
    return this.http.post<any>(
      `${this.api}${API_ENDPOINT.FacturadaLite}.emit_lite_remission_guide`,
      { guide_name: guideName, ...(business ? { business } : {}) },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(
      map((res: any) => normalizeLiteEmissionResponse(res)),
      catchError((e) => throwError(() => e))
    );
  }

  /** Consulta el estado en el SRI. Nunca reintenta: es la acción segura ante 302/timeout/70/errores ambiguos. */
  refreshStatus(guideName: string): Observable<any> {
    const business = this.activeBusiness();
    return this.http.post<any>(
      `${this.api}${API_ENDPOINT.FacturadaLite}.refresh_lite_remission_guide_status`,
      { guide_name: guideName, ...(business ? { business } : {}) },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(
      map((res: any) => normalizeLiteEmissionResponse(res)),
      catchError((e) => throwError(() => e))
    );
  }

  /** Reintento manual (nunca automático): solo se ofrece cuando el documento quedó en un estado retryable. */
  retry(guideName: string): Observable<any> {
    const business = this.activeBusiness();
    return this.http.post<any>(
      `${this.api}${API_ENDPOINT.FacturadaLite}.retry_lite_remission_guide`,
      { guide_name: guideName, ...(business ? { business } : {}) },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(
      map((res: any) => normalizeLiteEmissionResponse(res)),
      catchError((e) => throwError(() => e))
    );
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
