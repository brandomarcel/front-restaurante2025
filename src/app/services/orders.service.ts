import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, EMPTY, Observable, throwError } from 'rxjs';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { toast } from 'ngx-sonner';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  constructor(private http: HttpClient,
    private frappeErr: FrappeErrorService,
  ) { }

  getAll(limit: number = 10, offset: number = 0) {
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString());

    return this.http.get(`${environment.apiUrl}/method/restaurante_app.restaurante_bmarc.doctype.orders.orders.get_all_orders`, {
      withCredentials: true,
      params: params
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

  validar_y_generar_factura(docname: string) {
    return this.http.post(`${environment.apiUrl}/method/restaurante_app.restaurante_bmarc.doctype.orders.orders.validar_y_generar_factura`, {
      docname: docname,
      withCredentials: true
    });
  }

  // create(order: any) {
  //   return this.http.post(this.apiUrl, order);
  // }
create(order: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/resource/orders`, order).pipe(
      catchError((error) => {
        const msg = this.frappeErr.handle(error) || 'Error al crear la factura.';
        toast.error(msg);
        return EMPTY; // 👈 corta la cadena sin “romper” el flujo
      })
    );
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
