import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeData, frappeList } from '../core/utils/frappe-response';
export interface Customer {
  id: number;
  fullName: string;
  identification: string;
  identificationType: '04' | '05' | '06';
  email?: string;
  phone?: string;
}
@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  private urlBase: string = '';



  constructor(
    private http: HttpClient,
    private capabilities: CompanyCapabilitiesService
  ) {

    this.urlBase = this.apiUrl + API_ENDPOINT.Cliente;
  }

  // Obtener todos
  // findAll(): Observable<any[]> {
  //   return this.http.get<any[]>(this.apiUrl);
  // }

  // Buscar por ID
  findOne(id: number): Observable<any> {
    if (this.capabilities.isLiteMode) {
      return this.get_cliente_by_identificacion(String(id));
    }

    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }



  ////////////////////////////////////////////////////
  // Obtener todos  
  // getAll() {
  //   const campos = ["name","nombre","num_identificacion","telefono","correo","direccion","tipo_identificacion","isactive"];

  //   return this.http.get(`${this.apiUrl}/resource/Cliente?fields=${JSON.stringify(campos)}`, {
  //     context: new HttpContext().set(REQUIRE_AUTH, true)
  //   });
  // }


  getAll(isactive: number = 1) {
    let params = new HttpParams();

    if (isactive !== undefined && isactive !== null) {
      params = params.set('isactive', isactive.toString());
    }
    if (this.capabilities.isLiteMode) params = this.withLiteBusiness(params);

    const url = this.capabilities.isLiteMode
      ? `${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_clientes`
      : `${this.urlBase}.get_clientes`;

    const request$ = this.http.get(url, {
      params,
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
    return this.capabilities.isLiteMode
      ? request$.pipe(map((res: any) => frappeList<any>(res).map((item) => this.fromLiteCustomer(item))))
      : request$.pipe(map((res: any) => this.normalizeListResponse(res)));
  }

  searchClientes(search: string, limit = 10, isactive = 1): Observable<any[]> {
    let params = new HttpParams()
      .set('search', search.trim())
      .set('limit', String(limit));

    if (isactive !== undefined && isactive !== null) {
      params = params.set('isactive', String(isactive));
    }
    if (this.capabilities.isLiteMode) params = this.withLiteBusiness(params);

    const url = this.capabilities.isLiteMode
      ? `${this.apiUrl}${API_ENDPOINT.FacturadaLite}.search_clientes`
      : `${this.apiUrl}/method/restaurante_app.restaurante_bmarc.api.cliente.search_clientes`;

    return this.http.get<any>(url, {
      params,
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(
      map((res: any) => {
        return frappeList<any>(res).map((item) => this.fromLiteCustomer(item));
      })
    );
  }




  // Crear
  // create(data: Omit<any, 'id'>): Observable<any> {
  //   return this.http.post<any>(`${this.apiUrl}/resource/Cliente`, data);
  // }

  create(data: Omit<any, 'name'>): Observable<any> {
    const url = this.capabilities.isLiteMode
      ? `${this.apiUrl}${API_ENDPOINT.FacturadaLite}.create_cliente`
      : `${this.urlBase}.create_cliente`;

    const payload = this.capabilities.isLiteMode
      ? { ...this.toLiteCustomerPayload(data), business: this.capabilities.businessId || localStorage.getItem('businessId') || undefined }
      : data;
    return this.http.post<any>(url, payload, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(map((res: any) => this.capabilities.isLiteMode
      ? this.fromLiteCustomer(frappeData<any>(res))
      : this.normalizeSingleDataResponse(res)));
      }
  update(data: any) {
    const url = this.capabilities.isLiteMode
      ? `${this.apiUrl}${API_ENDPOINT.FacturadaLite}.update_cliente`
      : `${this.urlBase}.update_cliente`;

    if (this.capabilities.isLiteMode) {
      const payload = { ...this.toLiteCustomerPayload(data), business: this.capabilities.businessId || localStorage.getItem('businessId') || undefined };
      return this.http.post(url, payload, {
        context: new HttpContext().set(REQUIRE_AUTH, true)
      }).pipe(map((res: any) => this.fromLiteCustomer(frappeData<any>(res))));
    }

    return this.http.put(url, data, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }



  // update(name: string, data: any) {
  //   return this.http.put(`${this.apiUrl}/resource/Cliente/${name}`, data, {
  //     context: new HttpContext().set(REQUIRE_AUTH, true)
  //   });
  // }

  delete(name: string) {
    if (this.capabilities.isLiteMode) {
      let params = new HttpParams().set('name', name);
      params = this.withLiteBusiness(params);
      return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.delete_cliente`, {}, {
        params,
        context: new HttpContext().set(REQUIRE_AUTH, true)
      }).pipe(map((res: any) => frappeData<any>(res)));
    }

    return this.http.delete(`${this.apiUrl}/resource/Cliente/${name}`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }


  get_cliente_by_identificacion(identification: string): Observable<any> {
    if (this.capabilities.isLiteMode) {
      let params = new HttpParams().set('num_identificacion', String(identification || '').trim());
      params = this.withLiteBusiness(params);
      return this.http.get<any>(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_cliente_by_identificacion`, {
        params,
        context: new HttpContext().set(REQUIRE_AUTH, true)
      }).pipe(map((res: any) => {
        const data = frappeData<any>(res);
        return data ? this.fromLiteCustomer(data) : null;
      }));
    }

    const params = new HttpParams().set('num_identificacion', String(identification || '').trim());
    return this.http.get<any>(`${this.urlBase}.get_cliente_by_identificacion`, {
      params,
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(map((res: any) => this.normalizeSingleDataResponse(res)));
  }

  private normalizeListResponse(res: any): any {
    const data = res?.message?.data ?? res?.data ?? res?.message ?? [];
    return { ...res, message: { ...(typeof res?.message === 'object' && !Array.isArray(res.message) ? res.message : {}), data: Array.isArray(data) ? data.map((item: any) => this.fromLiteCustomer(item)) : [] } };
  }

  private normalizeSingleDataResponse(res: any): any {
    const data = res?.message?.data ?? res?.data ?? res?.message ?? null;
    const normalized = this.fromLiteCustomer(data);
    return {
      ...res,
      message: {
        ...(typeof res?.message === 'object' && !Array.isArray(res.message) ? res.message : {}),
        ...(normalized && typeof normalized === 'object' ? normalized : {}),
        data: normalized
      }
    };
  }

  private toLiteCustomerPayload(data: any): any {
    const payload = { ...(data || {}) };
    payload.tipo_identificacion = this.toLiteIdentificationType(payload.tipo_identificacion);
    if (payload.isactive !== undefined && payload.status === undefined) {
      payload.status = payload.isactive === true || payload.isactive === 1 || payload.isactive === '1' ? 'Activo' : 'Inactivo';
    }
    delete payload.isactive;
    return payload;
  }

  private fromLiteCustomer(customer: any): any {
    if (!customer || typeof customer !== 'object') return customer;
    const status = String(customer.status || '').toLowerCase();
    return {
      ...customer,
      tipo_identificacion: this.fromLiteIdentificationType(customer.tipo_identificacion),
      isactive: customer.isactive ?? (status ? status === 'activo' : true)
    };
  }

  private toLiteIdentificationType(value: any): string {
    const normalized = this.normalizeText(value);
    if (normalized.startsWith('04') || normalized.includes('RUC')) return 'RUC';
    if (normalized.startsWith('07') || normalized.includes('CONSUMIDOR')) return 'Consumidor Final';
    return 'Cedula';
  }

  private fromLiteIdentificationType(value: any): string {
    const normalized = this.normalizeText(value);
    if (normalized.startsWith('04') || normalized.includes('RUC')) return '04 - RUC';
    if (normalized.startsWith('07') || normalized.includes('CONSUMIDOR')) return '07 - Consumidor Final';
    return '05 - Cedula';
  }

  private normalizeText(value: any): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  private withLiteBusiness(params: HttpParams): HttpParams {
    const business = this.capabilities.businessId || localStorage.getItem('businessId');
    return business ? params.set('business', business) : params;
  }


}
