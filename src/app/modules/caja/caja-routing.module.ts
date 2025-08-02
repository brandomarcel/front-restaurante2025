import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AperturaCajaComponent } from 'src/app/pages/apertura-caja/apertura-caja.component';
import { CloseCajaComponent } from 'src/app/pages/close-caja/close-caja.component';
import { ReportCierreCajaComponent } from 'src/app/pages/reports/report-cierre-caja/report-cierre-caja.component';
import { RetiroCajaComponent } from 'src/app/pages/retiro-caja/retiro-caja.component';


const routes: Routes = [
  { path: 'apertura', component: AperturaCajaComponent },
  { path: 'cierre', component: CloseCajaComponent },
  { path: 'retiro', component: RetiroCajaComponent },
  { path: '', redirectTo: 'reporte', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CajaRoutingModule { }
