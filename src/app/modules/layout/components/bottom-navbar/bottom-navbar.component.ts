import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { MenuService } from '../../services/menu.service';

@Component({
  selector: 'app-bottom-navbar',
  templateUrl: './bottom-navbar.component.html',
  styleUrls: ['./bottom-navbar.component.css'],
  imports: [NgIf, NgFor, NgClass, RouterLink, AngularSvgIconModule],
})
export class BottomNavbarComponent {
  constructor(public menuService: MenuService) {}

  get items() {
    return this.menuService.quickActions;
  }
}
