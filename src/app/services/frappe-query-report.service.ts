import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { environment } from 'src/environments/environment';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';

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
  private readonly exportUrl = `${environment.apiUrl}/method/frappe.desk.query_report.export_query`;

  constructor(
    private http: HttpClient,
    private frappeErr: FrappeErrorService,
    private capabilities: CompanyCapabilitiesService
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

  exportExcel(reportName: string, filters: Record<string, any>, visibleIdx: number[] = []): Observable<Blob> {
    const cleanFilters = this.cleanFilters(filters);
    const body = new FormData();

    body.append('report_name', reportName);
    body.append('file_format_type', 'Excel');
    body.append('filters', JSON.stringify(cleanFilters));
    body.append('applied_filters', JSON.stringify(cleanFilters));
    body.append('custom_columns', JSON.stringify([]));
    body.append('visible_idx', JSON.stringify(visibleIdx));
    body.append('include_indentation', '0');
    body.append('include_filters', '1');
    body.append('include_hidden_columns', '0');
    body.append('export_in_background', '0');

    return this.http.post(this.exportUrl, body, {
      responseType: 'blob',
      withCredentials: true,
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(
      catchError((error) => {
        const message = this.frappeErr.handle(error) || 'No se pudo exportar el reporte.';
        return throwError(() => new Error(message));
      })
    );
  }

  private cleanFilters(filters: Record<string, any>): Record<string, any> {
    const source = { ...(filters || {}) };
    delete source['company'];
    delete source['company_id'];
    if (!source['business']) {
      const business = this.capabilities.activeBusinessId
        || this.capabilities.businessId
        || localStorage.getItem('active_business')
        || localStorage.getItem('businessId')
        || '';
      if (business) source['business'] = business;
    }
    return Object.entries(source).reduce((acc, [key, value]) => {
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
