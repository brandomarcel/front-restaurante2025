// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, switchMap, tap } from 'rxjs';
import { environment } from 'src/environments/environment';
import { UserService } from './user.service';
import { Router } from '@angular/router';
import { FrappeSocketService } from './frappe-socket.service';

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
  private apiUrl = environment.apiUrl; // Cambia si es tu entorno de producción

  constructor(private http: HttpClient,
    private userService: UserService,
    private router: Router, // Agrega el Router aquí
    private socket: FrappeSocketService
  ) { }


  // login(credentials: { email: string; password: string }): Observable<LoginResponse> {
  //   console.log('this.apiUrl', this.apiUrl);
  //   return this.http.post<LoginResponse>(`${this.apiUrl}/login`, credentials);
  // }

  // logout() {
  //   localStorage.removeItem('access_token');
  //   localStorage.removeItem('user');
  // }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('access_token');
  }

  getCurrentUser() {
    return JSON.parse(localStorage.getItem('user') || '{}');
  }

  /////////////////////////////////////////////////////////////

login(username: string, password: string) {
  const body = new URLSearchParams();
  body.set('usr', username);
  body.set('pwd', password);

  return this.http.post(
    `${this.apiUrl}/method/login`,   // 👈 OJO: incluye /api
    body.toString(),
    {
      withCredentials: true,             // 👈 imprescindible para cookie `sid`
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      observe: 'response'
    }
  ).pipe(
    tap((res) => {
      // Verifica rápido en devtools si se setea la cookie
      // console.log('Set-Cookie?', res.headers.get('set-cookie')); // algunos navegadores ocultan este header
      // Si el dominio es cruzado, revisa SameSite/Secure más abajo
      this.socket.connect();             // 👈 abrir WS SOLO después del login OK
    }),
    switchMap(() => this.getUserInfo())
  );
}


  getUserInfo() {
    return this.http.get<any>(`${this.apiUrl}/method/restaurante_app.restaurante_bmarc.api.user.get_user_roles_and_doctype_permissions`, {
      withCredentials: true
    }).pipe(
      tap(res => {
        console.log('getUserInfo', res);
        const user = {
          email: res.message.user,
          fullName: res.message.user_data.full_name,
          roles: res.message.roles,
          user_data: res.message.user_data,
          companyId: res.message.user_permissions[0]?.value || null
        };
        // Guardar en memoria
        this.userService.setUser(user);

        // Guardar en localStorage para persistencia
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('companyId', user.companyId);
      })
    );
  }


  logout() {
    return this.http.get(`${this.apiUrl}/method/logout`, {
      withCredentials: true
    }).pipe(
      tap(() => {
        console.log('logout');
        this.userService.clearUser();
        localStorage.removeItem('user');
        localStorage.removeItem('access_token'); // si lo estás usando
        this.router.navigate(['/auth/sign-in']);
      })
    );
  }

  goLogin() {
    this.userService.clearUser();
        localStorage.removeItem('user');
        localStorage.removeItem('access_token'); // si lo estás usando
        this.router.navigate(['/auth/sign-in']);
  }



}
