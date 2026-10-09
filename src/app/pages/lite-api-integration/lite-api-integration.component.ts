import { CommonModule } from '@angular/common';
import { Component, DoCheck, OnInit } from '@angular/core';
import { finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CompanyService } from 'src/app/services/company.service';
import { MenuService } from 'src/app/modules/layout/services/menu.service';
import { FiscalSetupHeaderComponent } from 'src/app/shared/components/fiscal-setup-header/fiscal-setup-header.component';
import { fiscalEnvironmentLabel, isActiveFiscalRecord, normalizeFiscalEnvironment } from 'src/app/core/utils/fiscal-setup';

/** Endpoints REST públicos para integraciones (frontend_electronic_states.md · API externa). */
const PUBLIC_ENDPOINTS = [
  { method: 'GET', path: '/api/v1/facturada/invoices/{id_o_clave}/status', description: 'Consultar el estado de una factura' },
  { method: 'POST', path: '/api/v1/facturada/invoices/{id_o_clave}/retry', description: 'Reintentar la emisión de una factura' },
  { method: 'GET', path: '/api/v1/facturada/remission-guides/{id_o_clave}/status', description: 'Consultar el estado de una guía de remisión' },
  { method: 'POST', path: '/api/v1/facturada/remission-guides/{id_o_clave}/retry', description: 'Reintentar la emisión de una guía de remisión' }
] as const;

/**
 * Integración API del negocio activo: URL base, API Clients y guía de conexión.
 * Solo lectura: la Secret Key nunca llega al navegador ni se muestra aquí.
 */
@Component({
  selector: 'app-lite-api-integration',
  standalone: true,
  imports: [CommonModule, FiscalSetupHeaderComponent],
  templateUrl: './lite-api-integration.component.html'
})
export class LiteApiIntegrationComponent implements OnInit, DoCheck {
  configuration: any | null = null;
  loading = false;
  error = '';
  accessDenied = false;
  readonly endpoints = PUBLIC_ENDPOINTS;
  readonly environmentLabel = fiscalEnvironmentLabel;
  private loadedBusiness = '';

  constructor(
    private readonly companyService: CompanyService,
    private readonly capabilities: CompanyCapabilitiesService,
    private readonly menuService: MenuService,
    private readonly frappeError: FrappeErrorService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngDoCheck(): void {
    if (this.activeBusinessId !== this.loadedBusiness && !this.loading) this.load();
  }

  get activeBusinessId(): string {
    return String(this.capabilities.activeBusinessId || localStorage.getItem('active_business') || '').trim();
  }

  get enabled(): boolean {
    return this.configuration?.enabled === true;
  }

  get canView(): boolean {
    return !this.accessDenied && this.configuration?.can_view !== false;
  }

  get clients(): any[] {
    return Array.isArray(this.configuration?.clients) ? this.configuration.clients : [];
  }

  get activeClients(): number {
    return this.clients.filter((client) => isActiveFiscalRecord(client)).length;
  }

  get productionClients(): number {
    return this.clients.filter((client) => this.isProduction(client)).length;
  }

  isProduction(client: any): boolean {
    return normalizeFiscalEnvironment(client?.environment) === 'Produccion';
  }

  isActive(client: any): boolean {
    return isActiveFiscalRecord(client);
  }

  /** Recarga el contexto del negocio activo y reemplaza por completo la configuración API. */
  load(): void {
    const business = this.activeBusinessId;
    this.loadedBusiness = business;
    this.configuration = null;
    this.error = '';
    this.accessDenied = false;
    // Evita mostrar una configuración cacheada de otro negocio mientras carga.
    this.capabilities.setApiConfiguration(null);
    if (!business) {
      this.error = 'Selecciona un negocio para ver su integración API.';
      return;
    }

    this.loading = true;
    this.companyService.getLiteContext(business).pipe(finalize(() => { this.loading = false; })).subscribe({
      next: (context: any) => {
        // Ignora respuestas tardías de otra empresa.
        const responseBusiness = context?.business;
        const responseId = typeof responseBusiness === 'string' ? responseBusiness : responseBusiness?.name || responseBusiness?.business;
        if (responseId && String(responseId).trim() !== this.activeBusinessId) return;
        const fromContext = context?.api_configuration ?? context?.data?.api_configuration;
        if (fromContext !== undefined) this.capabilities.setApiConfiguration(fromContext);
        // El servicio sanitiza la configuración: nunca conserva un secret_key.
        const configuration = this.capabilities.apiConfiguration;
        this.configuration = configuration && typeof configuration === 'object'
          ? configuration
          : { enabled: false, can_view: false, clients: [] };
        this.refreshMenu();
      },
      error: (error: any) => {
        this.capabilities.setApiConfiguration(null);
        this.accessDenied = Number(error?.status || error?.error?.status || 0) === 403;
        this.error = this.accessDenied
          ? ''
          : (this.frappeError.handle(error) || 'No se pudo cargar la configuración API.');
      }
    });
  }

  async copy(value: unknown, label: string): Promise<void> {
    const text = String(value ?? '').trim();
    if (!text) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard) {
      toast.error('El navegador no permite copiar; selecciona el texto manualmente.');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiada.`);
    } catch {
      toast.error(`No se pudo copiar la ${label.toLowerCase()}.`);
    }
  }

  trackByClient = (index: number, client: any): string => String(client?.name || client?.api_key || index);

  /** La visibilidad del menú depende de la configuración API recién cargada. */
  private refreshMenu(): void {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      this.menuService.setMenuForRoles(Array.isArray(user?.roles) ? user.roles : []);
    } catch {
      // Sin perfil local el contexto sigue disponible.
    }
  }
}
