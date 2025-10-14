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
import { InvoicingComponent } from 'src/app/pages/invoicing/invoicing.component';
import { UsersComponent } from 'src/app/pages/users/users.component';
import { InvoicesComponent } from '../../pages/invoices/invoices.component';
import { OrderDetailPageComponent } from 'src/app/pages/order-detail-page/order-detail-page.component';
import { InvoiceDetailPageComponent } from 'src/app/pages/invoice-detail-page/invoice-detail-page.component';
import { CreditNotesComponent } from 'src/app/pages/credit-notes/credit-notes.component';
import { CreditNoteDetailPageComponent } from 'src/app/pages/credit-note-detail-page/credit-note-detail-page.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: '', redirectTo: 'main', pathMatch: 'full' },
      { path: 'main', component: NftComponent },
      { path: 'pos', component: PosComponent },
      { path: 'customers', component: CustomersComponent },
      { path: 'products', component: ProductsComponent },
      { path: 'company', component: CompanyComponent },
      { path: 'orders', component: OrdersComponent },
      { path: 'orders/:id', component: OrderDetailPageComponent },

      { path: 'categories', component: CategorysComponent },
      { path: 'reportes', component: ReportOrdernesComponent },
      { path: 'users', component: UsersComponent },
      
      { path: 'invoicing',component: InvoicingComponent},
      { path: 'invoicing/:order_name',component: InvoicingComponent},

      { path: 'invoices', component: InvoicesComponent },
      { path: 'invoices/:id', component: InvoiceDetailPageComponent },

      { path: 'credit-notes', component: CreditNotesComponent },
      { path: 'credit-note/:id', component: CreditNoteDetailPageComponent },

      { path: '**', redirectTo: 'errors/404' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DashboardRoutingModule { }
