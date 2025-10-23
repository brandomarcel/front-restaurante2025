import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ReportCierreCajaComponent } from 'src/app/pages/reports/report-cierre-caja/report-cierre-caja.component';
import { VentasProductoComponent } from 'src/app/pages/reports/ventas-producto/ventas-producto.component';


const routes: Routes = [
  { path: 'ventasproducto', component: VentasProductoComponent },
  { path: 'report-cierre-caja', component: ReportCierreCajaComponent },

  { path: '', redirectTo: 'report', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ReportRoutingModule { }
