import { Component, effect, OnDestroy, OnInit } from '@angular/core';
import { Event, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { NgClass, NgIf } from '@angular/common';
import { BottomNavbarComponent } from './components/bottom-navbar/bottom-navbar.component';
import { FooterComponent } from './components/footer/footer.component';
import { NavbarComponent } from './components/navbar/navbar.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { MenuService } from './services/menu.service';
import { NewOrderAlertService } from 'src/app/services/new-order-alert.service';
import { PrintStationService } from 'src/app/services/print-station.service';
import { PrintStationSettingsComponent } from 'src/app/shared/components/print-station-settings/print-station-settings.component';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.component.html',
  styleUrls: ['./layout.component.css'],
  imports: [NgClass, NgIf, SidebarComponent, NavbarComponent, RouterOutlet, FooterComponent, BottomNavbarComponent, PrintStationSettingsComponent],
})
export class LayoutComponent implements OnInit, OnDestroy {
  private mainContent: HTMLElement | null = null;

  constructor(
    private router: Router,
    public menuService: MenuService,
    private newOrderAlerts: NewOrderAlertService,
    public printStation: PrintStationService,
  ) {
    this.router.events.subscribe((event: Event) => {
      if (event instanceof NavigationEnd) {
        if (this.mainContent) {
          this.mainContent!.scrollTop = 0;
        }
      }
    });

    // Los toasts (abajo a la izquierda) se corren para no tapar el menú lateral ni la barra
    // inferior del celular: `styles.css` lee este atributo de <html>.
    effect(() => {
      const shell = this.menuService.isPosMode ? 'pos' : this.menuService.showSideBar ? 'sidebar-open' : 'sidebar-collapsed';
      document.documentElement.setAttribute('data-shell', shell);
    });
  }

  ngOnInit(): void {
    this.mainContent = document.getElementById('main-content');
    this.newOrderAlerts.start();
  }

  ngOnDestroy(): void {
    document.documentElement.removeAttribute('data-shell');
  }
}
