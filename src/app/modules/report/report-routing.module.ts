import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReportCierreCajaComponent } from 'src/app/pages/reports/report-cierre-caja/report-cierre-caja.component';
import { FrappeReportsComponent } from 'src/app/pages/reports/frappe-reports/frappe-reports.component';
import { ReportsHomeComponent } from 'src/app/pages/reports/reports-home/reports-home.component';
import { RoleAccessGuard } from 'src/app/core/guards/role-access.guard';


const routes: Routes = [
  { path: '', component: ReportsHomeComponent },
  { path: 'orders', component: FrappeReportsComponent, canActivate: [RoleAccessGuard], data: { defaultReport: 'Orders Report', featureKey: 'restaurant', anyPermissionKeys: ['restaurant.orders.read', 'restaurant.manage'] } },
  { path: 'productos-mas-vendidos', component: FrappeReportsComponent, canActivate: [RoleAccessGuard], data: { defaultReport: 'Productos Más Vendidos', featureKey: 'products', anyPermissionKeys: ['products.read', 'products.manage'] } },
  { path: 'comprobantes-electronicos', component: FrappeReportsComponent, canActivate: [RoleAccessGuard], data: { defaultReport: 'Comprobantes Electronicos', featureKey: 'billing', anyPermissionKeys: ['billing.read', 'billing.manage'] } },
  { path: 'ventas-forma-pago', component: FrappeReportsComponent, canActivate: [RoleAccessGuard], data: { defaultReport: 'Ventas por Forma de Pago', featureKeys: ['billing', 'restaurant'], anyPermissionKeys: ['billing.read', 'billing.manage', 'restaurant.orders.read', 'restaurant.manage'] } },
  { path: 'ventasproducto', component: FrappeReportsComponent, canActivate: [RoleAccessGuard], data: { defaultReport: 'Productos Más Vendidos', featureKey: 'products', anyPermissionKeys: ['products.read', 'products.manage'] } },
  { path: 'report-cierre-caja', component: ReportCierreCajaComponent, canActivate: [RoleAccessGuard], data: { requiredFeatures: ['cash_register'], anyPermissionKeys: ['restaurant.manage', 'billing.manage'] } },
  { path: 'report-orders', component: FrappeReportsComponent, canActivate: [RoleAccessGuard], data: { defaultReport: 'Orders Report', featureKey: 'restaurant', anyPermissionKeys: ['restaurant.orders.read', 'restaurant.manage'] } }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReportRoutingModule { }
