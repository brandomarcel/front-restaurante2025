import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
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

  private urlBase:string = '';
  


  constructor(private http: HttpClient) {

    this.urlBase = this.apiUrl + API_ENDPOINT.Cliente + 'get_clientes';
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
  getAll() {
    const campos = ["name","nombre","num_identificacion","telefono","correo","direccion","tipo_identificacion","isactive"];

    return this.http.get(`${this.apiUrl}/resource/Cliente?fields=${JSON.stringify(campos)}`, {
      withCredentials: true
    });
  }

    findByIdentification(identification: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/resource/Cliente/${identification}`);
  }

    // Crear
  create(data: Omit<any, 'id'>): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/resource/Cliente`, data);
  }
  update(name: string, data: any) {
  return this.http.put(`${this.apiUrl}/resource/Cliente/${name}`, data, {
    withCredentials: true
  });
}

delete(name: string) {
  return this.http.delete(`${this.apiUrl}/resource/Cliente/${name}`, {
    withCredentials: true
  });
}

}