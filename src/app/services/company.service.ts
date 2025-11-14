// company.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';

export interface CompanyInfo {
  name?: string;                 // En Frappe suele ser string
  businessname?: string;
  ambiente?: 'PRUEBAS' | 'PRODUCCION';
  ruc?: string;
  address?: string;
  phone?: string;
  email?: string;
  establishmentcode?: string;
  emissionpoint?: string;
  invoiceseq_prod?: number;
  invoiceseq_pruebas?: number;

  ncseq_pruebas?: number;
  ncseq_prod?: number;
  logo?: string;                 // file_url en Frappe
  urlfirma?: string;   // file_url del .p12
  clave?: string;      // Password (Frappe lo cifra en el servidor)
}

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  private urlBase: string = '';
  constructor(private http: HttpClient) {
    this.urlBase = this.apiUrl + API_ENDPOINT.AnalyzeFirma;
  }

  getAll(fields: string[] = ['*']) {
    const params = new HttpParams().set('fields', JSON.stringify(fields)).set('limit_page_length', '0');
    return this.http.get(`${this.apiUrl}/resource/Company`, { params, withCredentials: true });
  }

  get_empresa() {
    return this.http.get(`${this.apiUrl}/method/restaurante_app.restaurante_bmarc.api.user.get_empresa`, { withCredentials: true });
  }

  getOne(name: string) {
    return this.http.get(`${this.apiUrl}/resource/Company/${encodeURIComponent(name)}`, { withCredentials: true });
  }

  create(data: CompanyInfo) {
    return this.http.post(`${this.apiUrl}/resource/Company`, data, { withCredentials: true });
  }

  update(id: string, data: Partial<CompanyInfo>) {
    return this.http.put(`${this.apiUrl}/resource/Company/${encodeURIComponent(id)}`, data, { withCredentials: true });
  }

  delete(id: string) {
    return this.http.delete(`${this.apiUrl}/resource/Company/${encodeURIComponent(id)}`, { withCredentials: true });
  }

  /** Sube y adjunta el logo al doc Company, y actualiza el campo 'logo' */
  uploadLogo(file: File, companyId: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('is_private', '0');            // 1 si quieres privado
    form.append('doctype', 'Company');
    form.append('docname', String(companyId)); // 🔴 obligatorio
    form.append('fieldname', 'logo');

    return this.http.post(`${this.apiUrl}/method/upload_file`, form, { withCredentials: true });
  }
  /** Sube y adjunta la FIRMA (.p12) al doc Company, y setea el campo 'urlfirma' */
  uploadFirma(file: File, companyId: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('is_private', '0');              // 👈 1 privado SIEMPRE
    form.append('doctype', 'Company');
    form.append('docname', String(companyId));
    form.append('fieldname', 'urlfirma');        // 👈 Frappe setea el valor del campo automáticamente

    // (Opcional) nombre forzado:
    // form.append('file_name', `firma_${companyId}.p12`);

    return this.http.post(`${this.apiUrl}/method/upload_file`, form, { withCredentials: true });
  }

  analyzeFirma(password: string, companyId?: string, company_ruc?: string, file_url?: string, save_to_company = 1) {
    const payload: any = { password, save_to_company };
    if (companyId) payload.company = companyId;
    if (company_ruc) payload.company_ruc = company_ruc;
    if (file_url) payload.file_url = file_url;

    // Ajusta el path al del método Python que te pasé
    return this.http.post(
      `${this.urlBase}.analyze_company_firma`,
      payload,
      { withCredentials: true }
    );
  }


}
