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
        catchError((error) => {
          const message = error?.message === '__LITE_BUSINESS_SELECTION_REQUIRED__'
            ? 'Selecciona una empresa para continuar.'
            : error?.message === '__NOT_FACTURADA_LITE_CONTEXT__'
            ? 'La respuesta de contexto no corresponde a FacturADA Lite.'
            : 'No se pudo cargar el contexto de la empresa.';
          toast.error(message);
          return of(this.router.createUrlTree(['/dashboard/no-access'], {
            queryParams: { blocked: 'context', from: state.url }
          }));
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
    const liteBlocked = route.data?.['liteBlocked'] === true;
    const isAdmin = this.hasAdminRole(currentRoles);

    if (this.capabilities.isLiteMode && liteBlocked) {
      toast.error('Este módulo no está disponible en FacturADA Lite.');
      return this.redirectToAvailable(state.url, currentRoles, 'lite');
    }

    const featureAccess = this.capabilities.validateFeatureUse(featureKey);
    if (!featureAccess.allowed) {
      toast.error(featureAccess.message || 'Este módulo no está disponible para la empresa.');
      return this.redirectToAvailable(state.url, currentRoles, 'feature');
    }
    if (deniedRoles.length && currentRoles.some((role) => deniedRoles.includes(role))) {
      toast.error('No tienes permisos para ingresar a esta sección.');
      return this.redirectToAvailable(state.url, currentRoles, 'rol');
    }

    if (allowedRoles.length && !isAdmin && !currentRoles.some((role) => allowedRoles.includes(role))) {
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
    const roles: string[] = [];
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (Array.isArray(user?.roles)) {
        roles.push(...user.roles
          .map((role: string) => this.normalizeRole(String(role || '')))
          .filter((role: string) => !!role));
      }
    } catch {
      // El estado de empresa sigue siendo suficiente para resolver el acceso.
    }
    const businessRole = this.normalizeRole(String(this.capabilities.businessRole || ''));
    if (businessRole && !roles.includes(businessRole)) roles.push(businessRole);
    return roles;
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

  private hasAdminRole(roles: string[]): boolean {
    return roles.includes('SYSTEM MANAGER') || roles.includes('ADMINISTRATOR') || roles.includes('ADMINISTRADOR DEL NEGOCIO');
  }
}
