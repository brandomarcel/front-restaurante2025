import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, catchError, concatMap, filter, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeData } from '../core/utils/frappe-response';
import { ElectronicDocumentKind, electronicDocumentKindConfig } from '../core/utils/electronic-document-kinds';
import { FrappeSocketService } from './frappe-socket.service';

@Injectable({ providedIn: 'root' })
export class ElectronicDocumentUpdatesService {
  constructor(private http: HttpClient, private socket: FrappeSocketService,
    private capabilities: CompanyCapabilitiesService) {}

  /** `kind`: tipo de comprobante (el booleano antiguo sigue valiendo: `true` = guía, `false` = factura). */
  watch(name: string, business: string, kind: ElectronicDocumentKind | boolean): Observable<any> {
    const { doctype, detailMethod: method } = electronicDocumentKindConfig(kind);
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
