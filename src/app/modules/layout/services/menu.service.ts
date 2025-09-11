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
    // Por defecto (si aún no tienes el rol), deja vacío o todo para evitar parpadeo.
    this._pagesMenu.set([]);

    // Mantén tu lógica de expand/active tras cada navegación
    const sub = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this._pagesMenu().forEach((menu) => {
          let activeGroup = false;
          menu.items.forEach((subMenu) => {
            const active = this.isActive(subMenu.route);
            subMenu.expanded = active;
            subMenu.active = active;
            if (active) activeGroup = true;
            if (subMenu.children) this.expand(subMenu.children);
          });
          menu.active = activeGroup;
        });
      }
    });
    this._subscription.add(sub);
  }

  // === API pública ===
  get showSideBar()      { return this._showSidebar(); }
  get showMobileMenu()   { return this._showMobileMenu(); }
  get pagesMenu()        { return this._pagesMenu(); }
  set showSideBar(v: boolean)    { this._showSidebar.set(v); }
  set showMobileMenu(v: boolean) { this._showMobileMenu.set(v); }

  public toggleSidebar() { this._showSidebar.set(!this._showSidebar()); }
  public toggleMenu(menu: any) { this.showSideBar = true; menu.expanded = !menu.expanded; }
  public toggleSubMenu(submenu: SubMenuItem) { submenu.expanded = !submenu.expanded; }

  // 👉 Llama a esto cuando tengas el rol (p.ej., tras login)
  public setMenuForRole(role: Role) {
    console.log('setMenuForRole', role);
    const filtered = this.filterMenuByRole(Menu.pages, role);
    console.log('filtered', filtered);
    this._pagesMenu.set(filtered);

    // Opcional: disparar evaluación de rutas activas una vez cargado
    // simula un NavigationEnd para pintar expanded/active
    // this._pagesMenu().forEach((menu) => {
    //   let activeGroup = false;
    //   menu.items.forEach((subMenu) => {
    //     const active = this.isActive(subMenu.route);
    //     subMenu.expanded = active;
    //     subMenu.active = active;
    //     if (active) activeGroup = true;
    //     if (subMenu.children) this.expand(subMenu.children);
    //   });
    //   menu.active = activeGroup;
    // });
  }

  // === Helpers ===
private filterMenuByRole(groups: MenuItem[], role: Role | string): MenuItem[] {
  // 1) Normaliza el rol (trim + upper)
  const normRole = String(role || '').trim().toUpperCase() as Role;

  // helper: normaliza arreglo de roles
  const normRoles = (roles?: Role[]) =>
    roles?.map(r => String(r).trim().toUpperCase() as Role);

  // Filtra items con herencia de roles desde el grupo
  const filterItem = (item: SubMenuItem, inheritedRoles?: Role[]): SubMenuItem | null => {
    // 2) Hereda allowedRoles del grupo si el item no define los suyos
    const rolesForThisItem = normRoles(item.allowedRoles) ?? normRoles(inheritedRoles);
    const allowed = !rolesForThisItem || rolesForThisItem.includes(normRole);

    // Procesa hijos heredando la misma política
    let children = item.children?.map(ch => filterItem(ch, rolesForThisItem)).filter(Boolean) as SubMenuItem[] | undefined;

    // Si este item NO está permitido y ninguno de sus hijos quedó permitido, descártalo
    if (!allowed && (!children || children.length === 0)) return null;

    // Si este item no está permitido pero sí hay hijos permitidos, déjalo como contenedor
    return { ...item, children };
  };

  return groups
    .map((group) => {
      const groupRoles = normRoles(group.allowedRoles);
      const groupAllowed = !groupRoles || groupRoles.includes(normRole);

      // 3) Si el grupo define roles y el rol NO está permitido, descarta el grupo entero
      //    (si quieres que los items puedan “excepcionar” la regla del grupo, comenta este if)
      if (groupRoles && !groupAllowed) {
        return null;
      }

      // 4) Filtra items heredando roles del grupo
      const items = (group.items || [])
        .map(item => filterItem(item, groupRoles))
        .filter(Boolean) as SubMenuItem[];

      // 5) Si el grupo queda sin items, descártalo
      if (items.length === 0) return null;

      return { ...group, items };
    })
    .filter((g): g is MenuItem => !!g);
}


  private expand(items: Array<SubMenuItem>) {
    items.forEach((item) => {
      item.expanded = this.isActive(item.route);
      if (item.children) this.expand(item.children);
    });
  }

  public isActive(instruction: any): boolean {
    return this.router.isActive(this.router.createUrlTree([instruction]), {
      paths: 'subset',
      queryParams: 'subset',
      fragment: 'ignored',
      matrixParams: 'ignored',
    });
  }

  ngOnDestroy(): void { this._subscription.unsubscribe(); }
}
