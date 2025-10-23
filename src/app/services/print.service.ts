import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
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

  getNotaVentaPdf(orderId: string) {
    const url = `/api/method/frappe.utils.print_format.download_pdf?doctype=orders&name=${orderId}&format=Nota%20de%20Venta&no_letterhead=1&letterhead=Sin%20Membrete&settings=%7B%7D&_lang=es-EC_lang`;
    return url;
  }

    getCreditNotePdf(factId: string) {
    const url = `/api/method/frappe.utils.print_format.download_pdf?doctype=Credit Note&name=${factId}&trigger_print=1&format=Credit Note&no_letterhead=1&letterhead=Sin%20Membrete&settings=%7B%7D&_lang=es-EC`;
    return url;
  }

  
}
