import { NgClass, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AngularSvgIconModule } from 'angular-svg-icon';
import packageJson from '../../../../../../package.json';
import { MenuService } from '../../services/menu.service';
import { SidebarMenuComponent } from './sidebar-menu/sidebar-menu.component';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css'],
  imports: [NgClass, NgIf, AngularSvgIconModule, SidebarMenuComponent],
})
export class SidebarComponent implements OnInit {
  public appJson: any = packageJson;
  logoPreview: string | null = null;
  constructor(public menuService: MenuService) { }

  ngOnInit(): void {
    const logo = localStorage.getItem('logo');
    console.log('Logo cargado:', logo);
    if (logo) {
      this.logoPreview = logo;
    }
  }
  public toggleSidebar() {
    this.menuService.toggleSidebar();
  }
}
