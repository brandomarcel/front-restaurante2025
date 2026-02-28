// services/menu.service.ts
import { Injectable, OnDestroy, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Menu } from 'src/app/core/constants/menu';
import { MenuItem, SubMenuItem, Role } from 'src/app/core/models/menu.model';

@Injectable({ providedIn: 'root' })
export class MenuService implements OnDestroy {
  private _showSidebar = signal(this.defaultSidebarState());
  private _showMobileMenu = signal(false);
  private _pagesMenu = signal<MenuItem[]>([]);
  private _quickActions = signal<SubMenuItem[]>([]);
  private _isPosMode = signal(false);
  private _currentRole = signal('');
  private _sidebarBeforePos: boolean | null = null;
  private _subscription = new Subscription();

  constructor(private router: Router) {
    this._pagesMenu.set([]);
    this.syncLayoutByRoute(this.router.url);

    const sub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.syncLayoutByRoute(event.urlAfterRedirects || event.url);
        this.applyActiveState();
        this.closeMobileMenu();
      }
    });
    this._subscription.add(sub);
  }

  get showSideBar()      { return this._showSidebar(); }
  get showMobileMenu()   { return this._showMobileMenu(); }
  get pagesMenu()        { return this._pagesMenu(); }
  get quickActions()     { return this._quickActions(); }
  get isPosMode()        { return this._isPosMode(); }
  get currentRole()      { return this._currentRole(); }
  set showSideBar(v: boolean)    { this._showSidebar.set(v); }
  set showMobileMenu(v: boolean) { this._showMobileMenu.set(v); }

  public toggleSidebar() { this._showSidebar.set(!this._showSidebar()); }
  public toggleMenu(menu: SubMenuItem) {
    if (!menu.children?.length) return;
    menu.expanded = !menu.expanded;
  }
  public toggleSubMenu(submenu: SubMenuItem) {
    if (!submenu.children?.length) return;
    submenu.expanded = !submenu.expanded;
  }
  public openMobileMenu() { this._showMobileMenu.set(true); }
  public closeMobileMenu() { this._showMobileMenu.set(false); }
  public toggleMobileMenu() { this._showMobileMenu.set(!this._showMobileMenu()); }

  public setMenuForRole(role: Role | string) {
    this._currentRole.set(this.normalizeRole(String(role || '')));
    const filtered = this.filterMenuByRole(Menu.pages, role);
    this._pagesMenu.set(filtered);
    this.applyActiveState();
    this.rebuildQuickActions();
  }

  private applyActiveState() {
    this._pagesMenu().forEach((group) => {
      group.active = group.items.some((item) => this.markItemState(item));
    });
    this.rebuildQuickActions();
  }

  private markItemState(item: SubMenuItem): boolean {
    const routeActive = this.isActive(item.route);
    const hasChildren = !!item.children?.length;
    const childrenActive = hasChildren
      ? item.children!.some((child) => this.markItemState(child))
      : false;

    item.active = routeActive || childrenActive;
    item.expanded = hasChildren ? routeActive || childrenActive : false;

    return !!item.active;
  }

  private filterMenuByRole(groups: MenuItem[], role: Role | string): MenuItem[] {
    const normRole = String(role || '').trim().toUpperCase() as Role;
    const normRoles = (roles?: Role[]) =>
      roles?.map((r) => String(r).trim().toUpperCase() as Role);

    const filterItem = (item: SubMenuItem, inheritedRoles?: Role[]): SubMenuItem | null => {
      const rolesForThisItem = normRoles(item.allowedRoles) ?? normRoles(inheritedRoles);
      const allowed = !rolesForThisItem || rolesForThisItem.includes(normRole);

      const children = item.children
        ?.map((child) => filterItem(child, rolesForThisItem))
        .filter((child): child is SubMenuItem => !!child);

      if (!allowed && (!children || children.length === 0)) return null;
      return { ...item, children };
    };

    return groups
      .map((group) => {
        const groupRoles = normRoles(group.allowedRoles);
        const groupAllowed = !groupRoles || groupRoles.includes(normRole);
        if (groupRoles && !groupAllowed) return null;

        const items = (group.items || [])
          .map((item) => filterItem(item, groupRoles))
          .filter((item): item is SubMenuItem => !!item);

        if (items.length === 0) return null;
        return { ...group, items };
      })
      .filter((group): group is MenuItem => !!group);
  }

  public isActive(instruction?: string | null): boolean {
    if (!instruction) return false;
    return this.router.isActive(this.router.createUrlTree([instruction]), {
      paths: 'subset',
      queryParams: 'subset',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
  }

  public resolveRouteLabel(url?: string): string {
    const target = this.normalizeUrl(url || this.router.url);
    const flat = this.flattenRoutes(this._pagesMenu());

    const matched = flat
      .filter((item) => !!item.route && target.startsWith(this.normalizeUrl(item.route!)))
      .sort((a, b) => (b.route?.length || 0) - (a.route?.length || 0))[0];

    return matched?.label || 'Panel principal';
  }

  private syncLayoutByRoute(url: string): void {
    const isPos = this.normalizeUrl(url).startsWith('/dashboard/pos');
    const wasPos = this._isPosMode();
    this._isPosMode.set(isPos);

    if (isPos) {
      if (!wasPos) {
        this._sidebarBeforePos = this._showSidebar();
      }
      this._showSidebar.set(false);
      this._showMobileMenu.set(false);
      return;
    }

    if (wasPos && this._sidebarBeforePos !== null) {
      this._showSidebar.set(this._sidebarBeforePos);
      this._sidebarBeforePos = null;
    }
  }

  private rebuildQuickActions(): void {
    const flat = this.flattenRoutes(this._pagesMenu())
      .filter((item) => !!item.route)
      .filter((item, index, arr) => arr.findIndex((x) => x.route === item.route) === index);

    const priorityMap: Record<string, string[]> = {
      GERENTE: [
        '/dashboard/main',
        '/dashboard/orders-realtime',
        '/dashboard/pos',
        '/dashboard/invoicing',
        '/dashboard/orders',
      ],
      CAJERO: [
        '/dashboard/main',
        '/dashboard/orders-realtime',
        '/dashboard/pos',
        '/dashboard/orders',
        '/caja/apertura',
      ],
      MESERO: [
        '/dashboard/pos',
        '/dashboard/orders',
      ],
      COCINA: [
        '/dashboard/orders-realtime',
      ],
    };

    const priority = priorityMap[this._currentRole()] || [
      '/dashboard/main',
      '/dashboard/pos',
      '/dashboard/orders',
      '/caja/apertura',
    ];

    const selected: SubMenuItem[] = [];
    priority.forEach((route) => {
      const found = flat.find((item) => item.route === route);
      if (found) selected.push(found);
    });

    if (!selected.length) {
      this._quickActions.set(flat.slice(0, 5));
      return;
    }

    this._quickActions.set(selected.slice(0, 5));
  }

  private flattenRoutes(groups: MenuItem[]): SubMenuItem[] {
    const result: SubMenuItem[] = [];

    const walk = (items: SubMenuItem[]) => {
      items.forEach((item) => {
        if (item.route) {
          result.push(item);
        }
        if (item.children?.length) {
          walk(item.children);
        }
      });
    };

    groups.forEach((group) => walk(group.items || []));
    return result;
  }

  private normalizeUrl(url: string): string {
    return String(url || '').split('?')[0].split('#')[0].trim();
  }

  private normalizeRole(role: string): string {
    return String(role || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  private defaultSidebarState(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.innerWidth >= 1280;
  }

  ngOnDestroy(): void { this._subscription.unsubscribe(); }
}
