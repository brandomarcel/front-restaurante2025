// company-info.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface CompanyInfo {
  name?: number;
  businessname?: string;
  ambiente?: string;
  ruc?: string;
  address?: string;
  phone?: string;
  email?: string;
  establishmentcode?: string;
  emissionpoint?: string;
  invoiceseq_prod?: number;
  invoiceseq_pruebas?: number;
}

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  constructor(private http: HttpClient) {}

 getAll() {
     const campos = ["*"];

    return this.http.get(`${this.apiUrl}/resource/Company?fields=${JSON.stringify(campos)}`, {
      withCredentials: true
    });
  }

  create(data: CompanyInfo): Observable<CompanyInfo> {
    return this.http.post<CompanyInfo>(this.apiUrl, data);
  }

  update(id: number, data: CompanyInfo): Observable<CompanyInfo> {
    console.log('id', id);
    console.log('data', data);
    return this.http.put<CompanyInfo>(`${this.apiUrl}/resource/Company/${id}`, data);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/resource/Company/${id}`);
  }
}
