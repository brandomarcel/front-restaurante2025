import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { toast } from 'ngx-sonner';

@Injectable({
  providedIn: 'root'
})
export class RoleAccessGuard implements CanActivate {
  constructor(private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    const deniedRoles = this.normalizeRoles(route.data?.['deniedRoles']);
    const allowedRoles = this.normalizeRoles(route.data?.['allowedRoles']);
    const currentRoles = this.readCurrentRoles();

    if (deniedRoles.length && currentRoles.some((role) => deniedRoles.includes(role))) {
      toast.error('No tienes permisos para ingresar a esta sección.');
      return this.redirectToMain(state.url);
    }

    if (allowedRoles.length && !currentRoles.some((role) => allowedRoles.includes(role))) {
      toast.error('No tienes permisos para ingresar a esta sección.');
      return this.redirectToMain(state.url);
    }

    return true;
  }

  private redirectToMain(fromUrl: string): UrlTree {
    return this.router.createUrlTree(['/dashboard/main'], {
      queryParams: { blocked: 'rol', from: fromUrl }
    });
  }

  private readCurrentRoles(): string[] {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!Array.isArray(user?.roles)) {
        return [];
      }
      return user.roles
        .map((role: string) => this.normalizeRole(String(role || '')))
        .filter((role: string) => !!role);
    } catch {
      return [];
    }
  }

  private normalizeRoles(input: unknown): string[] {
    if (!Array.isArray(input)) {
      return [];
    }
    return input.map((role) => this.normalizeRole(String(role || ''))).filter((role) => !!role);
  }

  private normalizeRole(role: string): string {
    return String(role || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }
}
