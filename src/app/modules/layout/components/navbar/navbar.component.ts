import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { Subscription } from 'rxjs';
import { MenuService } from '../../services/menu.service';
import { ProfileMenuComponent } from './profile-menu/profile-menu.component';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
  imports: [NgIf, NgFor, NgClass, RouterLink, AngularSvgIconModule, ProfileMenuComponent],
})
export class NavbarComponent implements OnInit, OnDestroy {
  currentTitle = 'Panel principal';
  now = new Date();
  private sub = new Subscription();
  private clockId: any = null;

  constructor(
    public menuService: MenuService,
    private router: Router,
    private capabilities: CompanyCapabilitiesService,
  ) {}

  ngOnInit(): void {
    this.refreshTitle();
    this.sub.add(
      this.router.events.subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.refreshTitle();
        }
      }),
    );
    this.clockId = setInterval(() => {
      this.now = new Date();
    }, 30000);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.clockId) {
      clearInterval(this.clockId);
    }
  }

  public toggleMobileMenu(): void {
    this.menuService.toggleMobileMenu();
  }

  public closePosMode(): void {
    this.router.navigateByUrl(this.capabilities.getPosExitRoute(this.readStoredRoles()));
  }

  get isPosMode(): boolean {
    return this.menuService.isPosMode;
  }

  get quickActions() {
    return this.menuService.quickActions;
  }

  get canOpenCaja(): boolean {
    const role = this.menuService.currentRole || this.readStoredRole();
    return this.capabilities.isEnabled('cash_register') && (role === 'GERENTE' || role === 'CAJERO');
  }

  get canOpenOrders(): boolean {
    return this.capabilities.isEnabled('orders');
  }

  get localizedDate(): string {
    const formatted = new Intl.DateTimeFormat('es-EC', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'America/Guayaquil',
    }).format(this.now);

    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  private refreshTitle(): void {
    this.currentTitle = this.menuService.resolveRouteLabel(this.router.url);
  }

  private readStoredRole(): string {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const firstRole = String(user?.roles?.[0] || '');
      return firstRole
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .trim();
    } catch {
      return '';
    }
  }

  private readStoredRoles(): string[] {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return Array.isArray(user?.roles) ? user.roles : [];
    } catch {
      return [];
    }
  }
}
