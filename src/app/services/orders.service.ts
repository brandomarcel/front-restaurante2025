import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private baseUrl = '/api/orders';

  constructor(private http: HttpClient) {}

  getAll() {
    return this.http.get<any[]>(this.baseUrl);
  }

  getById(id: number) {
    return this.http.get<any>(`${this.baseUrl}/${id}`);
  }

  create(order: any) {
    return this.http.post(this.baseUrl, order);
  }

  delete(id: number) {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  // Futuro: enviar orden para facturación
  invoice(id: number) {
    return this.http.post(`${this.baseUrl}/${id}/invoice`, {});
  }
}
