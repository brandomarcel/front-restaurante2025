// register-company.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';

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
    logo?: { filename: string; data: string; is_private?: 0|1 };
    add_permission?: boolean;
  }) {
    const body: any = {
      user_json: JSON.stringify(payload.user),
      company_json: JSON.stringify(payload.company),
      add_permission: payload.add_permission ? 1 : 0,
    };
    if (payload.logo) body.logo_json = JSON.stringify(payload.logo);

    // SIN headers especiales
    return this.http.post(
      `${this.urlBase}.register_tenant_open`,
      body
    );
  }
}
