import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService, CompanyFeatureKey } from '../services/company-capabilities.service';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { CompanyService } from 'src/app/services/company.service';

@Injectable({
  providedIn: 'root'
})
export class RoleAccessGuard implements CanActivate {
  constructor(
    private router: Router,
    private capabilities: CompanyCapabilitiesService,
    private companyService: CompanyService
  ) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree | Observable<boolean | UrlTree> {
    if (!this.capabilities.isLoaded) {
      return this.companyService.get_empresa().pipe(
        map(response => {
          this.capabilities.setFromResponse(response);
          return this.evaluateAccess(route, state);
        }),
        catchError(() => {
          this.capabilities.useSafeFallback();
          return of(this.evaluateAccess(route, state));
        })
      );
    }
    return this.evaluateAccess(route, state);
  }

  private evaluateAccess(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    const deniedRoles = this.normalizeRoles(route.data?.['deniedRoles']);
    const allowedRoles = this.normalizeRoles(route.data?.['allowedRoles']);
    const currentRoles = this.readCurrentRoles();
    const featureKey = route.data?.['featureKey'] as CompanyFeatureKey | undefined;

    const featureAccess = this.capabilities.validateFeatureUse(featureKey);
    if (!featureAccess.allowed) {
      toast.error(featureAccess.message || 'Este módulo no está disponible para la empresa.');
      return this.redirectToAvailable(state.url, currentRoles, 'feature');
    }

    if (deniedRoles.length && currentRoles.some((role) => deniedRoles.includes(role))) {
      toast.error('No tienes permisos para ingresar a esta sección.');
      return this.redirectToAvailable(state.url, currentRoles, 'rol');
    }

    if (allowedRoles.length && !currentRoles.some((role) => allowedRoles.includes(role))) {
      toast.error('No tienes permisos para ingresar a esta sección.');
      return this.redirectToAvailable(state.url, currentRoles, 'rol');
    }

    return true;
  }

  private redirectToAvailable(fromUrl: string, roles: string[], reason: string): UrlTree {
    return this.router.createUrlTree([this.capabilities.getLandingRoute(roles)], {
      queryParams: { blocked: reason, from: fromUrl }
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
