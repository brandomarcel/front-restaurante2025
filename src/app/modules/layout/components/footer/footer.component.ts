import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MenuService } from '../../services/menu.service';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.css'],
  standalone: true,
  imports: [CommonModule],
})
export class FooterComponent implements OnInit, OnDestroy {
  public year: number = new Date().getFullYear();
  public sectionLabel = 'Panel principal';
  public userLabel = 'Usuario';
  public now = new Date();
  private clockId: any = null;
  private sub = new Subscription();

  constructor(
    private router: Router,
    private menuService: MenuService,
  ) {}

  ngOnInit(): void {
    this.readUserLabel();
    this.refreshSectionLabel(this.router.url);
    this.sub.add(
      this.router.events.subscribe((event) => {
        if (event instanceof NavigationEnd) {
          this.refreshSectionLabel(event.urlAfterRedirects || event.url);
        }
      }),
    );
    this.clockId = setInterval(() => {
      this.now = new Date();
    }, 30000);
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
    if (this.clockId) {
      clearInterval(this.clockId);
    }
  }

  private refreshSectionLabel(url: string): void {
    this.sectionLabel = this.menuService.resolveRouteLabel(url);
  }

  private readUserLabel(): void {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const name = String(user?.fullName || '').trim();
      const role = String(user?.roles?.[0] || '').trim();
      this.userLabel = `${name || 'Usuario'}${role ? ` · ${role}` : ''}`;
    } catch {
      this.userLabel = 'Usuario';
    }
  }
}
