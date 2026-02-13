import { Component, OnInit } from '@angular/core';
import { AuthService } from 'src/app/services/auth.service';
import { PosMeseroComponent } from '../pos-mesero/pos-mesero.component';
import { PosCajaComponent } from '../pos-caja/pos-caja.component';
import { CommonModule } from '@angular/common';

type RoleName = 'Cajero' | 'Mesero' | 'Gerente' | 'Desconocido';

@Component({
  selector: 'app-pos-shell',
  standalone: true,
  imports: [CommonModule,PosMeseroComponent,PosCajaComponent],
  templateUrl: './pos-shell.component.html',

})
export class PosShellComponent implements OnInit {

  roleName: RoleName = 'Desconocido';

  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    const me: any = this.auth.getCurrentUser();
    const rawRole: string | undefined = me?.roles?.[0];
    this.roleName = this.mapRawRole(rawRole);
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