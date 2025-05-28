// company-info.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface CompanyInfo {
  id: number;
  businessName: string;
  ruc: string;
  address: string;
  phone: string;
  email: string;
  establishmentCode: string;
  emissionPoint: string;
}

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  constructor(private http: HttpClient) {}

 getAll() {
    return this.http.get(`${environment.apiUrl}/method/restaurante_app.restaurante_bmarc.api.user.get_empresa`, {
      withCredentials: true
    });
  }

  create(data: CompanyInfo): Observable<CompanyInfo> {
    return this.http.post<CompanyInfo>(this.apiUrl, data);
  }

  update(id: number, data: CompanyInfo): Observable<CompanyInfo> {
    console.log('id', id);
    console.log('data', data);
    return this.http.patch<CompanyInfo>(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
