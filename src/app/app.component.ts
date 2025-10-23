import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgxSonnerToaster } from 'ngx-sonner';
import { ThemeService } from './core/services/theme.service';
import { ResponsiveHelperComponent } from './shared/components/responsive-helper/responsive-helper.component';
import { NgxSpinnerComponent } from 'ngx-spinner';
import { AuthService } from './services/auth.service';
import { MenuService } from './modules/layout/services/menu.service';
@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  imports: [RouterOutlet, ResponsiveHelperComponent, NgxSonnerToaster, NgxSpinnerComponent],
})
export class AppComponent {
  title = 'Angular Tailwind';

  constructor(public themeService: ThemeService, private auth: AuthService, private menu: MenuService) {
    console.log('cargo');

    console.log('this.auth.getCurrentUser()', this.auth.getCurrentUser());
    const role: any = this.auth.getCurrentUser();
    console.log('role', role);
    if (this.isDeepNonEmptyObject(role)) {
      this.menu.setMenuForRole(role.roles[0]);

    }

  }

  isNonEmptyObject(v: unknown): v is Record<string, unknown> {
  return v != null
    && typeof v === 'object'
    && !Array.isArray(v)
    && Object.keys(v).length > 0;
}
isDeepNonEmptyObject(v: unknown): boolean {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
  for (const key of Reflect.ownKeys(v as object)) {
    const val = (v as any)[key as any];
    if (val != null && typeof val === 'object') {
      if (this.isDeepNonEmptyObject(val)) return true;
    } else if (val !== '' && val !== undefined && val !== null) {
      return true;
    }
  }
  return false;
}
}
