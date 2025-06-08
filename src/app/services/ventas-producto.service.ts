import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class VentasProductoService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  constructor(private http: HttpClient) { }


getReporteMasVendidos(filters: any): Observable<any> {
  const url = this.apiUrl + '/method/frappe.desk.query_report.run';

  const params = {
    report_name: 'Productos Más Vendidos',
    filters: JSON.stringify({
      ...filters
    })
  };

  return this.http.get(url, {
    params,
    withCredentials: true
  });
}


   descargarExcel(fromDate: string, toDate: string): Observable<Blob> {
    const params = new HttpParams()
      .set('report_name','Productos Más Vendidos')
      .set('filters', JSON.stringify({ from_date: fromDate, to_date: toDate }));

    return this.http.get('/api/method/frappe.desk.query_report.download_xlsx', {
      params,
      responseType: 'blob',
      withCredentials: true
    });
  }



}
