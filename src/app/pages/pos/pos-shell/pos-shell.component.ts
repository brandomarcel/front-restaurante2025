import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/services/auth.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { PosMeseroComponent } from '../pos-mesero/pos-mesero.component';
import { PosCajaComponent } from '../pos-caja/pos-caja.component';
import { CommonModule } from '@angular/common';
import { OrdersService } from 'src/app/services/orders.service';

type RoleName = 'Cajero' | 'Mesero' | 'Gerente' | 'Desconocido';

@Component({
  selector: 'app-pos-shell',
  standalone: true,
  imports: [CommonModule, PosMeseroComponent, PosCajaComponent],
  templateUrl: './pos-shell.component.html',
  styles: [':host { display: block; height: 100%; min-height: 0; }'],
})
export class PosShellComponent implements OnInit {

  roleName: RoleName = 'Desconocido';
  selectedTableId = '';
  selectedTableLabel = '';
  resolvingMeseroEntry = false;
  posReady = true;

  constructor(
    private auth: AuthService,
    private capabilities: CompanyCapabilitiesService,
    private route: ActivatedRoute,
    private orders: OrdersService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.selectedTableId = String(this.route.snapshot.queryParamMap.get('table') || '').trim();
    this.selectedTableLabel = String(this.route.snapshot.queryParamMap.get('table_label') || '').trim();
    if (this.selectedTableId && this.capabilities.activeBusinessId) {
      localStorage.setItem(`mesero_tables_available:${this.capabilities.activeBusinessId}`, '1');
    }
    const me: any = this.auth.getCurrentUser();
    // La variante de Mesero se determina por el contexto funcional, no por
    // un rol Frappe genérico. Así el POS nunca muestra acciones de cobro o
    // facturación cuando solo existen permisos para crear órdenes.
    if (this.capabilities.isEnabled('restaurant')
      && this.capabilities.isEnabled('orders')
      && this.capabilities.hasPermission('restaurant.orders.create')
      && !this.capabilities.hasPermission('billing.create')) {
      this.roleName = 'Mesero';
      console.log('[FacturADA][POS Restaurante][Mesero]', {
        business: this.capabilities.activeBusinessId,
        businessRole: this.capabilities.businessRole,
        permissions: this.capabilities.permissions,
        features: this.capabilities.features,
        selectedTable: this.selectedTableId || null
      });
      if (!this.selectedTableId) {
        this.resolveMeseroEntry();
      }
      return;
    }
    // El rol de negocio del contexto decide la experiencia POS. Los roles
    // Frappe quedan solo como compatibilidad para sesiones antiguas.
    const contextRole = String(this.capabilities.businessRole || '').trim();
    const fallbackRole = Array.isArray(me?.roles)
      ? me.roles.find((role: unknown) => /mesero|cajero|gerente|admin/i.test(String(role || '')))
      : undefined;
    this.roleName = this.mapRawRole(contextRole || String(fallbackRole || ''));
    console.log('[FacturADA][POS Restaurante][variante]', {
      business: this.capabilities.activeBusinessId,
      businessRole: this.capabilities.businessRole,
      resolvedRole: this.roleName,
      permissions: this.capabilities.permissions,
      features: this.capabilities.features
    });

  }

  private resolveMeseroEntry(): void {
    if (!this.capabilities.isEnabled('tables')) {
      this.posReady = true;
      this.resolvingMeseroEntry = false;
      return;
    }
    this.resolvingMeseroEntry = true;
    this.posReady = false;
    this.orders.getTables(true).subscribe({
      next: (response: any) => {
        const message = response?.message ?? response ?? {};
        const tables = Array.isArray(message?.data) ? message.data : [];
        const business = this.capabilities.activeBusinessId || '';
        if (business) {
          localStorage.setItem(`mesero_tables_available:${business}`, tables.length > 0 ? '1' : '0');
        }
        if (tables.length > 0) {
          this.router.navigate(['/dashboard/tables'], { replaceUrl: true });
          return;
        }
        this.posReady = true;
        this.resolvingMeseroEntry = false;
      },
      error: (error: any) => {
        // Si la consulta falla, no bloqueamos el POS del mesero. El backend
        // seguirá validando el negocio y los permisos al crear la orden.
        console.warn('[FacturADA][POS Restaurante][Mesero] No se pudieron consultar mesas', error);
        const business = this.capabilities.activeBusinessId || '';
        if (business) localStorage.setItem(`mesero_tables_available:${business}`, '0');
        this.posReady = true;
        this.resolvingMeseroEntry = false;
      }
    });
  }

  private mapRawRole(raw?: string): RoleName {
    if (!raw) return 'Desconocido';
    const r = raw.toLowerCase();
    if (r.includes('mesero')) return 'Mesero';
    if (r.includes('cajero')) return 'Cajero';
    if (r.includes('gerente') || r.includes('admin')) return 'Gerente';
    return 'Desconocido';
  }
}
