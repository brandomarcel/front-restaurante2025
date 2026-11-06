import { NgClass, NgIf, NgTemplateOutlet } from '@angular/common';
import { Component } from '@angular/core';
import { AngularSvgIconModule } from 'angular-svg-icon';
import packageJson from '../../../../../../package.json';
import { MenuService } from '../../services/menu.service';
import { SidebarMenuComponent } from './sidebar-menu/sidebar-menu.component';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
  imports: [NgClass, NgIf, NgTemplateOutlet, AngularSvgIconModule, SidebarMenuComponent],
})
export class SidebarComponent {
  public appJson: any = packageJson;
  constructor(public menuService: MenuService) { }

  public toggleSidebar() {
    this.menuService.toggleSidebar();
  }

  public closeMobileMenu() {
    this.menuService.closeMobileMenu();
  }
}
