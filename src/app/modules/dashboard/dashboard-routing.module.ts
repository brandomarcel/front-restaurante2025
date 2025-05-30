import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { NftComponent } from './pages/nft/nft.component';
import { PosComponent } from 'src/app/pages/pos/pos.component';
import { CustomersComponent } from 'src/app/pages/customers/customers.component';
import { ProductsComponent } from 'src/app/pages/products/products.component';
import { CompanyComponent } from 'src/app/pages/company/company.component';
import { OrdersComponent } from 'src/app/pages/orders/orders.component';
import { ReportOrdernesComponent } from 'src/app/pages/reports/report-ordernes/report-ordernes.component';
import { CategorysComponent } from 'src/app/pages/categorys/categorys.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: '', redirectTo: 'nfts', pathMatch: 'full' },
      { path: 'nfts', component: NftComponent },
      { path: 'pos', component: PosComponent },
      { path: 'customers', component: CustomersComponent },
      { path: 'products', component: ProductsComponent },
      { path: 'company', component: CompanyComponent },
      { path: 'orders', component: OrdersComponent },
      { path: 'categories', component: CategorysComponent },
      { path: 'reports', component: ReportOrdernesComponent },
      { path: '**', redirectTo: 'errors/404' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DashboardRoutingModule {}
