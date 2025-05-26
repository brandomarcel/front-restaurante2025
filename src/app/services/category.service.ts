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
    return this.http.post(this.apiUrl, data);
  }

  update(id: number, data: any) {
    return this.http.patch(`${this.apiUrl}/${id}`, data);
  }

  delete(id: number) {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
