import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
@Injectable({ providedIn: 'root' })
export class PrintService {
  constructor(private http: HttpClient, private capabilities: CompanyCapabilitiesService) {}
    private baseUrl = environment.apiUrl;

  getOrderPdf(orderId: string) {
    return this.getComanda(orderId);
  }
  getRecibo(orderId: string) {
    // El contrato actual sólo provee el ticket de cocina para órdenes.
    return this.getComanda(orderId);
  }

  getComanda(orderId: string) {
    const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId') || '';
    const url = `/api/method/facturada_restaurante.api.frontend.download_kitchen_ticket?order_name=${encodeURIComponent(orderId)}${business ? `&business=${encodeURIComponent(business)}` : ''}`;
    return url;
  }

  getFacturaPdf(factId: string) {
    const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId') || '';
    return `/api/method/facturada_lite.api.frontend.download_lite_invoice_pdf?invoice_name=${encodeURIComponent(factId)}&format=FacturADA%20Lite%20RIDE&no_letterhead=1${business ? `&business=${encodeURIComponent(business)}` : ''}`;
  }

  /** Descarga el RIDE/ticket Lite generado por el backend como archivo. */
  downloadLiteInvoicePdf(
    invoiceName: string,
    format: 'FACTURADA RIDE' | 'FacturADA Lite Ticket' | 'Credit Note' = 'FACTURADA RIDE'
  ): Observable<Blob> {
    let params = new HttpParams()
      .set('invoice_name', invoiceName)
      .set('format', format)
      .set('print_format', format)
      .set('no_letterhead', '1');
    const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId');
    if (business) params = params.set('business', business);
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
    let params = new HttpParams()
      .set('invoice_name', invoiceName);
    const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId');
    if (business) params = params.set('business', business);
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
    return this.getComanda(orderId);
  }

    getCreditNotePdf(factId: string) {
    const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId') || '';
    return `/api/method/facturada_lite.api.frontend.download_lite_invoice_pdf?invoice_name=${encodeURIComponent(factId)}&format=Credit%20Note&no_letterhead=1${business ? `&business=${encodeURIComponent(business)}` : ''}`;
  }

  
}
