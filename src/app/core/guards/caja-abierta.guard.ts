import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { toast } from 'ngx-sonner';
import { CajasService } from 'src/app/services/cajas.service';
import { CompanyCapabilitiesService } from '../services/company-capabilities.service';

@Injectable({
  providedIn: 'root'
})
export class CajaAbiertaGuard implements CanActivate {
  private cacheByUser: Record<string, { at: number; hasApertura: boolean }> = {};

  constructor(
    private cajasService: CajasService,
    private router: Router,
    private capabilities: CompanyCapabilitiesService
  ) { }

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    // La apertura pertenece a POS. Si el negocio tiene restaurante pero no
    // contrató caja, la navegación de órdenes/POS no debe bloquearse por una
    // validación de apertura que no aplica.
    if (!this.capabilities.isEnabled('cash_register')) {
      return of(true);
    }
    const user = this.readCurrentUser();
    const roles = this.readNormalizedRoles([
      ...(Array.isArray(user?.roles) ? user.roles : []),
      this.capabilities.businessRole || ''
    ]);

    if (!this.requiresCajaValidation(roles)) {
      return of(true);
    }

    const email = String(user?.email || '').trim();
    if (!email) {
      toast.error('No se pudo validar la apertura de caja. Inicia sesión nuevamente.');
      return of(this.router.createUrlTree(['/dashboard/main']));
    }

    const cached = this.cacheByUser[email];
    const now = Date.now();
    if (cached && now - cached.at < 15000) {
      return of(cached.hasApertura ? true : this.redirectToMain(state.url));
    }

    return this.cajasService.verificarAperturaActiva(email).pipe(
      map((resp: any) => {
        const hasApertura = Array.isArray(resp?.data) && resp.data.length > 0;
        this.cacheByUser[email] = { at: now, hasApertura };
        return hasApertura ? true : this.redirectToMain(state.url);
      }),
      catchError((error) => {
        console.error('Error al validar apertura de caja:', error);
        toast.error('No se pudo validar la apertura de caja.');
        return of(this.router.createUrlTree(['/dashboard/main']));
      })
    );
  }

  private redirectToMain(fromUrl: string): UrlTree {
    toast.warning('Debes abrir caja para acceder a esta sección.');
    return this.router.createUrlTree(['/dashboard/main'], {
      queryParams: { blocked: 'caja', from: fromUrl }
    });
  }

  private readCurrentUser(): any {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  }

  private readNormalizedRoles(roles: unknown): string[] {
    const values = Array.isArray(roles) ? roles : [];
    return values
      .map((role) => this.normalizeText(String(role || '')))
      .filter((role) => !!role);
  }

  private requiresCajaValidation(roles: string[]): boolean {
    // Solo roles operativos de caja requieren apertura obligatoria.
    return roles.some((role) => role.includes('cajero'));
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
