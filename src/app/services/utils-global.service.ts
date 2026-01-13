// src/app/services/credit_note.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, EMPTY, Observable } from 'rxjs';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { toast } from 'ngx-sonner';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';

@Injectable({ providedIn: 'root' })
export class UtilsGlobalService {
  private readonly api = environment.apiUrl;

  constructor(private http: HttpClient, private err: FrappeErrorService) {}

  getAllCreditNotes(limit: number = 10, offset: number = 0) {
  const params = new HttpParams()
    .set('limit', limit.toString())
    .set('offset', offset.toString());

  return this.http.get(
    `${this.api}/method/restaurante_app.facturacion_bmarc.einvoice.credit_note_api.get_all_credit_notes`,
    { context: new HttpContext().set(REQUIRE_AUTH, true), params }
  );
}


  getMotivosAnulacion() {
    return this.http.get(
      `${environment.apiUrl}/method/restaurante_app.facturacion_bmarc.einvoice.utils.get_motivos_anulacion_list`
    );
  }


}
