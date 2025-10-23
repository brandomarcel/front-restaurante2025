import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  private urlBase: string = '';
  constructor(private http: HttpClient) { 
        this.urlBase = this.apiUrl + API_ENDPOINT.Categoria;
  }


  getAll(isactive?: number) {
    let params = new HttpParams();

    if (isactive !== undefined && isactive !== null) {
      params = params.set('isactive', isactive.toString());
    }

    return this.http.get(`${this.urlBase}.get_categorias`, {
      params,
      withCredentials: true
    });
  }

  create(data: any) {
    return this.http.post(`${environment.apiUrl}/resource/categorias`, data, {
      withCredentials: true
    });
  }

  getByName(name: string) {
    return this.http.get(`${environment.apiUrl}/resource/categorias/${name}`, {
      withCredentials: true
    });
  }

  update(name: string, data: any) {
    return this.http.put(`${environment.apiUrl}/resource/categorias/${name}`, data, {
      withCredentials: true
    });
  }

  delete(name: string) {
    return this.http.delete(`${environment.apiUrl}/resource/categorias/${name}`, {
      withCredentials: true
    });
  }

}
