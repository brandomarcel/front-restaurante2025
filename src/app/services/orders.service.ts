import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  constructor(private http: HttpClient) {}

 getAll() {
    return this.http.get(`${environment.apiUrl}/method/restaurante_app.restaurante_bmarc.doctype.orders.orders.get_all_orders`, {
      withCredentials: true
    });
  }
   get_dashboard_metrics() {
    return this.http.get(`${environment.apiUrl}/method/restaurante_app.restaurante_bmarc.doctype.orders.orders.get_dashboard_metrics`, {
      withCredentials: true
    });
  }

  getById(id: number) {
   return this.http.get(`${environment.apiUrl}/method/restaurante_app.restaurante_bmarc.doctype.orders.orders.get_order_with_details?order_name${id}`, {
      withCredentials: true
    });
  }

  // create(order: any) {
  //   return this.http.post(this.apiUrl, order);
  // }
    create(order: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/resource/orders`, order);
  }

  delete(id: number) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }

  // Futuro: enviar orden para facturación
  invoice(id: number) {
    return this.http.post(`${this.apiUrl}/${id}/invoice`, {});
  }

  getFilteredOrders(filters: any): Observable<any> {
    const params = new HttpParams({ fromObject: filters });
    return this.http.get(`${this.apiUrl}/filter`, { params });
  }
}
