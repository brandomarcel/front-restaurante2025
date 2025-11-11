import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { catchError, EMPTY, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { toast } from 'ngx-sonner';
import { FrappeErrorService } from '../core/services/frappe-error.service';
export interface Customer {
  id: number;
  fullName: string;
  identification: string;
  identificationType: '04' | '05' | '06';
  email?: string;
  phone?: string;
}
@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  private urlBase: string = '';



  constructor(private http: HttpClient,
    private frappeErr: FrappeErrorService
  ) {

    this.urlBase = this.apiUrl + API_ENDPOINT.Cliente;
  }

  // Obtener todos
  // findAll(): Observable<any[]> {
  //   return this.http.get<any[]>(this.apiUrl);
  // }

  // Buscar por ID
  findOne(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }



  ////////////////////////////////////////////////////
  // Obtener todos  
  // getAll() {
  //   const campos = ["name","nombre","num_identificacion","telefono","correo","direccion","tipo_identificacion","isactive"];

  //   return this.http.get(`${this.apiUrl}/resource/Cliente?fields=${JSON.stringify(campos)}`, {
  //     withCredentials: true
  //   });
  // }


getAll(isactive?: number) {
    let params = new HttpParams();

    if (isactive !== undefined && isactive !== null) {
      params = params.set('isactive', isactive.toString());
    }

    return this.http.get(`${this.urlBase}.get_clientes`, {
      params,
      withCredentials: true
    });
  }




  // Crear
  // create(data: Omit<any, 'id'>): Observable<any> {
  //   return this.http.post<any>(`${this.apiUrl}/resource/Cliente`, data);
  // }

  create(data: Omit<any, 'name'>): Observable<any> {
    return this.http.post<any>(`${this.urlBase}.create_cliente`, data, {
      withCredentials: true
    });
      }
  update(data: any) {
    return this.http.put(`${this.urlBase}.update_cliente`, data, {
      withCredentials: true
    });
  }



  // update(name: string, data: any) {
  //   return this.http.put(`${this.apiUrl}/resource/Cliente/${name}`, data, {
  //     withCredentials: true
  //   });
  // }

  delete(name: string) {
    return this.http.delete(`${this.apiUrl}/resource/Cliente/${name}`, {
      withCredentials: true
    });
  }


  get_cliente_by_identificacion(identification: string): Observable<any> {
    return this.http.get<any>(`${this.urlBase}.get_cliente_by_identificacion?num_identificacion=${identification}`);
  }


}