import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../environments/environment';

interface User {
  email: string;
  fullName: string;
  roles: string[];
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private userSubject = new BehaviorSubject<User | null>(null);
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  constructor(private http: HttpClient) { }

  setUser(user: User) {
    this.userSubject.next(user);
  }

  clearUser() {
    this.userSubject.next(null);
  }

  getUser(): User | null {
    return this.userSubject.value;
  }

  getUserObservable(): Observable<User | null> {
    return this.userSubject.asObservable();
  }

  hasRole(role: string): boolean {
    return this.getUser()?.roles.includes(role) || false;
  }


  /** 👥 Obtener lista de usuarios (opcionalmente solo activos o por rol) */


/** 👥 Obtener usuarios con sus roles (opcionalmente filtrado) */
getUsuariosConRoles(usuario?: string, rol?: string) {
  const params: any = {};
  if (usuario) params.usuario = usuario;
  if (rol) params.rol = rol;

  const query = new URLSearchParams(params).toString();
  const url = `${this.apiUrl}/method/restaurante_app.restaurante_bmarc.doctype.apis.utils.get_usuarios_con_roles${query ? '?' + query : ''}`;
  
  return this.http.get<any>(url, { withCredentials: true });
}




}
