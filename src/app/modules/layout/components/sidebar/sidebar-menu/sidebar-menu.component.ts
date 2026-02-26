import { NgClass, NgFor, NgIf, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { SubMenuItem } from 'src/app/core/models/menu.model';
import { MenuService } from '../../../services/menu.service';
import { SidebarSubmenuComponent } from '../sidebar-submenu/sidebar-submenu.component';

@Component({
  selector: 'app-sidebar-menu',
  templateUrl: './sidebar-menu.component.html',
  styleUrls: ['./sidebar-menu.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgFor,
    NgClass,
    AngularSvgIconModule,
    NgTemplateOutlet,
    NgIf,
    SidebarSubmenuComponent,
  ],
})
export class SidebarMenuComponent implements OnInit {
  @Input() mobile = false;

  constructor(
    public menuService: MenuService,
    private router: Router,
  ) {}

  public toggleMenu(subMenu: SubMenuItem) {
    if (!this.mobile && !this.menuService.showSideBar) {
      this.menuService.showSideBar = true;
      subMenu.expanded = true;
      return;
    }

    this.menuService.toggleMenu(subMenu);
  }

  public onItemClick(item: SubMenuItem) {
    if (!this.mobile && !this.menuService.showSideBar) {
      this.menuService.showSideBar = true;
      if (item.children?.length) {
        item.expanded = true;
      }
      return;
    }

    if (item.children?.length) {
      this.toggleMenu(item);
      return;
    }

    if (item.route) {
      this.router.navigateByUrl(item.route);
      this.closeMobileMenu();
    }
  }

  public onItemKeydown(event: KeyboardEvent, item: SubMenuItem) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    this.onItemClick(item);
  }

  public closeMobileMenu() {
    if (this.mobile) {
      this.menuService.closeMobileMenu();
    }
  }

  ngOnInit(): void {}
}
