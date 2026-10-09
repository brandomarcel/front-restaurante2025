import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RoleAccessGuard } from 'src/app/core/guards/role-access.guard';
import { CompanyComponent } from 'src/app/pages/company/company.component';
import { LiteEstablishmentsComponent } from 'src/app/pages/lite-establishments/lite-establishments.component';
import { LiteEmissionPointsComponent } from 'src/app/pages/lite-emission-points/lite-emission-points.component';
import { LiteDocumentSequencesComponent } from 'src/app/pages/lite-document-sequences/lite-document-sequences.component';
import { LitePosTerminalsComponent } from 'src/app/pages/lite-pos-terminals/lite-pos-terminals.component';
import { LiteWarehousesComponent } from 'src/app/pages/lite-warehouses/lite-warehouses.component';
import { LiteInventoryTransferComponent } from 'src/app/pages/lite-warehouses/lite-inventory-transfer.component';
import { LiteApiIntegrationComponent } from 'src/app/pages/lite-api-integration/lite-api-integration.component';

/**
 * Settings Lite uses dedicated setup endpoints for establishments while the
 * aggregate Company screen remains the source for the general configuration.
 */
const management = {
  canActivate: [RoleAccessGuard],
  data: { permissionKey: 'business.settings.manage' }
};
const establishmentManagement = {
  canActivate: [RoleAccessGuard],
  data: { permissionKey: 'business.settings.manage' }
};

const routes: Routes = [
  { path: 'lite', component: CompanyComponent, ...management },
  { path: 'lite/tax-profile', component: CompanyComponent, ...management },
  { path: 'lite/certificate', component: CompanyComponent, ...management },
  { path: 'lite/plan', component: CompanyComponent, ...management },
  { path: 'lite/establishments', component: LiteEstablishmentsComponent, ...establishmentManagement },
  { path: 'lite/emission-points', component: LiteEmissionPointsComponent, ...establishmentManagement },
  { path: 'lite/sequences', component: LiteDocumentSequencesComponent, ...establishmentManagement },
  { path: 'lite/pos-terminals', component: LitePosTerminalsComponent, ...management, data: { ...management.data, apiOnlyBlocked: true, featureKey: 'pos_terminal' } },
  { path: 'lite/warehouses', component: LiteWarehousesComponent, ...management, data: { ...management.data, apiOnlyBlocked: true, featureKey: 'inventory' } },
  {
    path: 'lite/warehouses/transfer',
    component: LiteInventoryTransferComponent,
    canActivate: [RoleAccessGuard],
    // El traslado entre bodegas es una operación de inventario, no de
    // configuración del negocio: basta con `inventory.manage` (un admin con
    // `business.settings.manage` también puede, por si acaso no tuviera el otro).
    data: { anyPermissionKeys: ['inventory.manage', 'business.settings.manage'], apiOnlyBlocked: true, featureKey: 'inventory' }
  },
  { path: 'lite/readiness', component: CompanyComponent, ...management },
  {
    path: 'lite/api',
    component: LiteApiIntegrationComponent,
    canActivate: [RoleAccessGuard],
    data: {
      featureKey: 'api',
      readOnlyFeature: true,
      permissionKey: 'business.settings.manage'
    }
  },
  {
    path: 'lite/api-clients',
    component: LiteApiIntegrationComponent,
    canActivate: [RoleAccessGuard],
    data: { permissionKey: 'business.settings.manage', featureKey: 'api' }
  },
  {
    path: 'lite/api-logs',
    component: LiteApiIntegrationComponent,
    canActivate: [RoleAccessGuard],
    data: { permissionKey: 'business.settings.manage', featureKey: 'api' }
  },
  { path: '', redirectTo: 'lite', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class LiteSettingsRoutingModule {}
