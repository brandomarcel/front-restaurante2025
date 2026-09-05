// src/app/services/credit_note.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, EMPTY, Observable, of, throwError } from 'rxjs';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { toast } from 'ngx-sonner';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';

@Injectable({ providedIn: 'root' })
export class UtilsGlobalService {
  private readonly api = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private err: FrappeErrorService,
    private capabilities: CompanyCapabilitiesService
  ) {}

  getAllCreditNotes(limit: number = 10, offset: number = 0) {
    return throwError(() => 'Usa CreditNoteService.getAllCreditNotes para el contrato actual.');
}


  getMotivosAnulacion() {
    return of({ message: [
      'Error en datos del comprobante',
      'Devolución total de mercadería o servicio',
      'Devolución parcial de mercadería o servicio',
      'Cliente o identificación incorrecta',
      'Anulación por acuerdo comercial'
    ] });
  }


}
