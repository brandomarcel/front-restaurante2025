// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { catchError, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { UserService } from './user.service';
import { Router } from '@angular/router';
import { FrappeSocketService } from './frappe-socket.service';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';

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
  private pendingLiteBusinesses: any[] = [];

  constructor(private http: HttpClient,
    private userService: UserService,
    private router: Router, // Agrega el Router aquí
    private socket: FrappeSocketService,
    private capabilities: CompanyCapabilitiesService
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
    `${this.apiUrl}/method/login`,
    body.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      observe: 'response'
    }
  ).pipe(
    tap((res) => {
      // Verifica rápido en devtools si se setea la cookie
      // console.log('Set-Cookie?', res.headers.get('set-cookie')); // algunos navegadores ocultan este header
      // Si el dominio es cruzado, revisa SameSite/Secure más abajo
    }),
    tap(() => localStorage.setItem('access_token', 'frappe-session')),
    switchMap(() => this.loadAuthenticatedContext()),
    tap(() => {
      if (!this.capabilities.isLiteMode) {
        this.socket.connect();
      }
    })
  );
}

  loadAuthenticatedContext(business?: string) {
    // Cuando se inicia sesión siempre se obtiene la lista actualizada. El
    // argumento solo se usa para cambios explícitos de negocio.
    if (business) return this.getLiteUserContext(business);

    // El listado es el primer paso del flujo Lite. Nunca se consulta el
    // contexto sin un negocio seleccionado.
    return this.getBusinesses().pipe(
      tap((businesses) => this.capabilities.setBusinesses(businesses)),
      switchMap((businesses) => {
        const persisted = localStorage.getItem('active_business') || localStorage.getItem('businessId') || '';
        const persistedBusiness = businesses.find((item: any) => String(item?.name || item?.business || '') === persisted);
        const defaultBusiness = businesses.length === 1
          ? businesses[0]
          : businesses.find((item: any) => item?.is_default === 1 || item?.is_default === true || item?.is_default === '1');
        const active = persistedBusiness || defaultBusiness;
        const activeId = String(active?.name || active?.business || '').trim();
        if (!activeId) {
          this.pendingLiteBusinesses = businesses;
          return throwError(() => new Error('__LITE_BUSINESS_SELECTION_REQUIRED__'));
        }
        this.pendingLiteBusinesses = [];
        this.capabilities.setActiveBusiness(active, businesses);
        return this.getLiteUserContext(activeId);
      })
    );
  }

  getLiteBusinesses(): Observable<any[]> {
    return this.http.get<any>(`${this.apiUrl}/method/facturada_lite.api.frontend.get_businesses`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(
      map((response: any) => {
        const data = response?.message?.data;
        return Array.isArray(data) ? data : [];
      }),
      catchError((error: any) => {
        if (error?.status === 403 && !this.isPermissionError(error)) {
          localStorage.removeItem('active_business');
          localStorage.removeItem('businessId');
          this.capabilities.clear();
        }
        return throwError(() => error);
      })
    );
  }

  getBusinesses(): Observable<any[]> {
    return this.getLiteBusinesses();
  }

  getPendingLiteBusinesses(): any[] {
    return this.pendingLiteBusinesses;
  }

  /** Cambia el negocio activo y recarga el contexto completo para ese negocio. */
  selectLiteBusiness(business: string): Observable<any> {
    const businessId = String(business || '').trim();
    if (!businessId) return throwError(() => new Error('__LITE_BUSINESS_SELECTION_REQUIRED__'));
    const selected = this.capabilities.businesses.find((item: any) =>
      String(item?.name || item?.business || '') === businessId
    );
    if (selected) this.capabilities.setActiveBusiness(selected);
    return this.getLiteUserContext(businessId);
  }

  getLoggedUser() {
    return this.http.get<any>(`${this.apiUrl}/method/frappe.auth.get_logged_user`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  getLiteUserContext(business?: string) {
    const selectedBusiness = business || this.capabilities.activeBusinessId || localStorage.getItem('active_business') || localStorage.getItem('businessId') || '';
    if (!selectedBusiness) {
      return throwError(() => new Error('__LITE_BUSINESS_SELECTION_REQUIRED__'));
    }
    const params = new HttpParams().set('business', selectedBusiness);
    return this.http.get<any>(`${this.apiUrl}/method/facturada_lite.api.frontend.get_user_context`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params
    }).pipe(
      tap(res => {
        if (!this.isLiteContext(res)) {
          throw new Error('__NOT_FACTURADA_LITE_CONTEXT__');
        }

        this.capabilities.setFromResponse(res);
        // get_user_context devuelve sus datos directamente en response.message
        // (a diferencia de los listados, que usan response.message.data).
        const message = res?.message && typeof res.message === 'object' ? res.message : {};
        const rawBusiness = message?.business;
        const business = rawBusiness && typeof rawBusiness === 'object'
          ? rawBusiness
          : (message?.company ?? message?.empresa ?? message?.data ?? {});
        const roles = this.readRolesFromContext(message);
        const userData = message?.user_data ?? message?.user ?? {};
        const userEmail = message?.user_email ?? message?.email ?? userData?.email ?? userData?.name ?? message?.user;

        const user = {
          email: userEmail,
          fullName: userData?.full_name || userData?.fullName || userData?.first_name || userEmail,
          roles,
          businessRole: message?.business_role ?? business?.business_role ?? null,
          permissions: message?.permissions ?? null,
          user_data: userData,
          businesses: Array.isArray(message?.businesses) ? message.businesses : [],
          activeBusiness: business,
          companyId: business?.company || null,
          businessId: business?.name || business?.business || (typeof rawBusiness === 'string' ? rawBusiness : null)
        };

        this.userService.setUser(user);
        localStorage.setItem('user', JSON.stringify(user));
        if (user.companyId) localStorage.setItem('companyId', user.companyId);
        if (user.businessId) localStorage.setItem('businessId', user.businessId);
      }),
      // La configuración Lite contiene ready/missing y es necesaria para
      // habilitar la emisión. Se carga al establecer el contexto, sin hacer
      // fallar el login si el endpoint de configuración no está disponible.
      switchMap((response: any) => {
        if (!this.capabilities.isLiteMode) return of(response);
        return this.http.get<any>(`${this.apiUrl}/method/facturada_lite.api.setup.get_lite_setup`, {
          context: new HttpContext().set(REQUIRE_AUTH, true),
          params
        }).pipe(
          tap((setupResponse: any) => {
            const setupData = setupResponse?.message?.data ?? setupResponse?.data ?? setupResponse?.message ?? setupResponse;
            this.capabilities.setLiteSetupState(setupData);
          }),
          map(() => response),
          // La lectura previa es auxiliar al contexto. Si el rol no puede
          // consultar setup, no se debe impedir el inicio de sesión; la
          // pantalla de configuración mostrará el 403 cuando se abra.
          catchError(() => of(response))
        );
      }),
      map((res: any) => res?.message ?? res),
      catchError((error: any) => {
        if (error?.status === 403 && !this.isPermissionError(error)) {
          localStorage.removeItem('active_business');
          localStorage.removeItem('businessId');
          this.capabilities.clear();
        }
        return throwError(() => error);
      })
    );
  }

  private readRolesFromContext(message: any): string[] {
    const rawRoles =
      message?.roles ??
      message?.user_roles ??
      message?.role ??
      message?.user?.roles ??
      message?.user_data?.roles ??
      [];

    const roles = Array.isArray(rawRoles) ? rawRoles : [rawRoles];
    const businessRole = message?.business_role;
    if (businessRole) roles.push(businessRole);
    const normalized = roles
      .map((role: any) => String(role || '').trim().toUpperCase())
      .filter((role: string) => !!role);

    return normalized.length ? normalized : ['GERENTE'];
  }

  private isLiteContext(response: any): boolean {
    const message = response?.message && typeof response.message === 'object' ? response.message : response || {};
    const rawBusiness = message?.business;
    const company = rawBusiness && typeof rawBusiness === 'object'
      ? rawBusiness
      : (message?.company ?? message?.empresa ?? message?.data ?? message);
    const mode = String(
      message?.business_mode ??
      message?.businessMode ??
      message?.mode ??
      message?.app_mode ??
      company?.business_mode ??
      company?.businessMode ??
      company?.mode ??
      company?.app_mode ??
      ''
    ).toUpperCase();

    if (mode.includes('LITE')) return true;

    const features = message?.features ?? company?.features;
    if (!features || typeof features !== 'object') return false;

    return this.toBool(features.direct_invoice) &&
      this.toBool(features.orders) === false &&
      this.toBool(features.tables) === false &&
      this.toBool(features.kitchen) === false &&
      this.toBool(features.cash_register) === false;
  }

  private toBool(value: any): boolean {
    return value === true || value === 1 || String(value).trim() === '1' || String(value).toUpperCase().trim() === 'TRUE';
  }

  private isPermissionError(error: any): boolean {
    const payload = error?.error;
    const raw = [
      typeof payload === 'string' ? payload : undefined,
      payload?.exc_type,
      payload?.exception,
      payload?.exc,
      payload?._server_messages,
      payload?.message
    ].filter(Boolean).join(' ');
    return /permissionerror|permission denied|not permitted|not allowed|rol del usuario no permite/i.test(raw);
  }


  logout() {
    return this.http.get(`${this.apiUrl}/method/logout`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(
      tap(() => {
        console.log('logout');
      this.userService.clearUser();
        this.capabilities.clear();
        localStorage.removeItem('user');
        localStorage.removeItem('businessId');
        localStorage.removeItem('active_business');
        localStorage.removeItem('access_token'); // si lo estás usando
        this.router.navigate(['/auth/sign-in']);
      })
    );
  }

  goLogin() {
    this.userService.clearUser();
        this.capabilities.clear();
        localStorage.removeItem('user');
        localStorage.removeItem('businessId');
        localStorage.removeItem('active_business');
        localStorage.removeItem('access_token'); // si lo estás usando
        this.router.navigate(['/auth/sign-in']);
  }



}
