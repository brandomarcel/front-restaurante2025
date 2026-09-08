import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserItem } from '../core/models/user_item';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';

export interface FacturadaBusinessUser {
  name?: string;
  business?: string;
  user: string;
  email?: string;
  correo?: string;
  full_name?: string;
  user_full_name?: string;
  nombre_completo?: string;
  first_name?: string;
  nombre?: string;
  user_data?: { full_name?: string };
  business_role?: string;
  role?: string;
  role_name?: string;
  label?: string;
  status?: string;
  is_default?: boolean | number;
  enabled?: boolean | number;
  user_enabled?: boolean | number;
  permissions?: string[];
  permission_list?: string[];
  [key: string]: any;
}

export interface FacturadaBusinessRole {
  name?: string;
  business_role?: string;
  role?: string;
  role_name?: string;
  label?: string;
  permissions?: string[];
  permission_list?: string[];
  [key: string]: any;
}

export interface FrappeUserCandidate {
  user: string;
  full_name?: string;
  email?: string;
  enabled?: boolean | number;
  assignment?: FacturadaBusinessUser | null;
  [key: string]: any;
}

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

  constructor(private http: HttpClient) {}

  /** Gestión Lite de usuarios y asignaciones del negocio seleccionado. */
  getBusinessUsers(business: string, status?: string): Observable<FacturadaBusinessUser[]> {
    let params = new HttpParams().set('business', business);
    if (status) params = params.set('status', status);
    return this.http.get<any>(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_business_users`, {
      params,
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(map((response: any) => this.frappeDataList(response)));
  }

  searchFrappeUsers(business: string, txt: string, limit = 20): Observable<FrappeUserCandidate[]> {
    const params = new HttpParams()
      .set('business', business)
      .set('txt', txt)
      .set('limit', String(Math.min(Math.max(limit, 1), 20)));
    return this.http.get<any>(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.search_frappe_users`, {
      params,
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(map((response: any) => this.frappeDataList(response) as FrappeUserCandidate[]));
  }

  createFrappeUser(payload: {
    business: string;
    email: string;
    first_name: string;
    last_name: string;
    business_role: string;
    is_default: 0 | 1;
    new_password: string;
    send_welcome_email: 0 | 1;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.create_frappe_user`, payload, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  getBusinessRoles(): Observable<FacturadaBusinessRole[]> {
    return this.http.get<any>(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_business_roles`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(map((response: any) => this.frappeDataList(response)));
  }

  saveBusinessUser(payload: {
    business: string;
    user: string;
    business_role: string;
    status: 'Activo' | 'Inactivo';
    is_default: 0 | 1;
    name?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.save_business_user`, payload, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  deactivateBusinessUser(name: string, business: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.deactivate_business_user`, {
      name,
      business
    }, { context: new HttpContext().set(REQUIRE_AUTH, true) });
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

  /** Compatibilidad para reportes: devuelve asignaciones del negocio activo. */
  listByCompany(args?: { enabled?: boolean; search?: string; limit?: number; start?: number }): Observable<UserItem[]> {
    const business = String(localStorage.getItem('active_business') || localStorage.getItem('businessId') || '').trim();
    if (!business) return of([]);
    return this.getBusinessUsers(business).pipe(map((rows) => rows
      .filter((user) => args?.enabled === undefined || this.isActiveAssignment(user) === args.enabled)
      .filter((user) => {
        const search = String(args?.search || '').trim().toLowerCase();
        return !search || String(user.email || user.user || '').toLowerCase().includes(search)
          || String(user.full_name || user.user_data?.full_name || '').toLowerCase().includes(search);
      })
      .slice(args?.start || 0, (args?.start || 0) + (args?.limit || 1000))
      .map((user) => ({
        name: String(user.name || user.user || user.email || ''),
        email: String(user.email || user.user || ''),
        first_name: String(user.full_name || user.user_data?.full_name || ''),
        enabled: this.isActiveAssignment(user) ? 1 : 0,
        role_profile_name: String(user.business_role || '')
      } as UserItem))));
  }

  private frappeDataList(response: any): any[] {
    const data = response?.message?.data ?? response?.data ?? [];
    return Array.isArray(data) ? data : [];
  }

  private isActiveAssignment(user: FacturadaBusinessUser): boolean {
    const status = String(user.status || '').trim().toUpperCase();
    if (status) return status === 'ACTIVO';
    return user.enabled !== false && user.enabled !== 0;
  }



}
