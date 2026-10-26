import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { toast } from 'ngx-sonner';
import { CajasService } from 'src/app/services/cajas.service';
import { CompanyCapabilitiesService } from '../services/company-capabilities.service';
import { CASH_OPERATOR_PERMISSIONS } from '../utils/cash-register';

@Injectable({
  providedIn: 'root'
})
export class CajaAbiertaGuard implements CanActivate {
  private cacheByUser: Record<string, { at: number; hasApertura: boolean }> = {};
  /** Usuarios ya avisados (modo informativo) para no repetir el aviso en cada navegación. */
  private advisedKeys = new Set<string>();

  constructor(
    private cajasService: CajasService,
    private router: Router,
    private capabilities: CompanyCapabilitiesService
  ) { }

  /**
   * Se llama justo después de abrir o cerrar una caja. Sin esto, un cajero
   * que intentó entrar al POS antes de abrir turno queda con un "no tiene
   * apertura" cacheado hasta 15s: abre la caja y la siguiente navegación
   * igual lo rebota, aunque ya sí puede vender. Limpiar todo el caché es
   * seguro (es solo un booleano de 15s por usuario) y evita ese hueco.
   */
  invalidateCache(): void {
    this.cacheByUser = {};
    this.advisedKeys.clear();
  }

  canActivate(_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> {
    // La apertura pertenece a POS (Restaurante o genérico). Si el negocio no
    // contrató caja (`cash_register`), la navegación de órdenes/POS no debe
    // bloquearse por una validación de apertura que no aplica.
    if (!this.capabilities.isEnabled('cash_register')
      || !CASH_OPERATOR_PERMISSIONS.some((permission) => this.capabilities.hasPermission(permission))) {
      return of(true);
    }
    const user = this.readCurrentUser();
    const mode = this.resolveMode(user);
    if (mode === 'none') {
      return of(true);
    }
    const mandatory = mode === 'required';

    const email = String(user?.email || '').trim();
    if (!email) {
      if (!mandatory) return of(true);
      toast.error('No se pudo validar la apertura de caja. Inicia sesión nuevamente.');
      return of(this.router.createUrlTree(['/dashboard/main']));
    }

    const business = this.capabilities.activeBusinessId || '';
    const cacheKey = `${business}:${email}`;
    const cached = this.cacheByUser[cacheKey];
    const now = Date.now();
    if (cached && now - cached.at < 15000) {
      return of(cached.hasApertura ? true : this.onMissingApertura(mandatory, cacheKey, state.url));
    }

    return this.cajasService.verificarAperturaActiva(email).pipe(
      map((resp: any) => {
        const hasApertura = Array.isArray(resp?.data) && resp.data.length > 0;
        this.cacheByUser[cacheKey] = { at: now, hasApertura };
        return hasApertura ? true : this.onMissingApertura(mandatory, cacheKey, state.url);
      }),
      catchError((error) => {
        console.error('Error al validar apertura de caja:', error);
        // El aviso informativo nunca debe impedir trabajar a Administrador/Gerente.
        if (!mandatory) return of(true);
        toast.error('No se pudo validar la apertura de caja.');
        return of(this.router.createUrlTree(['/dashboard/main']));
      })
    );
  }

  /**
   * Cajero (obligatorio): se redirige a Apertura. Administrador/Gerente
   * (informativo): se avisa una vez con un acceso a Apertura y se deja pasar.
   */
  private onMissingApertura(mandatory: boolean, cacheKey: string, fromUrl: string): boolean | UrlTree {
    if (mandatory) return this.redirectToMain(fromUrl);
    if (!this.advisedKeys.has(cacheKey)) {
      this.advisedKeys.add(cacheKey);
      toast.warning('No hay una caja abierta. Puedes continuar, pero conviene abrirla para registrar los cobros del turno.', {
        duration: 10000,
        action: { label: 'Abrir caja', onClick: () => { void this.router.navigate(['/caja/apertura']); } }
      });
    }
    return true;
  }

  private redirectToMain(fromUrl: string): UrlTree {
    // Un Cajero puede tener acceso al POS, pero no puede operar ventas hasta
    // abrir su turno. Llevarlo directamente a Apertura evita que parezca que
    // el acceso está roto o que perdió los módulos disponibles.
    toast.warning('Debes abrir caja para acceder a esta sección.');
    return this.router.createUrlTree(['/caja/apertura'], {
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

  /**
   * Cajero: apertura obligatoria. Administrador/Gerente: solo aviso. Mesero y
   * demás roles no manejan dinero y no se validan. El rol de negocio manda
   * sobre los roles Frappe, que en un administrador pueden incluir también Cajero.
   */
  private resolveMode(user: any): 'required' | 'advisory' | 'none' {
    const businessRole = this.readNormalizedRoles([this.capabilities.businessRole || ''])[0] || '';
    const isPrivileged = (role: string) => role.includes('administrador') || role.includes('gerente');
    if (businessRole) {
      if (isPrivileged(businessRole)) return 'advisory';
      return businessRole.includes('cajero') ? 'required' : 'none';
    }
    const roles = this.readNormalizedRoles(Array.isArray(user?.roles) ? user.roles : []);
    if (roles.some(isPrivileged)) return 'advisory';
    return roles.some((role) => role.includes('cajero')) ? 'required' : 'none';
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }
}
