import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AperturaCajaComponent } from 'src/app/pages/apertura-caja/apertura-caja.component';
import { CloseCajaComponent } from 'src/app/pages/close-caja/close-caja.component';
import { RetiroCajaComponent } from 'src/app/pages/retiro-caja/retiro-caja.component';
import { CashManagementComponent } from 'src/app/pages/cash-management/cash-management.component';
import { RoleAccessGuard } from 'src/app/core/guards/role-access.guard';


const CASH_OPERATOR_PERMISSIONS = ['restaurant.cash.manage', 'restaurant.manage', 'billing.manage', 'billing.create'];

const routes: Routes = [
  { path: 'apertura', component: AperturaCajaComponent, canActivate: [RoleAccessGuard], data: { anyPermissionKeys: CASH_OPERATOR_PERMISSIONS } },
  { path: 'cierre', component: CloseCajaComponent, canActivate: [RoleAccessGuard], data: { anyPermissionKeys: CASH_OPERATOR_PERMISSIONS } },
  { path: 'retiro', component: RetiroCajaComponent, canActivate: [RoleAccessGuard], data: { anyPermissionKeys: CASH_OPERATOR_PERMISSIONS } },
  {
    path: 'gestion',
    component: CashManagementComponent,
    canActivate: [RoleAccessGuard],
    data: {
      requiredFeatures: ['cash_register'],
      anyPermissionKeys: ['restaurant.manage', 'billing.manage']
    }
  },
  { path: '', redirectTo: 'apertura', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CajaRoutingModule { }
