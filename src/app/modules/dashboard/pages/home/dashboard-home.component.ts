import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Observable, Subject, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { CompanyService } from 'src/app/services/company.service';
import { FacturadaLiteDashboardService, LiteDashboard } from 'src/app/services/facturada-lite-dashboard.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { OrdersService } from 'src/app/services/orders.service';
import { Aviso, AvisosComponent } from 'src/app/shared/components/avisos/avisos.component';
import { ApiPanelComponent } from '../../components/api-panel/api-panel.component';
import { BillingKpisComponent } from '../../components/billing-kpis/billing-kpis.component';
import { BillingPanelComponent } from '../../components/billing-panel/billing-panel.component';
import { DashboardHeroComponent } from '../../components/dashboard-hero/dashboard-hero.component';
import { CashierExperience, OperationsPanelComponent } from '../../components/operations-panel/operations-panel.component';
import { PlanUsageCardComponent } from '../../components/plan-usage-card/plan-usage-card.component';
import { ServicePanelComponent } from '../../components/service-panel/service-panel.component';
import { DashboardLayout, resolveDashboardLayout } from '../../dashboard-view';
import {
  CompanySummary,
  OperationsKind,
  OperationsMetrics,
  PlanSummary,
  RetailStockSummary,
  SignatureStatus
} from '../../dashboard.models';
import { parseCompanySummary, signatureStatus } from '../../utils/company-summary';
import { buildDashboardAlerts } from '../../utils/dashboard-alerts';
import { isRecord, toIsoDate, toNumber } from '../../utils/dashboard-values';
import { normalizeOperationsMetrics } from '../../utils/operations-metrics';
import { buildPlanSummary } from '../../utils/plan-summary';

interface HeroCopy {
  modeLabel: string;
  title: string;
  subtitle: string;
  gradient: string;
}

type OperationsResult = { metrics: OperationsMetrics } | { error: unknown };

/**
 * Pantalla principal (`/dashboard/main`). Decide el panel con
 * `resolveDashboardLayout` y solo consulta los endpoints de ese panel.
 */
@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    AvisosComponent,
    DashboardHeroComponent,
    PlanUsageCardComponent,
    OperationsPanelComponent,
    BillingKpisComponent,
    BillingPanelComponent,
    ApiPanelComponent,
    ServicePanelComponent
  ],
  templateUrl: './dashboard-home.component.html'
})
export class DashboardHomeComponent implements OnInit, OnDestroy {
  layout: DashboardLayout = { view: 'none', billingSummary: false };
  /** Evita mostrar "Sin panel disponible" mientras se carga la empresa. */
  ready = false;
  company: CompanySummary | null = null;
  signature: SignatureStatus = signatureStatus(null);
  plan: PlanSummary | null = null;
  userName = 'Equipo';
  avisos: Aviso[] = [];

  operationsMetrics: OperationsMetrics | null = null;
  operationsLoading = false;
  operationsError = '';
  needsTerminal = false;
  retailStock: RetailStockSummary | null = null;

  liteDashboard: LiteDashboard | null = null;
  liteLoading = false;
  liteError = '';
  fromDate = '';
  toDate = '';

  private alertCounter = 0;
  private readonly destroy$ = new Subject<void>();
  private readonly operationsLoad$ = new Subject<void>();
  private readonly liteLoad$ = new Subject<void>();
  /** Cobros, facturas, aperturas y cierres cambian las ventas y la caja del turno. */
  private readonly onRestaurantDataChanged = () => {
    if (this.layout.view === 'operations') this.loadOperations();
  };

  constructor(
    public capabilities: CompanyCapabilitiesService,
    private companyService: CompanyService,
    private ordersService: OrdersService,
    private liteDashboardService: FacturadaLiteDashboardService,
    private inventoryService: InventoryService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userName = this.readUserName();
    this.layout = this.resolveLayout();
    if (this.redirectKitchen()) return;

    this.operationsLoad$.pipe(
      tap(() => {
        this.operationsLoading = true;
        this.operationsError = '';
      }),
      switchMap(() => this.fetchOperations()),
      takeUntil(this.destroy$)
    ).subscribe((result) => this.applyOperations(result));

    this.liteLoad$.pipe(
      tap(() => {
        this.liteLoading = true;
        this.liteError = '';
      }),
      switchMap(() => this.liteDashboardService
        .getDashboard(this.fromDate, this.toDate, this.capabilities.activeBusinessId || undefined)
        .pipe(
          map((dashboard): LiteDashboard | Error => dashboard),
          catchError((error) => of(new Error(this.readErrorMessage(error, 'No se pudo cargar el resumen de comprobantes.'))))
        )),
      takeUntil(this.destroy$)
    ).subscribe((result) => {
      this.liteLoading = false;
      if (result instanceof Error) {
        this.liteDashboard = null;
        this.liteError = result.message;
      } else {
        this.liteDashboard = result;
      }
      this.refreshPlan();
      this.refreshAlerts();
    });

    window.addEventListener('facturada:restaurant-data-changed', this.onRestaurantDataChanged);
    this.loadCompanyAndView();
  }

  ngOnDestroy(): void {
    window.removeEventListener('facturada:restaurant-data-changed', this.onRestaurantDataChanged);
    this.destroy$.next();
    this.destroy$.complete();
  }

  get businessName(): string {
    const business = this.capabilities.activeBusiness || {};
    return String(
      this.company?.name || business.business_name || business.businessname || business.name || 'Empresa activa'
    );
  }

  get logo(): string | null {
    return this.capabilities.activeBusiness?.logo || null;
  }

  /** La caja aplica a Restaurante y a POS con `cash_register`. */
  get showCash(): boolean {
    return this.capabilities.isEnabled('restaurant') || this.capabilities.isEnabled('cash_register');
  }

  /** El Cajero ve su turno; el plan interesa a quien administra o factura. */
  get showPlanCard(): boolean {
    if (this.layout.view === 'billing') return true;
    return this.layout.view === 'operations' && this.capabilities.dashboardScreen !== 'cashier_shift';
  }

  get heroCashOpen(): boolean | null {
    if (this.layout.view !== 'operations' || !this.showCash || !this.operationsMetrics) return null;
    return this.operationsMetrics.cash.isOpen;
  }

  get cashierExperience(): CashierExperience | null {
    if (this.capabilities.isRestaurantCashier) return 'Restaurante';
    if (this.capabilities.isRetailCashier) return 'Retail';
    if (this.capabilities.isGeneralCashier) return 'General';
    return null;
  }

  get hero(): HeroCopy {
    switch (this.layout.view) {
      case 'api':
        return {
          modeLabel: 'FacturADA API',
          title: 'Panel API',
          subtitle: 'Consumo de API, comprobantes y configuración tributaria',
          gradient: 'from-slate-950 via-slate-700 to-cyan-700'
        };
      case 'billing':
        return {
          modeLabel: 'FacturADA Lite',
          title: 'Panel de facturación',
          subtitle: 'Facturación electrónica, clientes y documentos',
          gradient: 'from-slate-950 via-violet-700 to-primary'
        };
      case 'service':
        return {
          modeLabel: 'Mesero',
          title: 'Panel de salón',
          subtitle: 'Mesas y pedidos del turno',
          gradient: 'from-slate-950 via-primary to-sky-700'
        };
      default:
        return this.operationsHero();
    }
  }

  onPeriodChange(): void {
    if (!this.fromDate || !this.toDate || this.fromDate > this.toDate) return;
    this.liteLoad$.next();
  }

  refreshLite(): void {
    this.liteLoad$.next();
  }

  removeAlert(id: string): void {
    this.avisos = this.avisos.filter((aviso) => aviso.id !== id);
  }

  private operationsHero(): HeroCopy {
    const restaurant = this.operationsKind === 'restaurant';
    const gradient = restaurant ? 'from-slate-950 via-primary to-sky-700' : 'from-slate-950 via-violet-700 to-primary';
    const experience = this.cashierExperience;
    if (experience) {
      const subtitles: Record<CashierExperience, string> = {
        Restaurante: 'Turno de caja, mesas y comandas del restaurante',
        Retail: 'Turno de caja, ventas y stock de tienda',
        General: 'Turno de caja y ventas del punto de venta'
      };
      return { modeLabel: `Cajero · ${experience}`, title: `Panel de Cajero · ${experience}`, subtitle: subtitles[experience], gradient };
    }
    return restaurant
      ? { modeLabel: 'Restaurante', title: 'Panel operativo', subtitle: 'Operación del restaurante, caja y órdenes', gradient }
      : { modeLabel: 'Punto de venta', title: 'Panel operativo', subtitle: 'Ventas del punto de venta, caja y comprobantes', gradient };
  }

  private get operationsKind(): OperationsKind {
    return this.capabilities.isEnabled('restaurant') ? 'restaurant' : 'pos';
  }

  private resolveLayout(): DashboardLayout {
    return resolveDashboardLayout({
      screen: this.capabilities.dashboardScreen,
      restaurant: this.capabilities.isEnabled('restaurant'),
      pos: this.capabilities.isEnabled('pos'),
      billing: this.capabilities.isEnabled('billing'),
      apiOnly: this.capabilities.isApiOnlyMode
    });
  }

  /** Cocina tiene su propia pantalla en tiempo real. */
  private redirectKitchen(): boolean {
    if (this.layout.view !== 'kitchen') return false;
    this.router.navigate(['/dashboard/orders-realtime']);
    return true;
  }

  /**
   * `get_lite_setup` trae la firma (el contexto de usuario no la incluye).
   * En Restaurante además se refresca el contexto, como hacía el panel anterior.
   */
  private loadCompanyAndView(): void {
    const business = this.capabilities.activeBusinessId || undefined;
    const setup$ = this.companyService.getLiteSetup(business).pipe(catchError(() => of(null)));
    const refreshContext = !business || this.capabilities.isEnabled('restaurant');
    const context$: Observable<unknown> = refreshContext
      ? this.companyService.get_empresa(business).pipe(catchError(() => of(null)))
      : of(null);

    forkJoin({ setup: setup$, context: context$ })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ setup, context }) => {
        if (context) this.capabilities.setFromResponse(context);
        if (setup) this.capabilities.setLiteSetupState(setup);
        this.company = parseCompanySummary(setup);
        this.signature = signatureStatus(this.company);
        this.layout = this.resolveLayout();
        this.refreshPlan();
        this.ready = true;
        if (this.redirectKitchen()) return;
        this.loadViewData();
      });
  }

  private loadViewData(): void {
    const { view, billingSummary } = this.layout;
    if (view === 'operations') this.loadOperations();
    if (view === 'billing' || view === 'api' || billingSummary) {
      if (!this.fromDate || !this.toDate) this.initializeMonthRange();
      this.liteLoad$.next();
    }
    this.refreshAlerts();
  }

  /**
   * Un operativo con varios terminales debe elegir uno para ver su turno;
   * Gerente/Administrador ven el agregado del negocio.
   */
  private loadOperations(): void {
    const isManager = this.capabilities.hasPermission('*')
      || this.capabilities.hasPermission('restaurant.manage')
      || this.capabilities.hasPermission('billing.manage');
    this.needsTerminal = this.capabilities.usesPosTerminalModel
      && this.capabilities.needsPosTerminalSelection
      && !isManager;
    if (this.needsTerminal) {
      this.refreshAlerts();
      return;
    }
    this.operationsLoad$.next();
    if (this.capabilities.isRetailCashier && this.capabilities.isEnabled('inventory')) this.loadRetailStock();
  }

  private fetchOperations(): Observable<OperationsResult> {
    const kind = this.operationsKind;
    return this.ordersService.get_dashboard_metrics().pipe(
      map((response): OperationsResult => ({ metrics: normalizeOperationsMetrics(response, kind) })),
      catchError((error) => of({ error }))
    );
  }

  private applyOperations(result: OperationsResult): void {
    this.operationsLoading = false;
    if ('metrics' in result) {
      this.operationsMetrics = result.metrics;
    } else {
      this.operationsMetrics = null;
      this.operationsError = this.isTerminalError(result.error)
        ? 'Selecciona un terminal POS válido para ver las métricas.'
        : 'No se pudieron cargar las métricas del dashboard.';
    }
    this.refreshAlerts();
  }

  /** Bajo stock y agotados de la bodega activa, solo para el Cajero Retail. */
  private loadRetailStock(): void {
    this.retailStock = { loading: true, lowStock: 0, outOfStock: 0 };
    this.inventoryService.getStockSummary().pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        const data = response?.message?.data ?? response?.data ?? response ?? {};
        const products: any[] = Array.isArray(data?.products) ? data.products : (Array.isArray(data) ? data : []);
        const outOfStock = data?.out_of_stock_items ?? data?.out_of_stock_products;
        this.retailStock = {
          loading: false,
          lowStock: toNumber(data?.low_stock_items ?? data?.low_stock_products ?? products.filter((item) => item?.is_low_stock).length),
          outOfStock: Array.isArray(outOfStock)
            ? outOfStock.length
            : toNumber(outOfStock ?? products.filter((item) => item?.is_out_of_stock).length)
        };
      },
      error: () => {
        this.retailStock = { loading: false, lowStock: 0, outOfStock: 0 };
      }
    });
  }

  private refreshPlan(): void {
    this.plan = buildPlanSummary(this.capabilities.plan, this.liteDashboard?.plan ?? null);
  }

  private refreshAlerts(): void {
    const metrics = this.operationsMetrics;
    const cashClosed = this.layout.view === 'operations'
      && this.showCash
      && !!metrics
      && !metrics.cash.isOpen;
    this.avisos = buildDashboardAlerts({
      view: this.layout.view,
      signature: this.signature,
      cashClosed,
      billingError: this.liteError
    }).map((alert) => ({ ...alert, id: `aviso_${this.alertCounter++}`, fecha: new Date() }));
  }

  private initializeMonthRange(): void {
    const now = new Date();
    this.fromDate = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));
    this.toDate = toIsoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  }

  private isTerminalError(error: any): boolean {
    const message = String(
      error?.error?._server_messages ?? error?.error?.message ?? error?.error?.exc ?? error?.message ?? ''
    ).toLowerCase();
    return message.includes('terminal');
  }

  private readErrorMessage(error: any, fallback: string): string {
    const message = error?.error?.message ?? error?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
  }

  private readUserName(): string {
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      return isRecord(user) && user['fullName'] ? String(user['fullName']) : 'Equipo';
    } catch {
      return 'Equipo';
    }
  }
}
