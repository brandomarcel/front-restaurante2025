import {
    HttpInterceptorFn,
    HttpErrorResponse,
    HttpClient
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
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

            if (!requiresAuth) {
                return throwError(() => err);
            }

            // 🔹 401 → sesión muerta seguro
            if (err.status === 401) {
                router.navigate(['/auth/sign-in'], {
                    queryParams: { reason: 'session-expired' }
                });
                return throwError(() => err);
            }

            // 🔹 403 → puede ser permisos o Guest
            if (err.status === 403) {

                return http
                    .get('/api/method/frappe.auth.get_logged_user', {
                        withCredentials: true
                    })
                    .pipe(
                        switchMap((r: any) => {

                            const user = r?.message;

                            // 🔥 Si es Guest → sesión expirada
                            if (!user || user === 'Guest') {
                                router.navigate(['/auth/sign-in'], {
                                    queryParams: { reason: 'session-expired' }
                                });
                            }

                            // Si hay usuario real → es error de permisos
                            return throwError(() => err);
                        }),
                        catchError(() => {
                            // Si el ping falla completamente → sesión expirada
                            router.navigate(['/auth/sign-in'], {
                                queryParams: { reason: 'session-expired' }
                            });
                            return throwError(() => err);
                        })
                    );
            }

            return throwError(() => err);
        })
    );
};
