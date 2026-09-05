import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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
    private menuService: MenuService
  ) { }

  ngOnInit(): void {

    this.loadCompanyInfo();
    console.log('estoy en dashboard');
  }

  loadCompanyInfo() {
    const activeBusiness = this.capabilities.activeBusinessId
      || localStorage.getItem('active_business')
      || localStorage.getItem('businessId')
      || undefined;
    // En Lite el ambiente tributario solo es confiable desde get_lite_setup,
    // específicamente desde tax_profile.environment. El contexto de usuario
    // no siempre incluye ese bloque.
    // El perfil tributario (incluida la firma) se consulta por Business para
    // Lite y Restaurante del modelo nuevo.
    const companyRequest = activeBusiness
      ? this.service.getLiteSetup(activeBusiness)
      : this.service.get_empresa(activeBusiness);

    companyRequest.subscribe({
      next: (data: any) => {
        const liteSetup = !!activeBusiness;
        if (liteSetup) this.capabilities.setLiteSetupState(data);
        else this.capabilities.setFromResponse(data);

        const setupData = data?.data ?? data?.message?.data ?? data?.message ?? data ?? {};
        const normalizedLiteCompany = liteSetup
          ? this.service.normalizeLiteSetup(setupData)
          : null;
        const rawCompany = liteSetup
          ? normalizedLiteCompany
          : (data?.message?.data ?? data?.message ?? data?.data ?? {});
        const source = Array.isArray(rawCompany) ? (rawCompany[0] ?? {}) : rawCompany;
        const company = source?.business && typeof source.business === 'object'
          ? source.business
          : (source?.company ?? source?.empresa ?? source);
        if (company) {
        if (company.logo) {
          localStorage.setItem('logo', company.logo);
        }

        const ambiente = liteSetup
          ? setupData?.tax_profile?.environment
            ?? setupData?.tax_profile?.ambiente
            ?? company?.environment
            ?? company?.ambiente
          : company.ambiente ?? company.environment ?? source?.environment;
        if (ambiente) {
          this.utilsService.cambiarAmbiente(ambiente);
        }
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        this.menuService.setMenuForRoles(Array.isArray(user?.roles) ? user.roles : []);
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
