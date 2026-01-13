import { HttpInterceptorFn, HttpErrorResponse, HttpContextToken, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, of, throwError } from 'rxjs';
import { REQUIRE_AUTH } from './auth-context';


export const frappeAuthInterceptor: HttpInterceptorFn = (req, next) => {
    const router = inject(Router);
    const http = inject(HttpClient);
    const requiresAuth = req.context.get(REQUIRE_AUTH);
    const req2 = req.url.includes('/api/')
        ? req.clone({ withCredentials: true })
        : req;
    return next(req2).pipe(
        catchError((err: HttpErrorResponse) => {

            console.log('frappeAuthInterceptor', err);
            console.log('requiresAuth', requiresAuth);
            if (!requiresAuth) return throwError(() => err);

            if (err.status === 401) {
                router.navigate(['/auth/sign-in'], { queryParams: { reason: 'session-expired' } });
                return throwError(() => err);
            }

            if (err.status === 403) {
                // Confirmar si estamos "Guest" (sesión muerta) o es permisos
                return http.get('/api/method/frappe.auth.get_logged_user').pipe(
                    switchMap((r: any) => {
                        console.log('Logged user check after 403:', r);
                        // si hay usuario, es permisos
                        // r.message suele ser el username
                        return throwError(() => err);
                    }),
                    catchError(() => {
                        // si este ping falla => sesión expirada / no logueado
                        router.navigate(['/auth/sign-in'], { queryParams: { reason: 'session-expired' } });
                        return throwError(() => err);
                    })
                );
            }

            return throwError(() => err);
        })
    );
};
