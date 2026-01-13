import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { map } from 'rxjs';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  private urlBase: string = '';
  constructor(private http: HttpClient) {
    this.urlBase = this.apiUrl + API_ENDPOINT.Payments;
  }
    getAll() {
      return this.http.get<any>(`${this.urlBase}.get_payments`, {
        context: new HttpContext().set(REQUIRE_AUTH, true)
      }
     ).pipe(
        map((res: any) => res.message.data) // extrae solo el array
      );
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
