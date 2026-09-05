// src/app/services/credit_note.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, map, throwError } from 'rxjs';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';

@Injectable({ providedIn: 'root' })
export class CreditNoteService {
  private readonly api = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private err: FrappeErrorService,
    private capabilities: CompanyCapabilitiesService
  ) { }

  emit_credit_note_v2(invoice_name: string, motivo = '', additionalFields: any[] = []) {
    return this.createLiteCreditNote(invoice_name, motivo, additionalFields);
  }

  /** Crea y emite una nota de crédito Lite a partir de una factura autorizada. */
  createLiteCreditNote(invoiceName: string, motivo = '', additionalFields: any[] = []) {
    const url = `${this.api}/method/facturada_lite.api.frontend.create_lite_credit_note`;
    const payload: any = {
      invoice_name: invoiceName,
      additional_fields: Array.isArray(additionalFields) ? additionalFields : []
    };
    const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId');
    if (!business) return throwError(() => new Error('Selecciona un negocio para crear la nota de crédito.'));
    payload.business = business;
    // El contrato Lite permite omitirlo, pero el frontend envía explícitamente
    // el motivo predeterminado para mantener el payload visible y consistente.
    payload.motivo = String(motivo || '').trim() || 'Devolucion de mercaderia o servicio';

    return this.http.post<any>(
      url,
      payload,
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    ).pipe(
      catchError((e) => {
        const msg = this.err.handle(e) || 'Error al crear la nota de crédito.';
        return throwError(() => msg);
      })
    );
  }


  getAllCreditNotes(limit: number = 10, offset: number = 0, status?: string) {
      let params = new HttpParams()
        .set('limit', limit.toString())
        .set('offset', offset.toString());
      if (status) params = params.set('status', status);
      const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId');
      if (!business) return throwError(() => new Error('Selecciona un negocio para consultar las notas de crédito.'));
      params = params.set('business', business);
      return this.http.get<any>(
        `${this.api}/method/facturada_lite.api.frontend.get_all_credit_notes`,
        { context: new HttpContext().set(REQUIRE_AUTH, true), params }
      ).pipe(
        map((response: any) => {
          const message = response?.message ?? response ?? {};
          const rows = Array.isArray(message?.data) ? message.data : [];
          // Este endpoint ya devuelve únicamente notas de crédito. No se
          // infiere el tipo por el nombre interno del documento.
          const creditNotes = rows.map((item: any) => ({
            ...item,
            name: item?.name ?? item?.invoice_name,
            posting_date: item?.posting_date ?? item?.issue_date ?? item?.fecha_emision,
            total: Number(item?.total ?? item?.grand_total ?? 0) || 0,
            grand_total: Number(item?.grand_total ?? item?.total ?? 0) || 0,
            type: item?.type ?? item?.document_type ?? item?.tipo ?? 'Nota de Credito',
            document_type: item?.document_type ?? 'Nota de Credito',
            provider_status: item?.provider_status ?? item?.electronic?.provider_status,
            email_status: item?.email_status ?? item?.email?.status,
            invoice_modified: item?.invoice_modified ?? (item?.related_invoice ? { invoice_reference: item.related_invoice } : undefined),
            customer: item?.customer ?? {
              fullName: item?.customer_name,
              num_identificacion: item?.customer_identification_number
            },
            sri: {
              ...(item?.sri && typeof item.sri === 'object' ? item.sri : {}),
              status: item?.status ?? item?.sri?.status,
              provider_status: item?.provider_status ?? item?.electronic?.provider_status ?? item?.sri?.provider_status,
              number: item?.sequential_number ?? item?.number ?? item?.sri?.number,
              invoice: item?.name ?? item?.invoice_name,
              access_key: item?.access_key ?? item?.sri?.access_key
            }
          }));
          return {
            message: {
              ...message,
              data: creditNotes,
              total: Number(message?.total ?? message?.total_count ?? message?.count ?? response?.total ?? creditNotes.length)
            }
          };
        })
      );
  }


  getCreditNoteDetail(name: string) {
      let params = new HttpParams().set('invoice_name', name);
      const business = this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId');
      if (!business) return throwError(() => new Error('Selecciona un negocio para consultar la nota de crédito.'));
      params = params.set('business', business);
      return this.http.get(
        `${this.api}/method/facturada_lite.api.frontend.get_lite_invoice_detail`,
        { context: new HttpContext().set(REQUIRE_AUTH, true), params }
      );
  }


}
