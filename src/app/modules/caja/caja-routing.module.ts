import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AperturaCajaComponent } from 'src/app/pages/apertura-caja/apertura-caja.component';
import { CloseCajaComponent } from 'src/app/pages/close-caja/close-caja.component';
import { RetiroCajaComponent } from 'src/app/pages/retiro-caja/retiro-caja.component';
import { CashManagementComponent } from 'src/app/pages/cash-management/cash-management.component';
import { RoleAccessGuard } from 'src/app/core/guards/role-access.guard';


const routes: Routes = [
  { path: 'apertura', component: AperturaCajaComponent, canActivate: [RoleAccessGuard], data: { permissionKey: 'restaurant.cash.manage' } },
  { path: 'cierre', component: CloseCajaComponent, canActivate: [RoleAccessGuard], data: { permissionKey: 'restaurant.cash.manage' } },
  { path: 'retiro', component: RetiroCajaComponent, canActivate: [RoleAccessGuard], data: { permissionKey: 'restaurant.cash.manage' } },
  {
    path: 'gestion',
    component: CashManagementComponent,
    canActivate: [RoleAccessGuard],
    data: {
      requiredFeatures: ['restaurant_pos', 'cash_register'],
      anyPermissionKeys: ['restaurant.manage']
    }
  },
  { path: '', redirectTo: 'apertura', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CajaRoutingModule { }
