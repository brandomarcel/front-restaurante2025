import { animate, state, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, DoCheck, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { ThemeService } from '../../../../../core/services/theme.service';
import { ClickOutsideDirective } from '../../../../../shared/directives/click-outside.directive';
import { AuthService } from 'src/app/services/auth.service';
import { Role } from 'src/app/core/models/menu.model';
import { UtilsService } from '../../../../../core/services/utils.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { AlertService } from '../../../../../core/services/alert.service';

interface ProfileItem {
  title: string;
  icon: string;
  link: string;
  allowedRoles?: Role[]; // si se omite, es visible para todos
  requiresBusinessInfrastructure?: boolean;
}

@Component({
  selector: 'app-profile-menu',
  templateUrl: './profile-menu.component.html',
  styleUrls: ['./profile-menu.component.css'],
  imports: [ClickOutsideDirective, CommonModule, FormsModule, RouterLink, AngularSvgIconModule],
  animations: [
    trigger('openClose', [
      state(
        'open',
        style({
          opacity: 1,
          transform: 'translateY(0)',
          visibility: 'visible',
        }),
      ),
      state(
        'closed',
        style({
          opacity: 0,
          transform: 'translateY(-20px)',
          visibility: 'hidden',
        }),
      ),
      transition('open => closed', [animate('0.2s')]),
      transition('closed => open', [animate('0.2s')]),
    ]),
  ],
  standalone: true,
})
export class ProfileMenuComponent implements OnInit, DoCheck {
  private utilsService = inject(UtilsService);

  ambiente$ = this.utilsService.ambiente$;

  public isOpen = false;

  // Ítems del menú de perfil (anotados con allowedRoles)
  public profileMenu: ProfileItem[] = [
    {
      title: 'Mi empresa',
      icon: './assets/icons/heroicons/outline/cog-6-tooth.svg',
      link: '/settings/lite',
      requiresBusinessInfrastructure: true,
    },
    // aquí puedes agregar más items y anotar allowedRoles según tu necesidad
  ];

  // Lista filtrada que realmente se muestra en el template
  public visibleProfileMenu: ProfileItem[] = [];

  public themeColors = [
    { name: 'base', code: '#e11d48' },
    { name: 'yellow', code: '#f59e0b' },
    { name: 'green', code: '#22c55e' },
    { name: 'blue', code: '#3b82f6' },
    { name: 'orange', code: '#ea580c' },
    { name: 'red', code: '#cc0022' },
    { name: 'violet', code: '#6d28d9' },
  ];
  public themeMode = ['light', 'dark'];
  public themeDirection = ['ltr', 'rtl'];

  public user: any = {};
  public roleUpper: Role | null = null;
  public changingBusiness = false;
  /** Valor propio del select: evita que el DOM vuelva al primer option. */
  public selectedBusinessId = '';
  public selectedTerminalId = '';

  constructor(
    public themeService: ThemeService,
    private authService: AuthService,
    public capabilities: CompanyCapabilitiesService,
    private alertService: AlertService
  ) {}

  ngOnInit(): void {
    this.user = JSON.parse(localStorage.getItem('user') || '{}');
    this.syncSelectedBusiness();

    // Normaliza el rol desde varias posibles propiedades
    const rawRole =
      this.user?.businessRole ??
      this.user?.business_role ??
      this.user?.roles?.find((role: string) => ['GERENTE', 'CAJERO', 'FACTURACION', 'FACTURADOR', 'MESERO', 'COCINA', 'USUARIO'].includes(String(role || '').trim().toUpperCase())) ??
      this.user?.role ??
      this.user?.rol ??
      this.user?.tipo ??
      '';

    const r = String(rawRole).trim().toUpperCase() === 'FACTURADOR' ? 'FACTURACION' : String(rawRole).trim().toUpperCase();
    this.roleUpper = r === 'GERENTE' || r === 'CAJERO' || r === 'FACTURACION' || r === 'MESERO' || r === 'COCINA' || r === 'USUARIO'
      ? (r as Role)
      : null;

    // Filtra los ítems del menú en base al rol
    this.visibleProfileMenu = this.profileMenu.filter(item =>
      (!item.allowedRoles || (this.roleUpper && item.allowedRoles.includes(this.roleUpper)))
      && (!item.requiresBusinessInfrastructure || this.capabilities.canManageBusinessInfrastructure)
    );

    // El combo siempre se llena desde el endpoint exclusivo de negocios, no
    // desde la lista resumida que puede venir en get_user_context.
    this.authService.getLiteBusinesses().subscribe({
      next: (businesses) => {
        this.capabilities.setBusinesses(businesses);
        this.syncSelectedBusiness();
      },
      // El menú no debe romperse si una recarga auxiliar falla: conserva el
      // catálogo que ya se cargó durante el inicio de sesión.
      error: () => undefined
    });
  }

  public toggleMenu(): void {
    this.isOpen = !this.isOpen;
  }

  public logout() {
    // cierra el menú y desloguea
    this.isOpen = false;
    this.authService.logout().subscribe();
  }

  ngDoCheck(): void {
    const terminal = this.capabilities.activePosTerminal;
    const next = String(terminal?.name || '').trim();
    if (next !== this.selectedTerminalId) this.selectedTerminalId = next;
  }

  get hasMultipleBusinesses(): boolean {
    return this.capabilities.businesses.length > 1;
  }

  get activeBusinessId(): string {
    return this.selectedBusinessId || this.capabilities.activeBusinessId || '';
  }

  get activeBusinessLabel(): string {
    const business = this.capabilities.businesses.find((item: any) =>
      String(item?.name || item?.business || '').trim() === this.activeBusinessId
    ) || this.capabilities.activeBusiness;
    return business?.business_name || business?.businessname || business?.name || 'Empresa activa';
  }

  get visiblePosTerminals(): any[] {
    const terminals = this.capabilities.posTerminals.filter((item: any) => String(item?.status || 'Activo').trim().toUpperCase() === 'ACTIVO');
    const selected = this.capabilities.activePosTerminal;
    if (selected && !terminals.some((item: any) => String(item?.name || '') === String(selected?.name || ''))) {
      return [selected, ...terminals];
    }
    return terminals;
  }

  terminalLabel(terminal: any): string {
    const name = String(terminal?.terminal_name || terminal?.name || 'Terminal');
    const establishment = String(terminal?.establishment_code || '').trim();
    const point = String(terminal?.emission_point_code || '').trim();
    const establishmentName = String(terminal?.establishment_name || '').trim();
    return `${name} · ${establishment || '—'}-${point || '—'} · ${establishmentName || 'Sin establecimiento'}`;
  }

  get terminalAccessMessage(): string {
    if (this.capabilities.terminalAccessRequired && !this.capabilities.hasTerminalAccess) {
      return 'No tiene un terminal POS activo asignado. Contacte al administrador.';
    }
    if (this.capabilities.requiresTerminalSelection && !this.capabilities.activePosTerminal) {
      return 'Seleccione un terminal POS para facturar.';
    }
    return '';
  }

  changeTerminal(value: string): void {
    const terminalId = String(value || '').trim();
    const terminal = this.visiblePosTerminals.find((item: any) => String(item?.name || '').trim() === terminalId);
    if (!terminalId || !terminal || !this.capabilities.setActivePosTerminal(terminal)) {
      this.selectedTerminalId = String(this.capabilities.activePosTerminal?.name || '').trim();
      return;
    }
    // Actualiza el modelo inmediatamente; la selección también queda
    // persistida por negocio en CompanyCapabilitiesService para sobrevivir a
    // cambios de contexto y navegación.
    this.selectedTerminalId = terminalId;
    this.isOpen = false;
  }

  changeBusiness(value: string): void {
    const business = String(value || '').trim();
    const persistedBusiness = String(localStorage.getItem('active_business') || localStorage.getItem('businessId') || '').trim();
    if (!business || business === persistedBusiness || this.changingBusiness) return;

    const previousBusiness = persistedBusiness || this.capabilities.activeBusinessId || '';
    // Reflejar la elección de inmediato y conservarla durante la carga del
    // contexto. El servicio volverá a validarla contra get_businesses.
    this.selectedBusinessId = business;
    localStorage.setItem('active_business', business);
    localStorage.setItem('businessId', business);
    this.changingBusiness = true;
    this.authService.selectLiteBusiness(business).subscribe({
      next: () => {
        // La recarga limpia los catálogos y métricas que pertenecían al
        // negocio anterior antes de inicializar las pantallas del nuevo.
        window.location.assign('/dashboard/main');
      },
      error: (error: any) => {
        this.changingBusiness = false;
        this.selectedBusinessId = previousBusiness;
        if (previousBusiness) {
          localStorage.setItem('active_business', previousBusiness);
          localStorage.setItem('businessId', previousBusiness);
        } else {
          localStorage.removeItem('active_business');
          localStorage.removeItem('businessId');
        }
        const previousRecord = this.capabilities.businesses.find((item: any) =>
          String(item?.name || item?.business || '').trim() === previousBusiness
        );
        if (previousRecord) this.capabilities.setActiveBusiness(previousRecord, this.capabilities.businesses);
        const status = Number(error?.status || error?.error?.status || 0);
        if (status === 403) {
          localStorage.removeItem('active_business');
          localStorage.removeItem('businessId');
          this.alertService.error('No tiene permisos para acceder a esta empresa.');
          return;
        }
        this.alertService.error('No se pudo cambiar la empresa.');
      }
    });
  }

  private syncSelectedBusiness(): void {
    const persisted = String(localStorage.getItem('active_business') || localStorage.getItem('businessId') || '').trim();
    const active = persisted || this.capabilities.activeBusinessId || '';
    this.selectedBusinessId = active;
  }

  toggleThemeMode() {
    this.themeService.theme.update((theme) => {
      const mode = !this.themeService.isDark ? 'dark' : 'light';
      return { ...theme, mode: mode };
    });
  }

  toggleThemeColor(color: string) {
    this.themeService.theme.update((theme) => {
      return { ...theme, color: color };
    });
  }

  setDirection(value: string) {
    this.themeService.theme.update((theme) => {
      return { ...theme, direction: value };
    });
  }

  get roleLabel(): string {
    if (this.roleUpper === 'GERENTE') return 'Gerente';
    if (this.roleUpper === 'CAJERO') return 'Cajero';
    if (this.roleUpper === 'FACTURACION') return 'Facturación';
    if (this.roleUpper === 'MESERO') return 'Mesero';
    if (this.roleUpper === 'COCINA') return 'Cocina';
    return 'Usuario';
  }

  get roleBadgeClass(): string {
    if (this.roleUpper === 'GERENTE') return 'bg-emerald-100 text-emerald-700';
    if (this.roleUpper === 'CAJERO') return 'bg-sky-100 text-sky-700';
    if (this.roleUpper === 'FACTURACION') return 'bg-blue-100 text-blue-700';
    if (this.roleUpper === 'MESERO') return 'bg-violet-100 text-violet-700';
    if (this.roleUpper === 'COCINA') return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-700';
  }
}
