import { Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';

@Injectable({ providedIn: 'root' })
export class ElectronicReviewService {
  constructor(private http: HttpClient) {}

  confirm(name: string, reason: string, business: string, guide: boolean, verified: boolean) {
    return this.call(guide ? 'confirm_lite_remission_guide_electronic_review' : 'confirm_lite_invoice_electronic_review', {
      business, [guide ? 'guide_name' : 'invoice_name']: name,
      review_reason: reason, ...(!guide && verified ? { verified_no_sri_record: 1 } : {})
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
