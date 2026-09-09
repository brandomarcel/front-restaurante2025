// register-company.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class RegisterCompanyService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** Registro público inicial de FacturADA Business. No requiere sesión y no
   * acepta configuración de módulos, certificados ni infraestructura fiscal. */
  registerBusinessOpen(payload: {
    user: {
      email: string;
      password: string;
      first_name: string;
      last_name?: string;
      phone?: string;
    };
    business: {
      business_name: string;
      ruc: string;
      legal_name?: string;
      trade_name?: string;
      address?: string;
      phone?: string;
    };
  }) {
    return this.http.post(
      `${this.apiUrl}/method/facturada_core.api.onboarding.register_business_open`,
      payload
    );
  }

}
