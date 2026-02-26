// services/menu.service.ts
import { Injectable, OnDestroy, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Menu } from 'src/app/core/constants/menu';
import { MenuItem, SubMenuItem, Role } from 'src/app/core/models/menu.model';

@Injectable({ providedIn: 'root' })
export class MenuService implements OnDestroy {
  private _showSidebar = signal(false);
  private _showMobileMenu = signal(false);
  private _pagesMenu = signal<MenuItem[]>([]);
  private _subscription = new Subscription();

  constructor(private router: Router) {
    this._pagesMenu.set([]);

    const sub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.applyActiveState();
        this.closeMobileMenu();
      }
    });
    this._subscription.add(sub);
  }

  get showSideBar()      { return this._showSidebar(); }
  get showMobileMenu()   { return this._showMobileMenu(); }
  get pagesMenu()        { return this._pagesMenu(); }
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

  public setMenuForRole(role: Role) {
    const filtered = this.filterMenuByRole(Menu.pages, role);
    this._pagesMenu.set(filtered);
    this.applyActiveState();
  }

  private applyActiveState() {
    this._pagesMenu().forEach((group) => {
      group.active = group.items.some((item) => this.markItemState(item));
    });
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

  ngOnDestroy(): void { this._subscription.unsubscribe(); }
}
