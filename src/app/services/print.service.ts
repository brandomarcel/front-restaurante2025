import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
@Injectable({ providedIn: 'root' })
export class PrintService {
  constructor(private http: HttpClient) {}
    private baseUrl = environment.apiUrl;

  getOrderPdf(orderId: string) {
    const url = `/printview?doctype=orders&name=${orderId}&trigger_print=1&format=Nota%20y%20Comanda&no_letterhead=1&letterhead=Sin%20Membrete&settings=%7B%7D&_lang=es-EC`;
    return url;
  }
  getRecibo(orderId: string) {
    const url = `/printview?doctype=orders&name=${orderId}&trigger_print=1&format=Nota%20de%20Venta&no_letterhead=1&letterhead=Sin%20Membrete&settings=%7B%7D&_lang=es-EC`;
    return url;
  }

  getComanda(orderId: string) {
    const url = `/printview?doctype=orders&name=${orderId}&trigger_print=1&format=Comanda&no_letterhead=1&letterhead=Sin%20Membrete&settings=%7B%7D&_lang=es-EC`;
    return url;
  }

  getFacturaPdf(factId: string) {
    const url = `/api/method/frappe.utils.print_format.download_pdf?doctype=Sales Invoice&name=${factId}&trigger_print=1&format=Sales Invoice&no_letterhead=1&letterhead=Sin%20Membrete&settings=%7B%7D&_lang=es-EC`;
    return url;
  }

  /** Descarga el RIDE/ticket Lite generado por el backend como archivo. */
  downloadLiteInvoicePdf(
    invoiceName: string,
    format: 'FACTURADA RIDE' | 'FacturADA Lite Ticket' | 'Credit Note' = 'FACTURADA RIDE'
  ): Observable<Blob> {
    const params = new HttpParams()
      .set('invoice_name', invoiceName)
      .set('format', format)
      .set('print_format', format)
      .set('no_letterhead', '1');
    return this.http.get(
      `${this.baseUrl}/method/facturada_lite.api.frontend.download_lite_invoice_pdf`,
      {
        params,
        responseType: 'blob',
        withCredentials: true,
        context: new HttpContext().set(REQUIRE_AUTH, true)
      }
    );
  }

  /** Descarga el XML de una factura Lite como archivo privado. */
  downloadLiteInvoiceXml(invoiceName: string): Observable<Blob> {
    const params = new HttpParams()
      .set('invoice_name', invoiceName);
    return this.http.get(
      `${this.baseUrl}/method/facturada_lite.api.frontend.download_lite_invoice_xml`,
      {
        params,
        responseType: 'blob',
        withCredentials: true,
        context: new HttpContext().set(REQUIRE_AUTH, true)
      }
    );
  }

  getNotaVentaPdf(orderId: string) {
    const url = `/api/method/frappe.utils.print_format.download_pdf?doctype=orders&name=${orderId}&format=Nota%20de%20Venta&no_letterhead=1&letterhead=Sin%20Membrete&settings=%7B%7D&_lang=es-EC_lang`;
    return url;
  }

    getCreditNotePdf(factId: string) {
    const url = `/api/method/frappe.utils.print_format.download_pdf?doctype=Credit Note&name=${factId}&trigger_print=1&format=Credit Note&no_letterhead=1&letterhead=Sin%20Membrete&settings=%7B%7D&_lang=es-EC`;
    return url;
  }

  
}
