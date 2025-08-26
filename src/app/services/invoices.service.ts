// src/app/services/invoices.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, EMPTY, Observable } from 'rxjs';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { toast } from 'ngx-sonner';

@Injectable({ providedIn: 'root' })
export class InvoicesService {
  private readonly api = environment.apiUrl;

  constructor(private http: HttpClient, private err: FrappeErrorService) {}

  createFromUI(payload: any): Observable<any> {
    return this.http.post<any>(
      `${this.api}/method/restaurante_app.facturacion_bmarc.doctype.sales_invoice.sales_invoice.create_from_ui`,
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

  queue(invoice_name: string): Observable<any> {
    return this.http.post<any>(
      `${this.api}/method/restaurante_app.facturacion_bmarc.doctype.sales_invoice.sales_invoice.queue_einvoice`,
      { invoice_name },
      { withCredentials: true }
    );
  }
}
