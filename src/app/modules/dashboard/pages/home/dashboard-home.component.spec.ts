import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CompanyCapabilitiesService, CompanyFeatureKey } from 'src/app/core/services/company-capabilities.service';
import { CompanyService } from 'src/app/services/company.service';
import { FacturadaLiteDashboardService, LiteDashboard } from 'src/app/services/facturada-lite-dashboard.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { OrdersService } from 'src/app/services/orders.service';
import { DashboardScreen } from '../../dashboard.models';
import { DashboardHomeComponent } from './dashboard-home.component';

interface Scenario {
  screen: DashboardScreen | null;
  features: Partial<Record<CompanyFeatureKey, boolean>>;
  permissions: string[];
}

/** Doble mínimo del servicio de capacidades con lo que usa el dashboard. */
class FakeCapabilities {
  activeBusinessId = 'BUS-1';
  activeBusiness = { name: 'BUS-1', business_name: 'Negocio de prueba' };
  business = this.activeBusiness;
  plan = null;
  usesPosTerminalModel = false;
  needsPosTerminalSelection = false;
  isRestaurantCashier = false;
  isRetailCashier = false;
  isGeneralCashier = false;
  liteSetupReady = true;
  liteSetupMissing: string[] = [];
  sequences: any[] = [];
  apiConfiguration = null;
  setFromResponse = jasmine.createSpy('setFromResponse');
  setLiteSetupState = jasmine.createSpy('setLiteSetupState');

  constructor(private scenario: Scenario) {}

  get dashboardScreen(): DashboardScreen | null { return this.scenario.screen; }
  get isApiOnlyMode(): boolean { return !!this.scenario.features.api && !this.scenario.features.billing && !this.scenario.features.restaurant; }
  isEnabled(feature: CompanyFeatureKey): boolean { return this.scenario.features[feature] === true; }
  hasPermission(permission: string): boolean {
    return this.scenario.permissions.includes('*') || this.scenario.permissions.includes(permission);
  }
}

const LITE_DASHBOARD: LiteDashboard = {
  business: 'BUS-1',
  sales: { invoice_count: 2, authorized_count: 2, pending_count: 0, rejected_count: 0, canceled_count: 0, sales_total: 50, collected_total: 50 },
  plan: null,
  inventory: { tracked_items: 0, low_stock_items: 0, out_of_stock_items: [] },
  recent_invoices: []
};

const SETUP = { business: { name: 'BUS-1', business_name: 'Negocio de prueba' }, tax_profile: { has_certificate_password: 1, certificate_valid_to: '2099-01-01' } };

describe('DashboardHomeComponent', () => {
  let fixture: ComponentFixture<DashboardHomeComponent>;
  let orders: jasmine.SpyObj<OrdersService>;
  let lite: jasmine.SpyObj<FacturadaLiteDashboardService>;
  let company: jasmine.SpyObj<CompanyService>;

  async function render(scenario: Scenario): Promise<HTMLElement> {
    orders = jasmine.createSpyObj<OrdersService>('OrdersService', ['get_dashboard_metrics']);
    orders.get_dashboard_metrics.and.returnValue(of({
      message: { data: { dashboard_type: scenario.features.restaurant ? 'restaurant' : 'pos', total_orders_today: 1, total_sales_today: 10, cash: { is_open: true } } }
    }));
    lite = jasmine.createSpyObj<FacturadaLiteDashboardService>('FacturadaLiteDashboardService', ['getDashboard']);
    lite.getDashboard.and.returnValue(of(LITE_DASHBOARD));
    company = jasmine.createSpyObj<CompanyService>('CompanyService', ['getLiteSetup', 'get_empresa']);
    company.getLiteSetup.and.returnValue(of(SETUP));
    company.get_empresa.and.returnValue(of({ message: {} }));
    const inventory = jasmine.createSpyObj<InventoryService>('InventoryService', ['getStockSummary']);
    inventory.getStockSummary.and.returnValue(of({}));

    await TestBed.configureTestingModule({
      imports: [DashboardHomeComponent],
      providers: [
        provideRouter([]),
        { provide: CompanyCapabilitiesService, useValue: new FakeCapabilities(scenario) },
        { provide: OrdersService, useValue: orders },
        { provide: FacturadaLiteDashboardService, useValue: lite },
        { provide: CompanyService, useValue: company },
        { provide: InventoryService, useValue: inventory }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardHomeComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('Restaurante: carga métricas operativas y refresca el contexto, sin dashboard Lite', async () => {
    const element = await render({ screen: 'business_overview', features: { restaurant: true, pos: true, orders: true }, permissions: ['*'] });
    expect(company.get_empresa).toHaveBeenCalled();
    expect(company.getLiteSetup).toHaveBeenCalled();
    expect(orders.get_dashboard_metrics).toHaveBeenCalledTimes(1);
    expect(lite.getDashboard).not.toHaveBeenCalled();
    expect(element.querySelector('app-operations-panel')).not.toBeNull();
    expect(element.textContent).toContain('Firma: Al día');
  });

  it('Solo facturación: carga comprobantes y no consulta métricas de POS', async () => {
    const element = await render({ screen: 'billing_overview', features: { billing: true, direct_invoice: true }, permissions: ['billing.read', 'reports.view'] });
    expect(lite.getDashboard).toHaveBeenCalledTimes(1);
    expect(orders.get_dashboard_metrics).not.toHaveBeenCalled();
    expect(company.get_empresa).not.toHaveBeenCalled();
    expect(element.querySelector('app-billing-panel')).not.toBeNull();
  });

  it('Administrador con POS y facturación: turno más comprobantes del mes', async () => {
    const element = await render({ screen: 'business_overview', features: { billing: true, pos: true, generic_pos: true, cash_register: true }, permissions: ['*'] });
    expect(orders.get_dashboard_metrics).toHaveBeenCalledTimes(1);
    expect(lite.getDashboard).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('Comprobantes electrónicos del mes');
    expect(element.querySelector('app-operations-panel')).not.toBeNull();
  });

  it('Mesero: accesos de salón sin consultar reportes', async () => {
    const element = await render({
      screen: 'restaurant_service',
      features: { restaurant: true, pos: true, orders: true, tables: true },
      permissions: ['restaurant.orders.create', 'restaurant.orders.read']
    });
    expect(orders.get_dashboard_metrics).not.toHaveBeenCalled();
    expect(lite.getDashboard).not.toHaveBeenCalled();
    expect(element.querySelector('app-service-panel')).not.toBeNull();
    expect(element.textContent).toContain('Tomar pedido');
    expect(element.textContent).not.toContain('Firma:');
  });

  it('Cocina: redirige a la pantalla en tiempo real', async () => {
    const navigate = spyOn(Router.prototype, 'navigate').and.resolveTo(true);
    await render({ screen: 'kitchen_board', features: { restaurant: true, kitchen: true }, permissions: ['restaurant.orders.read'] });
    expect(navigate).toHaveBeenCalledWith(['/dashboard/orders-realtime']);
    expect(company.getLiteSetup).not.toHaveBeenCalled();
  });

  it('recarga las métricas cuando cambia la operación del restaurante', async () => {
    await render({ screen: 'cashier_shift', features: { restaurant: true, pos: true, orders: true }, permissions: ['reports.view'] });
    window.dispatchEvent(new CustomEvent('facturada:restaurant-data-changed'));
    expect(orders.get_dashboard_metrics).toHaveBeenCalledTimes(2);
  });

  afterEach(() => fixture?.destroy());
});
