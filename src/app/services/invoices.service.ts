// src/app/services/invoices.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, EMPTY, Observable } from 'rxjs';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { toast } from 'ngx-sonner';

@Injectable({ providedIn: 'root' })
export class InvoicesService {
  private readonly api = environment.apiUrl;

  constructor(private http: HttpClient, private err: FrappeErrorService) {}

  create_and_emit_from_ui_v2(payload: any): Observable<any> {

  //  const  url =`${this.api}/method/restaurante_app.facturacion_bmarc.doctype.sales_invoice.sales_invoice.create_from_ui`;
  const  url =`${this.api}/method/restaurante_app.facturacion_bmarc.einvoice.ui_new.create_and_emit_from_ui_v2`;
    return this.http.post<any>(
      url,
      payload,
      { withCredentials: true }
    ).pipe(
      catchError((e) => {
        const msg = this.err.handle(e) || 'Error al crear la factura.';
        toast.error(msg);
        return EMPTY;
      })
    );
  }

  emit_existing_invoice_v2(invoice_name: string): Observable<any> {

  //  const  url =`${this.api}/method/restaurante_app.facturacion_bmarc.doctype.sales_invoice.sales_invoice.create_from_ui`;
  const  url =`${this.api}/method/restaurante_app.facturacion_bmarc.einvoice.ui_new.emit_existing_invoice_v2`;
    return this.http.post<any>(
      url,
      {invoice_name:invoice_name},
      { withCredentials: true }
    ).pipe(
      catchError((e) => {
        const msg = this.err.handle(e) || 'Error al crear la factura.';
        toast.error(msg);
        return EMPTY;
      })
    );
  }


  queue(invoice_name: string): Observable<any> {
    return this.http.post<any>(
      `${this.api}/method/restaurante_app.facturacion_bmarc.doctype.sales_invoice.sales_invoice.queue_einvoice`,
      { invoice_name },
      { withCredentials: true }
    );
  }

  getAllInvoices(limit: number = 10, offset: number = 0) {
  const params = new HttpParams()
    .set('limit', limit.toString())
    .set('offset', offset.toString());

  return this.http.get(
    `${this.api}/method/restaurante_app.facturacion_bmarc.einvoice.invoices_api.get_all_invoices`,
    { withCredentials: true, params }
  );
}

getOrderDetail(name: string) {
  const params = new HttpParams().set('name', name);
  return this.http.get(
    `${environment.apiUrl}/method/restaurante_app.facturacion_bmarc.einvoice.invoices_api.get_order_detail`,
    { withCredentials: true, params }
  );
}

  getInvoiceDetail(name: string) {
    const params = new HttpParams().set('name', name);
    return this.http.get(
      `${environment.apiUrl}/method/restaurante_app.facturacion_bmarc.einvoice.invoices_api.get_invoice_detail`,
      { withCredentials: true, params }
    );
  }


}
