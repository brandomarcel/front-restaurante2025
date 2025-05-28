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
}
