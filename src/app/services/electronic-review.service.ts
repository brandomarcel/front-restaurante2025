import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { ElectronicDocumentKind, electronicDocumentKindConfig } from '../core/utils/electronic-document-kinds';

@Injectable({ providedIn: 'root' })
export class ElectronicReviewService {
  constructor(private http: HttpClient) {}

  /** `kind`: tipo de comprobante (el booleano antiguo sigue valiendo: `true` = guía, `false` = factura). */
  confirm(name: string, reason: string, business: string, kind: ElectronicDocumentKind | boolean, verified: boolean) {
    const config = electronicDocumentKindConfig(kind);
    // La verificación de inexistencia en el SRI solo existe para facturas y notas de crédito.
    return this.call(config.reviewMethod, {
      business, [config.reviewNameParam]: name,
      review_reason: reason, ...(config.invoiceLike && verified ? { verified_no_sri_record: 1 } : {})
    });
  }

  regenerate(name: string, business: string) {
    return this.call('regenerate_lite_invoice_same_sequence', { invoice_name: name, business });
  }

  private call(method: string, payload: any) {
    return this.http.post<any>(`${environment.apiUrl}/method/facturada_lite.api.frontend.${method}`, payload,
      { withCredentials: true, context: new HttpContext().set(REQUIRE_AUTH, true) });
  }
}
