import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { DashboardComponent } from './dashboard.component';
import { NftComponent } from './pages/nft/nft.component';
import { PosComponent } from 'src/app/pages/pos/pos.component';
import { CustomersComponent } from 'src/app/pages/customers/customers.component';
import { ProductsComponent } from 'src/app/pages/products/products.component';
import { CompanyComponent } from 'src/app/pages/company/company.component';
import { OrdersComponent } from 'src/app/pages/orders/orders.component';
import { CategorysComponent } from 'src/app/pages/categorys/categorys.component';
import { InvoicingComponent } from 'src/app/pages/invoicing/invoicing.component';
import { UsersComponent } from 'src/app/pages/users/users.component';
import { InvoicesComponent } from '../../pages/invoices/invoices.component';
import { OrderDetailPageComponent } from 'src/app/pages/order-detail-page/order-detail-page.component';
import { InvoiceDetailPageComponent } from 'src/app/pages/invoice-detail-page/invoice-detail-page.component';
import { CreditNotesComponent } from 'src/app/pages/credit-notes/credit-notes.component';
import { CreditNoteDetailPageComponent } from 'src/app/pages/credit-note-detail-page/credit-note-detail-page.component';
import { OrdersRealtimeComponent } from 'src/app/pages/orders-realtime/orders-realtime.component';
import { PosShellComponent } from 'src/app/pages/pos/pos-shell/pos-shell.component';
import { CajaAbiertaGuard } from 'src/app/core/guards/caja-abierta.guard';
import { RoleAccessGuard } from 'src/app/core/guards/role-access.guard';
import { SuppliersComponent } from 'src/app/pages/suppliers/suppliers.component';
import { InventoryComponent } from 'src/app/pages/inventory/inventory.component';
import { NoAccessComponent } from 'src/app/pages/no-access.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: '', redirectTo: 'main', pathMatch: 'full' },
      { path: 'main', component: NftComponent, canActivate: [RoleAccessGuard], data: { allowedRoles: ['GERENTE', 'CAJERO', 'FACTURACION', 'USUARIO'] } },
      // { path: 'pos', component: PosComponent },
      { path: 'pos', component: PosShellComponent, canActivate: [RoleAccessGuard, CajaAbiertaGuard], data: { featureKey: 'tables', allowedRoles: ['GERENTE', 'CAJERO', 'MESERO'], liteBlocked: true } },
      { path: 'customers', component: CustomersComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'customers', allowedRoles: ['GERENTE', 'CAJERO', 'FACTURACION'] } },
      { path: 'suppliers', component: SuppliersComponent, canActivate: [RoleAccessGuard], data: { allowedRoles: ['GERENTE'], liteBlocked: true } },
      { path: 'inventory', component: InventoryComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'inventory', allowedRoles: ['GERENTE'] } },
      { path: 'products', component: ProductsComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'products', permissionKey: 'products.read', allowedRoles: ['GERENTE', 'CAJERO', 'FACTURACION'] } },
      { path: 'company', component: CompanyComponent, canActivate: [RoleAccessGuard], data: { allowedRoles: ['GERENTE'] } },
      { path: 'orders', component: OrdersComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'orders', allowedRoles: ['GERENTE', 'CAJERO', 'MESERO'], liteBlocked: true } },
      { path: 'orders/:id', component: OrderDetailPageComponent, canActivate: [RoleAccessGuard, CajaAbiertaGuard], data: { featureKey: 'orders', allowedRoles: ['GERENTE', 'CAJERO', 'MESERO'], liteBlocked: true } },

      { path: 'categories', component: CategorysComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'products', permissionKey: 'products.read', allowedRoles: ['GERENTE', 'CAJERO', 'FACTURACION'] } },
      { path: 'users', component: UsersComponent, canActivate: [RoleAccessGuard], data: { allowedRoles: ['GERENTE'], liteBlocked: true } },
      
      { path: 'invoicing', component: InvoicingComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'direct_invoice', allowedRoles: ['GERENTE', 'CAJERO', 'FACTURACION'] } },
      { path: 'invoicing/:order_name', component: InvoicingComponent, canActivate: [RoleAccessGuard, CajaAbiertaGuard], data: { featureKey: 'orders', allowedRoles: ['GERENTE', 'CAJERO'], liteBlocked: true } },

      { path: 'invoices', component: InvoicesComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'direct_invoice', allowedRoles: ['GERENTE', 'CAJERO', 'FACTURACION', 'USUARIO'] } },
      { path: 'invoices/:id', component: InvoiceDetailPageComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'direct_invoice', allowedRoles: ['GERENTE', 'CAJERO', 'FACTURACION', 'USUARIO'] } },

      { path: 'credit-notes', component: CreditNotesComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'credit_note', allowedRoles: ['GERENTE', 'CAJERO', 'FACTURACION'] } },
      { path: 'credit-note/:id', component: CreditNoteDetailPageComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'credit_note', allowedRoles: ['GERENTE', 'CAJERO', 'FACTURACION'] } },
      { path: 'no-access', component: NoAccessComponent },

      {
        path: 'orders-realtime',
        component: OrdersRealtimeComponent,
        canActivate: [RoleAccessGuard],
        data: { featureKey: 'kitchen', allowedRoles: ['GERENTE', 'COCINA'], deniedRoles: ['MESERO'], liteBlocked: true }
      },

      { path: '**', redirectTo: 'errors/404' },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DashboardRoutingModule { }
