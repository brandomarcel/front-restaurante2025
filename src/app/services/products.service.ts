import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { map } from 'rxjs';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  private urlBase: string = '';
  constructor(private http: HttpClient) {
    this.urlBase = this.apiUrl + API_ENDPOINT.Producto;
  }

  // getAll() {
  //   const campos = ['name', 'nombre', 'precio', 'descripcion', 'categoria', 'tax','isactive','is_out_of_stock'];

  //   return this.http.get(`${environment.apiUrl}/resource/Producto?fields=${JSON.stringify(campos)}&limit_page_length=1000&order_by=categoria asc`, {
  //     
  //   });
  // }

  getAll(isactive?: number) {
      let params = new HttpParams();
  
      if (isactive !== undefined && isactive !== null) {
        params = params.set('isactive', isactive.toString());
      }
  
      return this.http.get(`${this.urlBase}.get_productos`, {
        context: new HttpContext().set(REQUIRE_AUTH, true),
        params,
        
      });
    }


  getById(id: number) {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  create(data: any) {
    return this.http.post(`${this.apiUrl}/resource/Producto`, data, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
    });
  }


  update(name: string, data: any) {
    return this.http.put(`${this.apiUrl}/resource/Producto/${name}`, data, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      
    });
  }


  delete(name: string) {
    return this.http.delete(`${this.apiUrl}/resource/Producto/${name}`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      
    });
  }
}
