import {
    HttpInterceptorFn,
    HttpErrorResponse,
    HttpClient
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { REQUIRE_AUTH } from './auth-context';

/**
 * Frappe usa HTTP 403 tanto para una sesión inválida como para una
 * denegación de permisos. Estos últimos no deben cerrar la sesión del usuario.
 */
function isPermissionDenied(error: HttpErrorResponse): boolean {
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

                // Un 403 de permisos es un error funcional del módulo. Se
                // propaga al componente para que muestre el mensaje del
                // backend, pero nunca se redirige al login.
                if (isPermissionDenied(err)) {
                    return throwError(() => err);
                }

                return http
                    .get('/api/method/frappe.auth.get_logged_user', {
                        withCredentials: true
                    })
                    .pipe(
                        // El ping solo sirve para comprobar que la sesión sigue viva.
                        // Si falla, no podemos distinguir un 403 de una sesión expirada.
                        // Convertimos ese fallo en una respuesta local para no capturar
                        // posteriormente el error original de permisos.
                        catchError(() => {
                            router.navigate(['/auth/sign-in'], {
                                queryParams: { reason: 'session-expired' }
                            });
                            return throwError(() => err);
                        }),
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
                        })
                    );
            }

            return throwError(() => err);
        })
    );
};
