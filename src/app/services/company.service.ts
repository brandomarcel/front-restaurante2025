// company.service.ts
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, EMPTY, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { toast } from 'ngx-sonner';

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
  constructor(private http: HttpClient,
    private frappeErr: FrappeErrorService,
  ) {
    this.urlBase = this.apiUrl + API_ENDPOINT.AnalyzeFirma;
  }

  getAll(fields: string[] = ['*']) {
    const params = new HttpParams().set('fields', JSON.stringify(fields)).set('limit_page_length', '0');
    return this.http.get(`${this.apiUrl}/resource/Company`, { params, context: new HttpContext().set(REQUIRE_AUTH, true) });
  }

  get_empresa() {
    return this.http.get(`${this.apiUrl}/method/restaurante_app.restaurante_bmarc.api.user.get_empresa`, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }

  getOne(name: string) {
    return this.http.get(`${this.apiUrl}/resource/Company/${encodeURIComponent(name)}`, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }

  create(data: CompanyInfo) {
    return this.http.post(`${this.apiUrl}/resource/Company`, data, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }

  update(id: string, data: Partial<CompanyInfo>) {
    return this.http.put(`${this.apiUrl}/resource/Company/${encodeURIComponent(id)}`, data, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }

  delete(id: string) {
    return this.http.delete(`${this.apiUrl}/resource/Company/${encodeURIComponent(id)}`, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }

  /** Sube y adjunta el logo al doc Company, y actualiza el campo 'logo' */
  uploadLogo(file: File, companyId: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('is_private', '0');            // 1 si quieres privado
    form.append('doctype', 'Company');
    form.append('docname', String(companyId)); // 🔴 obligatorio
    form.append('fieldname', 'logo');

    return this.http.post(`${this.apiUrl}/method/upload_file`, form, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }
  /** Sube y adjunta la FIRMA (.p12) al doc Company, y setea el campo 'urlfirma' */
  uploadFirma(file: File, companyId: string) {
    const form = new FormData();
    form.append('file', file);
    form.append('is_private', '0');
    form.append('doctype', 'Company');
    form.append('docname', String(companyId));
    form.append('fieldname', 'urlfirma');
    // Fuerza nombre único para evitar caché/reuso por nombre en cargas consecutivas.
    form.append('file_name', `firma_${companyId}_${Date.now()}.p12`);

    return this.http.post(`${this.apiUrl}/method/upload_file`, form, { context: new HttpContext().set(REQUIRE_AUTH, true) });
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
      { context: new HttpContext().set(REQUIRE_AUTH, true) }).pipe(
            catchError((error) => {
              const msg = this.frappeErr.handle(error) || 'Error al crear la orden.';
              toast.error(msg);
              return EMPTY;
            })
          );
        
  }


}
