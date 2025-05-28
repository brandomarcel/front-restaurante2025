import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getAll() {
    const campos = ['name', 'nombre', 'description', 'isactive'];

    return this.http.get(`${environment.apiUrl}/resource/categorias?fields=${JSON.stringify(campos)}`, {
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
