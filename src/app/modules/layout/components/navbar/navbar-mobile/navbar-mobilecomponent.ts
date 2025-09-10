import { Component, OnInit } from '@angular/core';
import { MenuService } from '../../../services/menu.service';
import { NavbarMobileMenuComponent } from './navbar-mobile-menu/navbar-mobile-menu.component';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { CommonModule, NgClass } from '@angular/common';

@Component({
  selector: 'app-navbar-mobile',
  templateUrl: './navbar-mobile.component.html',
  styleUrls: ['./navbar-mobile.component.css'],
  imports: [NgClass, AngularSvgIconModule, NavbarMobileMenuComponent,CommonModule],
})
export class NavbarMobileComponent implements OnInit {
    logoPreview: string | null = null;
  constructor(public menuService: MenuService) {}

  ngOnInit(): void {
    const logo = localStorage.getItem('logo');
    console.log('Logo cargado:', logo);
    if (logo) {
      this.logoPreview = logo;
    }
  }

  public toggleMobileMenu(): void {
    this.menuService.showMobileMenu = false;
  }
}
