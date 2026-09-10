import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeData } from '../core/utils/frappe-response';

@Injectable({ providedIn: 'root' })
export class PosSaleService {
  private readonly api = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private capabilities: CompanyCapabilitiesService
  ) {}

  create(payload: any): Observable<any> {
    return this.http.post<any>(this.endpoint('create_pos_sale_note'), this.withBusiness(payload), this.auth()).pipe(
      map((response) => this.unwrap(response))
    );
  }

  update(payload: any): Observable<any> {
    return this.http.post<any>(this.endpoint('update_pos_sale_note'), this.withBusiness(payload), this.auth()).pipe(
      map((response) => this.unwrap(response))
    );
  }

  get(name: string): Observable<any> {
    let params = new HttpParams().set('name', name);
    params = this.withBusinessParams(params);
    return this.http.get<any>(this.endpoint('get_pos_sale_note'), { ...this.auth(), params }).pipe(
      map((response) => this.unwrap(response))
    );
  }

  list(status?: string, fromDate?: string, toDate?: string): Observable<any[]> {
    let params = this.withBusinessParams(new HttpParams());
    if (status) params = params.set('status', status);
    if (fromDate) params = params.set('from_date', fromDate);
    if (toDate) params = params.set('to_date', toDate);
    return this.http.get<any>(this.endpoint('list_pos_sale_notes'), { ...this.auth(), params }).pipe(
      map((response) => {
        const data: any = frappeData<any>(response);
        return Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
      })
    );
  }

  collect(name: string): Observable<any> {
    return this.action('collect_pos_sale_note', name);
  }

  invoice(name: string): Observable<any> {
    return this.action('invoice_pos_sale_note', name);
  }

  cancel(name: string): Observable<any> {
    return this.action('cancel_pos_sale_note', name);
  }

  downloadPdf(name: string): Observable<Blob> {
    let params = this.withBusinessParams(new HttpParams().set('name', name));
    params = params.set('format', 'FacturADA POS Sale Note');
    params = params.set('print_format', 'FacturADA POS Sale Note');
    return this.http.get(`${this.endpoint('download_pos_sale_note_pdf')}`, {
      ...this.auth(),
      params,
      responseType: 'blob'
    });
  }

  private action(method: string, name: string): Observable<any> {
    return this.http.post<any>(this.endpoint(method), this.withBusiness({ name }), this.auth()).pipe(
      map((response) => this.unwrap(response))
    );
  }

  private endpoint(method: string): string {
    return `${this.api}${API_ENDPOINT.FacturadaLitePosSale}.${method}`;
  }

  private unwrap(response: any): any {
    const data = frappeData<any>(response);
    const message = response?.message ?? response ?? {};
    return data && typeof data === 'object'
      ? { ...data, ...(message?.emission ? { emission: message.emission } : {}) }
      : data;
  }

  private auth(): { context: HttpContext; withCredentials: boolean } {
    return {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      withCredentials: true
    };
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

  private withBusiness(payload: any): any {
    const business = this.activeBusiness();
    return { ...(payload || {}), ...(business ? { business } : {}) };
  }

  private withBusinessParams(params: HttpParams): HttpParams {
    const business = this.activeBusiness();
    return business ? params.set('business', business) : params;
  }
}
