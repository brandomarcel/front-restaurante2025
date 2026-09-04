import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { HttpContext } from '@angular/common/http';
import { REQUIRE_AUTH } from '../interceptor/auth-context';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private http: HttpClient, private router: Router) {}

  canActivate(): Observable<boolean> {
    return this.http.get('/api/method/frappe.auth.get_logged_user', {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(
      map(() => true),
      catchError(() => {
        this.router.navigate(['/auth/sign-in']);
        return of(false);
      })
    );
  }
}
