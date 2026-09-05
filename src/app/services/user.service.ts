import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { RoleKey, UserItem } from '../core/models/user_item';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';

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

  private urlBase: string = '';
  constructor(private http: HttpClient) {
    this.urlBase = this.apiUrl + API_ENDPOINT.Register;
  }

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

    return new Observable<any>((subscriber) => {
      subscriber.error(new Error('El contrato actual no expone aún la gestión de usuarios de restaurante.'));
    });
  }


  /** Crear/actualizar usuario en la company de la sesión */
  upsert(payload: {
    email: string;
    password: string; // requerido al crear; al editar si no cambia usar placeholder
    first_name?: string;
    last_name?: string;
    phone?: string;
    role_key: RoleKey;
  }) {
    const body = {
      user_json: JSON.stringify({
        email: payload.email,
        password: payload.password,
        first_name: payload.first_name,
        last_name: payload.last_name,
        phone: payload.phone,
      }),
      role_key: payload.role_key,
      // company / company_ruc ya no se envían
      add_permission: 1,
      send_welcome_email: 0,
    };
    return this.http.post<any>(`${this.urlBase}.create_company_user`, body);
  }
  /** Habilitar/Deshabilitar (recomendado en vez de borrar) */
  setEnabled(email: string, enabled: boolean) {
    const url = `${this.urlBase}.create_company_user`;

    return this.http.put<any>(url, {
      user_json: JSON.stringify({ email, enabled: enabled ? 1 : 0 }),
      role_key: 'cajero', // o el rol que ya tenía; para fast_path da igual
      add_permission: 0
    },
      { context: new HttpContext().set(REQUIRE_AUTH, true) }
    );
  }

  // setEnabled(email: string, enabled: boolean) {
  //   const url = `${this.apiUrl}/resource/User/${encodeURIComponent(email)}`;

  //   return this.http.put<any>( url, { enabled: enabled ? 1 : 0 },
  //     { context: new HttpContext().set(REQUIRE_AUTH, true) } 
  //   );
  // }

  /** Borrado duro (no recomendado en Frappe para User). */
  delete(email: string) {
    return this.http.delete<any>(`/api/resource/User/${encodeURIComponent(email)}`);
  }

  private profileToRoleKey(profile?: string): RoleKey | undefined {
    if (!profile) return undefined;
    const p = profile.toUpperCase().trim();
    if (p === 'ADMIN COMPANY') return 'gerente';
    if (p === 'CAJERO COMPANY') return 'cajero';
    if (p === 'MESERO COMPANY') return 'mesero';
    return undefined;
  }


  /** Lista usuarios de la company del usuario en sesión */
  listByCompany(args?: { enabled?: boolean; search?: string; limit?: number; start?: number }): Observable<UserItem[]> {
    const body: any = {
      company: null,          // ← backend tomará la company por sesión
      company_ruc: null,      // ← idem
      enabled: typeof args?.enabled === 'boolean' ? (args.enabled ? 1 : 0) : null,
      search: args?.search ?? null,
      limit: args?.limit ?? 1000,
      start: args?.start ?? 0,
    };
    return this.http.post<any>(`${this.urlBase}.list_company_users`, body).pipe(
      map(res => (res.message.data || []) as UserItem[]),
      map(users => users.map(u => ({
        ...u,
        role_key: this.profileToRoleKey(u.role_profile_name)
      })))
    );
  }



}
