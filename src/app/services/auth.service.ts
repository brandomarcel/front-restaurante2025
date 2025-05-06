// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

interface LoginResponse {
  access_token: string;
  user: {
    id: number;
    email: string;
    nombre: string;
    // otros campos si los tienes
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl + 'auth'; // Cambia si es tu entorno de producción

  constructor(private http: HttpClient) {}


  login(credentials: { email: string; password: string }): Observable<LoginResponse> {
    console.log('this.apiUrl', this.apiUrl);
    return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials);
  }

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('access_token');
  }

  getCurrentUser() {
    return JSON.parse(localStorage.getItem('user') || '{}');
  }
}
