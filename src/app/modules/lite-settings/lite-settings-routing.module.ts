import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RoleAccessGuard } from 'src/app/core/guards/role-access.guard';
import { CompanyComponent } from 'src/app/pages/company/company.component';
import { LiteEstablishmentsComponent } from 'src/app/pages/lite-establishments/lite-establishments.component';
import { LiteEmissionPointsComponent } from 'src/app/pages/lite-emission-points/lite-emission-points.component';
import { LiteDocumentSequencesComponent } from 'src/app/pages/lite-document-sequences/lite-document-sequences.component';
import { LitePosTerminalsComponent } from 'src/app/pages/lite-pos-terminals/lite-pos-terminals.component';

/**
 * Settings Lite uses dedicated setup endpoints for establishments while the
 * aggregate Company screen remains the source for the general configuration.
 */
const management = {
  canActivate: [RoleAccessGuard],
  data: { allowedRoles: ['GERENTE'], permissionKey: 'business.settings.manage' }
};
const establishmentManagement = {
  canActivate: [RoleAccessGuard],
  data: { allowedRoles: ['ADMINISTRADOR', 'GERENTE', 'CAJERO', 'MESERO', 'COCINA', 'FACTURACION', 'USUARIO'] }
};

const routes: Routes = [
  { path: 'lite', component: CompanyComponent, ...management },
  { path: 'lite/tax-profile', component: CompanyComponent, ...management },
  { path: 'lite/certificate', component: CompanyComponent, ...management },
  { path: 'lite/plan', component: CompanyComponent, ...management },
  { path: 'lite/establishments', component: LiteEstablishmentsComponent, ...establishmentManagement },
  { path: 'lite/emission-points', component: LiteEmissionPointsComponent, ...establishmentManagement },
  { path: 'lite/sequences', component: LiteDocumentSequencesComponent, ...establishmentManagement },
  { path: 'lite/pos-terminals', component: LitePosTerminalsComponent, ...management, data: { ...management.data, apiOnlyBlocked: true, featureKey: 'pos' } },
  { path: 'lite/readiness', component: CompanyComponent, ...management },
  {
    path: 'lite/api-clients',
    component: CompanyComponent,
    canActivate: [RoleAccessGuard],
    data: { allowedRoles: ['GERENTE'], permissionKey: 'business.settings.manage', featureKey: 'api' }
  },
  {
    path: 'lite/api-logs',
    component: CompanyComponent,
    canActivate: [RoleAccessGuard],
    data: { allowedRoles: ['GERENTE'], permissionKey: 'business.settings.manage', featureKey: 'api' }
  },
  { path: '', redirectTo: 'lite', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LiteSettingsRoutingModule {}
