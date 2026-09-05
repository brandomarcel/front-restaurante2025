import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { PosMeseroComponent } from '../pos-mesero/pos-mesero.component';
import { PosCajaComponent } from '../pos-caja/pos-caja.component';
import { CommonModule } from '@angular/common';

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

  constructor(
    private auth: AuthService,
    private capabilities: CompanyCapabilitiesService
  ) {}

  ngOnInit(): void {
    const me: any = this.auth.getCurrentUser();
    // El rol de negocio del contexto decide la experiencia POS. Los roles
    // Frappe quedan solo como compatibilidad para sesiones antiguas.
    const contextRole = String(this.capabilities.businessRole || '').trim();
    const fallbackRole = Array.isArray(me?.roles)
      ? me.roles.find((role: unknown) => /mesero|cajero|gerente|admin/i.test(String(role || '')))
      : undefined;
    this.roleName = this.mapRawRole(contextRole || String(fallbackRole || ''));
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
