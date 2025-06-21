import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getAll() {
    const campos = ['name', 'nombre','description', 'codigo'];

    return this.http.get(`${environment.apiUrl}/resource/payments?fields=${JSON.stringify(campos)}`, {
      withCredentials: true
    });
  }

  getById(id: number) {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
  }

  create(data: any) {
    return this.http.post(this.baseUrl, data);
  }

  update(id: number, data: any) {
    return this.http.patch(`${this.baseUrl}/${id}`, data);
  }

  delete(id: number) {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
