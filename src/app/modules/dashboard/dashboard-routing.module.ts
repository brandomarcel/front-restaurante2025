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
import { PosCajaComponent } from 'src/app/pages/pos/pos-caja/pos-caja.component';
import { PosSaleNotesComponent } from 'src/app/pages/pos-sale-notes/pos-sale-notes.component';
import { PosSaleNoteDetailPageComponent } from 'src/app/pages/pos-sale-note-detail-page/pos-sale-note-detail-page.component';
import { CajaAbiertaGuard } from 'src/app/core/guards/caja-abierta.guard';
import { RoleAccessGuard } from 'src/app/core/guards/role-access.guard';
import { SuppliersComponent } from 'src/app/pages/suppliers/suppliers.component';
import { InventoryComponent } from 'src/app/pages/inventory/inventory.component';
import { NoAccessComponent } from 'src/app/pages/no-access.component';
import { TablesComponent } from 'src/app/pages/tables/tables.component';

const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: '', redirectTo: 'main', pathMatch: 'full' },
      { path: 'main', component: NftComponent, canActivate: [RoleAccessGuard], data: { allowedRoles: ['ADMINISTRADOR', 'GERENTE', 'CAJERO', 'FACTURACION', 'USUARIO'] } },
      // { path: 'pos', component: PosComponent },
      { path: 'pos', component: PosShellComponent, canActivate: [RoleAccessGuard, CajaAbiertaGuard], data: { featureKey: 'restaurant', requiredFeatures: ['orders'], anyPermissionKeys: ['restaurant.orders.create', 'billing.create'], liteBlocked: true } },
      { path: 'pos-generic', component: PosCajaComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'generic_pos', requiredFeatures: ['generic_pos', 'billing'], readOnlyFeature: true, permissionKey: 'billing.create' } },
      { path: 'pos-sale-notes', component: PosSaleNotesComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'generic_pos', permissionKey: 'billing.read' } },
      { path: 'pos-sale-notes/:id', component: PosSaleNoteDetailPageComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'generic_pos', permissionKey: 'billing.read' } },
      { path: 'customers', component: CustomersComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'customers', permissionKey: 'customers.read' } },
      { path: 'suppliers', component: SuppliersComponent, canActivate: [RoleAccessGuard], data: { allowedRoles: ['GERENTE'], liteBlocked: true } },
      { path: 'inventory', component: InventoryComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'inventory', permissionKey: 'inventory.read' } },
      { path: 'products', component: ProductsComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'products', permissionKey: 'products.read' } },
      { path: 'company', component: CompanyComponent, canActivate: [RoleAccessGuard], data: { permissionKey: 'business.settings.manage' } },
      { path: 'orders', component: OrdersComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'orders', permissionKey: 'restaurant.orders.read', liteBlocked: true } },
      { path: 'orders/:id', component: OrderDetailPageComponent, canActivate: [RoleAccessGuard, CajaAbiertaGuard], data: { featureKey: 'orders', permissionKey: 'restaurant.orders.read', liteBlocked: true } },
      { path: 'tables', component: TablesComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'tables', permissionKey: 'restaurant.orders.read' } },

      { path: 'categories', component: CategorysComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'products', permissionKey: 'products.manage' } },
      { path: 'users', component: UsersComponent, canActivate: [RoleAccessGuard], data: { permissionKey: 'business.users.manage', apiOnlyBlocked: true } },
      
      { path: 'invoicing', component: InvoicingComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'direct_invoice', requiredFeatures: ['billing', 'direct_invoice'], permissionKey: 'billing.create' } },

      { path: 'invoices', component: InvoicesComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'direct_invoice', featureKeys: ['direct_invoice', 'generic_pos', 'api'], readOnlyFeature: true, permissionKey: 'billing.read' } },
      { path: 'invoices/:id', component: InvoiceDetailPageComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'direct_invoice', featureKeys: ['direct_invoice', 'generic_pos', 'api'], readOnlyFeature: true, permissionKey: 'billing.read' } },

      { path: 'credit-notes', component: CreditNotesComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'credit_note', featureKeys: ['credit_note', 'api'], readOnlyFeature: true, permissionKey: 'billing.read' } },
      { path: 'credit-note/:id', component: CreditNoteDetailPageComponent, canActivate: [RoleAccessGuard], data: { featureKey: 'credit_note', featureKeys: ['credit_note', 'api'], readOnlyFeature: true, permissionKey: 'billing.read' } },
      { path: 'no-access', component: NoAccessComponent },

      {
        path: 'orders-realtime',
        component: OrdersRealtimeComponent,
        canActivate: [RoleAccessGuard],
        data: { featureKey: 'kitchen', permissionKeys: ['restaurant.orders.read', 'restaurant.orders.update'], liteBlocked: true }
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
