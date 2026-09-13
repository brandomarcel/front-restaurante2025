import { Component, OnInit } from '@angular/core';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';

@Component({
  selector: 'app-no-access',
  standalone: true,
  template: `
    <section class="mx-auto mt-10 max-w-xl rounded-lg border bg-white p-8 text-center shadow-sm">
      <h1 class="text-xl font-semibold text-slate-800">No tienes módulos disponibles</h1>
      <p class="mt-2 text-sm text-slate-500">
        Tu rol no tiene acceso a módulos habilitados para el modo de operación de esta empresa.
      </p>
    </section>
  `
})
export class NoAccessComponent implements OnInit {
  constructor(private capabilities: CompanyCapabilitiesService) {}

  ngOnInit(): void {
    console.error('[FacturADA][NoAccess] Se mostró la pantalla sin módulos', {
      business: this.capabilities.activeBusinessId,
      businessRole: this.capabilities.businessRole,
      permissions: this.capabilities.permissions,
      features: this.capabilities.features,
      landingRoute: this.capabilities.getLandingRoute([])
    });
  }
}
