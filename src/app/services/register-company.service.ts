// register-company.service.ts
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';

@Injectable({ providedIn: 'root' })
export class RegisterCompanyService {
    private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  private urlBase: string = '';
  constructor(private http: HttpClient) {
    this.urlBase = this.apiUrl + API_ENDPOINT.Register;
  }

  registerTenantOpen(payload: {
    user: any;
    company: any;
    logo?: never;
    add_permission?: boolean;
  }) {
    const body: any = {
      user_json: JSON.stringify(payload.user),
      company_json: JSON.stringify(payload.company),
      add_permission: payload.add_permission ? 1 : 0,
    };
    // SIN headers especiales
    return this.http.post(
      `${this.urlBase}.register_tenant_open`,
      body
    );
  }

  uploadLiteLogo(business: string, file: File) {
    const formData = new FormData();
    formData.append('business', business);
    formData.append('file', file, file.name);
    return this.http.post(
      `${this.apiUrl}${API_ENDPOINT.FacturadaLiteSetup}.upload_lite_logo`,
      formData,
      { withCredentials: true, context: new HttpContext().set(REQUIRE_AUTH, true) }
    );
  }
}
