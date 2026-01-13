import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';

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
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  create(data: any) {
    return this.http.post(`${environment.apiUrl}/resource/categorias`, data, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  getByName(name: string) {
    return this.http.get(`${environment.apiUrl}/resource/categorias/${name}`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  update(name: string, data: any) {
    return this.http.put(`${environment.apiUrl}/resource/categorias/${name}`, data, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  delete(name: string) {
    return this.http.delete(`${environment.apiUrl}/resource/categorias/${name}`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

}
