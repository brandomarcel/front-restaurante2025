import { Component, OnInit } from '@angular/core';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { MenuService } from '../../services/menu.service';
import { NavbarMenuComponent } from './navbar-menu/navbar-menu.component';
import { NavbarMobileComponent } from './navbar-mobile/navbar-mobilecomponent';
import { ProfileMenuComponent } from './profile-menu/profile-menu.component';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
  imports: [AngularSvgIconModule, NavbarMenuComponent, ProfileMenuComponent, NavbarMobileComponent,CommonModule],
})
export class NavbarComponent implements OnInit {
  logoPreview: string | null = null;
  constructor(private menuService: MenuService) {}

  ngOnInit(): void {
    const logo = localStorage.getItem('logo');
    console.log('Logo cargado:', logo);
    if (logo) {
      this.logoPreview = logo;
    }
    
  }

  public toggleMobileMenu(): void {
    this.menuService.showMobileMenu = true;
  }
}
