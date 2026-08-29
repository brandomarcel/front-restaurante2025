import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { environment } from 'src/environments/environment';

export interface FrappeReportColumn {
  label?: string;
  fieldname?: string;
  fieldtype?: string;
  options?: string;
  width?: number;
  [key: string]: any;
}

export interface FrappeQueryReportResponse {
  message?: {
    columns?: FrappeReportColumn[] | string[];
    result?: any[];
    [key: string]: any;
  };
  [key: string]: any;
}

@Injectable({ providedIn: 'root' })
export class FrappeQueryReportService {
  private readonly runUrl = `${environment.apiUrl}/method/frappe.desk.query_report.run`;

  constructor(
    private http: HttpClient,
    private frappeErr: FrappeErrorService
  ) {}

  run(reportName: string, filters: Record<string, any>): Observable<FrappeQueryReportResponse> {
    const query = [
      `report_name=${encodeURIComponent(reportName)}`,
      `filters=${encodeURIComponent(JSON.stringify(this.cleanFilters(filters)))}`,
      'ignore_prepared_report=false',
      'are_default_filters=false'
    ].join('&');

    return this.http.get<FrappeQueryReportResponse>(`${this.runUrl}?${query}`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(
      catchError((error) => {
        const message = this.frappeErr.handle(error) || 'No se pudo cargar el reporte.';
        return throwError(() => new Error(message));
      })
    );
  }

  private cleanFilters(filters: Record<string, any>): Record<string, any> {
    return Object.entries(filters || {}).reduce((acc, [key, value]) => {
      if (
        value !== null &&
        value !== undefined &&
        value !== '' &&
        !(typeof value === 'number' && Number.isNaN(value))
      ) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
  }
}
