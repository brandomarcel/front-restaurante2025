// src/app/services/credit_note.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, throwError } from 'rxjs';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { toast } from 'ngx-sonner';

@Injectable({ providedIn: 'root' })
export class CreditNoteService {
  private readonly api = environment.apiUrl;

  constructor(private http: HttpClient, private err: FrappeErrorService) { }

  emit_credit_note_v2(invoice_name: string, motivo: string) {
    const url = `${this.api}/method/restaurante_app.facturacion_bmarc.einvoice.ui_new.emit_credit_note_v2`;

    return this.http.post<any>(
      url,
      { invoice_name, motivo },
      { withCredentials: true }
    ).pipe(
      catchError((e) => {
        const msg = this.err.handle(e) || 'Error al crear la nota de crédito.';
        // Propaga el error al suscriptor
        return throwError(() => msg);
      })
    );
  }


  getAllCreditNotes(limit: number = 10, offset: number = 0) {
    const params = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString());

    return this.http.get(
      `${this.api}/method/restaurante_app.facturacion_bmarc.einvoice.credit_note_api.get_all_credit_notes`,
      { withCredentials: true, params }
    );
  }


  getCreditNoteDetail(name: string) {
    const params = new HttpParams().set('name', name);
    return this.http.get(
      `${environment.apiUrl}/method/restaurante_app.facturacion_bmarc.einvoice.credit_note_api.get_credit_note_detail`,
      { withCredentials: true, params }
    );
  }


}
