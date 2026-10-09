import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, catchError, concatMap, filter, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeData } from '../core/utils/frappe-response';
import { FrappeSocketService } from './frappe-socket.service';

@Injectable({ providedIn: 'root' })
export class ElectronicDocumentUpdatesService {
  constructor(private http: HttpClient, private socket: FrappeSocketService,
    private capabilities: CompanyCapabilitiesService) {}

  watch(name: string, business: string, guide: boolean): Observable<any> {
    const doctype = guide ? 'FacturADA Lite Remission Guide' : 'FacturADA Lite Invoice';
    const events = ['facturada_electronic_status_updated', 'facturada_electronic_review_required'];
    const notifications = new Observable<void>(subscriber => {
      this.socket.connect();
      const updated = (event: any) => {
        if (event?.doctype === doctype && event?.name === name && event?.business === business) {
          subscriber.next();
        }
      };
      for (const event of events) this.socket.on(event, updated);
      this.socket.subscribeDocument(doctype, name);
      // Read local state after reconnecting to recover events missed while offline.
      const connected = this.socket.connected$.subscribe(value => { if (value) subscriber.next(); });
      return () => {
        connected.unsubscribe();
        for (const event of events) this.socket.off(event, updated);
        this.socket.unsubscribeDocument(doctype, name);
      };
    });
    const method = guide ? 'get_lite_remission_guide_detail' : 'get_lite_invoice_detail';
    return notifications.pipe(
      filter(() => business === this.capabilities.activeBusinessId),
      // Serialize local reads so a second event cannot be lost during a request.
      concatMap(() => business !== this.capabilities.activeBusinessId ? EMPTY
        : this.http.get<any>(`${environment.apiUrl}/method/facturada_lite.api.frontend.${method}`, {
        params: new HttpParams().set('name', name).set('business', business),
        withCredentials: true, context: new HttpContext().set(REQUIRE_AUTH, true)
      }).pipe(map(response => frappeData<any>(response)), catchError(() => EMPTY))),
      filter(document => document?.name === name && business === this.capabilities.activeBusinessId
        && (typeof document?.business === 'object' ? document.business.name : document?.business) === business)
    );
  }
}
