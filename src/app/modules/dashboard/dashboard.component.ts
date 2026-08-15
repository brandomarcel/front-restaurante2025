import { Component, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { UtilsService } from 'src/app/core/services/utils.service';
import { CompanyService } from 'src/app/services/company.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { MenuService } from '../layout/services/menu.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [RouterOutlet]
})
export class DashboardComponent implements OnInit {
  constructor(
    private service: CompanyService,
    private utilsService: UtilsService,
    private capabilities: CompanyCapabilitiesService,
    private menuService: MenuService,
    private router: Router
  ) { }

  ngOnInit(): void {

    this.loadCompanyInfo();
    console.log('estoy en dashboard');
  }

  loadCompanyInfo() {
    this.service.get_empresa().subscribe({
      next: (data: any) => {
        this.capabilities.setFromResponse(data);
        const rawCompany = data?.message?.data ?? data?.message ?? data?.data ?? {};
        const company = Array.isArray(rawCompany) ? (rawCompany[0] ?? {}) : rawCompany;
        if (company) {
        if (company.logo) {
          localStorage.setItem('logo', company.logo);
        }

        localStorage.setItem('ambiente', company.ambiente);
        this.utilsService.cambiarAmbiente(company.ambiente);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        this.menuService.setMenuForRoles(Array.isArray(user?.roles) ? user.roles : []);
        if (this.capabilities.businessMode === 'FACTURADOR' && /^\/dashboard\/?(?:main)?$/.test(this.router.url)) {
          this.router.navigateByUrl(this.capabilities.getLandingRoute(user?.roles));
        }
      }
      },
      error: () => {
        this.capabilities.useSafeFallback();
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        this.menuService.setMenuForRoles(Array.isArray(user?.roles) ? user.roles : []);
      }
    });
  }

}
