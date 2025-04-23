import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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
  private readonly apiUrl = 'http://localhost:3000/customers'; // Cambia si usás otro backend

  constructor(private http: HttpClient) {}

  // Obtener todos
  findAll(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  // Buscar por ID
  findOne(id: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/${id}`);
  }

  // Buscar por identificación
  findByIdentification(identification: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/identification/${identification}`);
  }

  // Crear
  create(data: Omit<any, 'id'>): Observable<any> {
    return this.http.post<any>(this.apiUrl, data);
  }

  // Actualizar
  update(id: number, data: Partial<any>): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${id}`, data);
  }

  // Eliminar
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}