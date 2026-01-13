// taxes.service.ts

import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';

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

  constructor(private http: HttpClient) { }

  getAll() {
    const campos = ["name", "value"];

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
}
