import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { map } from 'rxjs';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeList } from '../core/utils/frappe-response';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  private urlBase: string = '';
  constructor(private http: HttpClient, private capabilities: CompanyCapabilitiesService) {
    this.urlBase = this.apiUrl + API_ENDPOINT.Payments;
  }
    getAll() {
      const url = this.capabilities.isLiteMode
        ? `${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_payments`
        : `${this.urlBase}.get_payments`;

      const business = this.capabilities.businessId || localStorage.getItem('businessId') || '';
      const params = this.capabilities.isLiteMode && business
        ? new HttpParams().set('business', business)
        : undefined;
      return this.http.get<any>(url, {
        params,
        context: new HttpContext().set(REQUIRE_AUTH, true)
      }
     ).pipe(
        map((res: any) => {
          return frappeList<any>(res).map((payment: any) => this.normalizePayment(payment));
        })
      );
    }

  private normalizePayment(payment: any): any {
    if (!payment || typeof payment !== 'object') return payment;
    const id = payment.name ?? payment.payment_method ?? payment.formas_de_pago ?? payment.codigo;
    return {
      ...payment,
      name: id,
      codigo: payment.codigo ?? payment.forma_pago ?? payment.sri_code ?? id,
      nombre: payment.nombre ?? payment.description ?? payment.label ?? id,
      description: payment.description ?? payment.nombre ?? payment.label ?? id
    };
  }

  // getById(id: number) {
  //   return this.http.get<any>(`${this.baseUrl}/${id}`);
  // }

  // create(data: any) {
  //   return this.http.post(this.baseUrl, data);
  // }

  // update(id: number, data: any) {
  //   return this.http.patch(`${this.baseUrl}/${id}`, data);
  // }

  // delete(id: number) {
  //   return this.http.delete(`${this.baseUrl}/${id}`);
  // }
}
