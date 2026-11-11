import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable, map, throwError } from 'rxjs';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeData } from '../core/utils/frappe-response';

/** RUC, cédula, pasaporte, identificación del exterior (códigos SRI). */
export type SupplierIdentificationType = '04' | '05' | '06' | '08';

/** Proveedor del negocio (FacturADA Lite). Contrato: `docs/frontend_withholdings.md`. */
export interface LiteSupplier {
  name: string;
  supplier_name: string;
  identification_type: SupplierIdentificationType;
  identification: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  related_party: boolean;
  is_active: boolean;
}

export type LiteSupplierInput = Omit<LiteSupplier, 'name' | 'is_active'> & { name?: string; is_active?: boolean };

export const SUPPLIER_IDENTIFICATION_TYPES: readonly { value: SupplierIdentificationType; label: string }[] = [
  { value: '04', label: 'RUC' },
  { value: '05', label: 'Cédula' },
  { value: '06', label: 'Pasaporte' },
  { value: '08', label: 'Identificación del exterior' }
];

export function supplierIdentificationLabel(code: unknown): string {
  return SUPPLIER_IDENTIFICATION_TYPES.find(type => type.value === code)?.label || String(code || '—');
}

/**
 * Proveedores de FacturADA Lite: lista con búsqueda en el servidor y alta/edición. Por ahora solo los usa la
 * retención; el backend valida la identificación y que no se repita en el negocio.
 */
@Injectable({ providedIn: 'root' })
export class LiteSuppliersService {
  private readonly api = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private capabilities: CompanyCapabilitiesService
  ) {}

  /** `search`: nombre o identificación. */
  search(search = '', limit = 8, offset = 0): Observable<{ data: LiteSupplier[]; total: number; has_next: boolean }> {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para consultar proveedores.'));
    let params = new HttpParams()
      .set('business', business)
      .set('limit', String(limit))
      .set('offset', String(offset));
    if (search.trim()) params = params.set('search', search.trim());
    return this.http.get<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.get_lite_suppliers`,
      { context: new HttpContext().set(REQUIRE_AUTH, true), params }
    ).pipe(map((res: any) => {
      const body = res?.message ?? res ?? {};
      const data = Array.isArray(body?.data) ? body.data : [];
      return { data, total: Number(body?.total ?? data.length) || 0, has_next: Boolean(body?.has_next) };
    }));
  }

  /** Sin `name` crea; con `name` actualiza. */
  save(supplier: LiteSupplierInput): Observable<LiteSupplier> {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para guardar el proveedor.'));
    return this.http.post<any>(`${this.api}${API_ENDPOINT.FacturadaLite}.save_lite_supplier`,
      { business, payload: supplier },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(map((res: any) => frappeData<LiteSupplier>(res)));
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
