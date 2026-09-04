// taxes.service.ts

import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeList } from '../core/utils/frappe-response';

export interface CompanyInfo {
  name: number;
  businessname: string;
  ruc: string;
  address: string;
  phone: string;
  email: string;
  establishmentcode: string;
  emissionpoint: string;
}

@Injectable({ providedIn: 'root' })
export class TaxesService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  constructor(private http: HttpClient, private capabilities: CompanyCapabilitiesService) { }

  getAll() {
    const campos = ["name", "value"];

    if (this.capabilities.isLiteMode) {
      const business = this.capabilities.businessId || localStorage.getItem('businessId') || '';
      const params = business ? new HttpParams().set('business', business) : undefined;
      return this.http.get(`${environment.apiUrl}${API_ENDPOINT.FacturadaLite}.get_taxes`, {
        context: new HttpContext().set(REQUIRE_AUTH, true),
        params
      }).pipe(
        map((res: any) => {
          return { data: frappeList<any>(res).map((tax: any) => this.normalizeTax(tax)) };
        })
      );
    }

    return this.http.get(`${environment.apiUrl}/resource/taxes?fields=${JSON.stringify(campos)}`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  create(data: CompanyInfo): Observable<CompanyInfo> {
    return this.http.post<CompanyInfo>(this.apiUrl, data, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  update(id: number, data: CompanyInfo): Observable<CompanyInfo> {
    console.log('id', id);
    console.log('data', data);
    return this.http.patch<CompanyInfo>(`${this.apiUrl}/${id}`, data, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  private normalizeTax(tax: any): any {
    if (!tax || typeof tax !== 'object') return tax;
    const value = tax.value ?? tax.rate ?? tax.tax_rate ?? tax.iva ?? 0;
    return {
      ...tax,
      name: tax.name ?? tax.codigo ?? `IVA-${value}`,
      value
    };
  }
}
