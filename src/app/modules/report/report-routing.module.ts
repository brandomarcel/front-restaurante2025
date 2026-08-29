import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReportCierreCajaComponent } from 'src/app/pages/reports/report-cierre-caja/report-cierre-caja.component';
import { FrappeReportsComponent } from 'src/app/pages/reports/frappe-reports/frappe-reports.component';
import { ReportsHomeComponent } from 'src/app/pages/reports/reports-home/reports-home.component';


const routes: Routes = [
  { path: '', component: ReportsHomeComponent },
  { path: 'orders', component: FrappeReportsComponent, data: { defaultReport: 'Orders Report' } },
  { path: 'productos-mas-vendidos', component: FrappeReportsComponent, data: { defaultReport: 'Productos Más Vendidos' } },
  { path: 'comprobantes-electronicos', component: FrappeReportsComponent, data: { defaultReport: 'Comprobantes Electronicos' } },
  { path: 'ventas-forma-pago', component: FrappeReportsComponent, data: { defaultReport: 'Ventas por Forma de Pago' } },
  { path: 'ventasproducto', component: FrappeReportsComponent, data: { defaultReport: 'Productos Más Vendidos' } },
  { path: 'report-cierre-caja', component: ReportCierreCajaComponent },
  { path: 'report-orders', component: FrappeReportsComponent, data: { defaultReport: 'Orders Report' } }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReportRoutingModule { }
