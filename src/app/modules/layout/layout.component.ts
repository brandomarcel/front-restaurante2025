import { Component, OnInit } from '@angular/core';
import { Event, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NgClass, NgIf } from '@angular/common';
import { BottomNavbarComponent } from './components/bottom-navbar/bottom-navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { MenuService } from './services/menu.service';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
  imports: [NgClass, NgIf, SidebarComponent, NavbarComponent, RouterOutlet, FooterComponent, BottomNavbarComponent],
})
export class LayoutComponent implements OnInit {
  private mainContent: HTMLElement | null = null;

  constructor(
    private router: Router,
    public menuService: MenuService,
  ) {
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationEnd) {
        if (this.mainContent) {
          this.mainContent!.scrollTop = 0;
        }
      }
    });
  }

  ngOnInit(): void {
    this.mainContent = document.getElementById('main-content');
  }
}
