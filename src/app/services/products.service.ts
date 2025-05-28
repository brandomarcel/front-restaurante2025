import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getAll() {
    const campos = ['name', 'nombre', 'precio', 'descripcion', 'categoria', 'tax','isactive'];

    return this.http.get(`${environment.apiUrl}/resource/Producto?fields=${JSON.stringify(campos)}&limit_page_length=1000&order_by=categoria asc`, {
      withCredentials: true
    });
  }

  getById(id: number) {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
  }

  create(data: any) {
    return this.http.post(`${environment.apiUrl}/resource/Producto`, data, {
      withCredentials: true
    });
  }


update(name: string, data: any) {
  return this.http.put(`${environment.apiUrl}/resource/Producto/${name}`, data, {
    withCredentials: true
  });
}


delete(name: string) {
  return this.http.delete(`${environment.apiUrl}/resource/Producto/${name}`, {
    withCredentials: true
  });
}
}
