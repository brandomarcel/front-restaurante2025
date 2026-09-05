import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { OrdersService } from '../../../../services/orders.service';
import { CajasService } from 'src/app/services/cajas.service';
import { CompanyService } from '../../../../services/company.service';
import { UserData } from 'src/app/core/models/user_data';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { isNullOrEmpty } from 'src/app/shared/utils/validation';
import { AvisosComponent } from "src/app/shared/components/avisos/avisos.component";
import { diasRestantes } from 'src/app/shared/utils/date.utils';
import { NgApexchartsModule } from 'ng-apexcharts';
import { BusinessMode, CompanyCapabilitiesService, CompanyFeatureKey, CompanyPlan } from 'src/app/core/services/company-capabilities.service';
import { FacturadaLiteDashboardService, LiteDashboard, LiteDashboardPlan } from 'src/app/services/facturada-lite-dashboard.service';

// Interfaz para los avisos
interface Aviso {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: 'error' | 'warning' | 'info' | 'success';
  fecha: Date;
}

interface CompanyData {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  environment?: string;
  firma?: boolean;
  certificateStatus?: string;
  cert_not_after?: string;
  cert_not_before?: string;
}

type DashboardAction = {
  label: string;
  detail: string;
  route: string;
  tone: string;
  feature?: CompanyFeatureKey;
  requiresEmission?: boolean;
};

@Component({
  selector: 'app-nft',
  templateUrl: './nft.component.html',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AvisosComponent, NgApexchartsModule]
})
export class NftComponent implements OnInit, OnDestroy {

  // Métricas
  totalOrdersToday = 0;
  total_sales_today = 0;
  idApertura:string = '';
  montoApertura = 0;
  totalRetiros = 0;
  efectivoSistema = 0;
  efectivoEsperadoBackend = 0;
  cashIsOpen = false;
  cashPayments: Record<string, unknown> = {};
  topProducts: any[] = [];
  today = new Date();
  certDaysLeft: number | null = null;
  businessMode: BusinessMode = 'RESTAURANTE';
  currentPlan: CompanyPlan | null = null;

  liteDashboard: LiteDashboard | null = null;
  liteDashboardLoading = false;
  liteDashboardError = '';
  liteFromDate = '';
  liteToDate = '';

  // Nuevas propiedades
  userData?: UserData | null;
  companyData?: CompanyData;
  avisos: Aviso[] = [];
  topProductsBarOptions: any = null;
  cashFlowDonutOptions: any = null;
  moneyBarsOptions: any = null;

  private destroy$ = new Subject<void>();
  private avisoCounter = 0;
  private cashDataRequested = false;

  constructor(
    private ordersService: OrdersService,
    private cajasService: CajasService,
    private companyService: CompanyService,
    private capabilities: CompanyCapabilitiesService,
    private liteDashboardService: FacturadaLiteDashboardService
  ) { }

  ngOnInit(): void {
    this.businessMode = this.capabilities.businessMode;
    this.currentPlan = this.capabilities.plan;
    this.actualizarVisualizaciones();
    this.loadData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadData() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    this.userData = user;

    const activeBusiness = this.capabilities.activeBusinessId
      || localStorage.getItem('active_business')
      || localStorage.getItem('businessId')
      || undefined;
    // El certificado pertenece al perfil tributario de FacturADA Business.
    // También en Restaurante se obtiene de get_lite_setup, no del contexto
    // reducido de usuario que puede omitir certificate_reference.
    const companyRequest = activeBusiness
      ? this.companyService.getLiteSetup(activeBusiness)
      : this.companyService.get_empresa(activeBusiness);

    companyRequest
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: async (empresa: any) => {
          if (activeBusiness) this.capabilities.setLiteSetupState(empresa);
          else this.capabilities.setFromResponse(empresa);
          this.businessMode = this.capabilities.businessMode;
          this.currentPlan = this.capabilities.plan;
          this.procesarEmpresa(empresa);

          if (this.isBillingDashboard) {
            this.initializeLiteDateRange();
            await this.loadLiteDashboard();
            this.actualizarVisualizaciones();
            this.generarAvisos();
            return;
          }

          try {
            const dashboard = await firstValueFrom(this.ordersService.get_dashboard_metrics());
            this.procesarDashboard(dashboard);
          } catch (error) {
            console.error('Error al obtener métricas:', error);
          }

          if (this.isRestaurantMode && !this.idApertura) {
            await this.getDatosCierre();
          }
          this.generarAvisos();
        },
        error: (err: any) => {
          console.error('Error al obtener datos:', err);
        }
      });

  }
  async getDatosCierre() {
    if (this.cashDataRequested || this.isFacturadorMode) return;
    this.cashDataRequested = true;

    try {
      const userEmail: string = String(this.userData?.email || '');
      const resp: any = await firstValueFrom(this.cajasService.getDatosCierre(userEmail));
      const data = resp?.message || {};
      this.idApertura = data.apertura;
      this.cashIsOpen = data.is_open === true || !!data.apertura;
      this.montoApertura = data.monto_apertura || 0;
      this.totalRetiros = data.total_retiros || 0;
      this.efectivoSistema = data.efectivo_sistema || 0;
      this.efectivoEsperadoBackend = this.dashboardNumber(data.expected_cash ?? data.efectivo_esperado);
      this.cashPayments = data.payments && typeof data.payments === 'object' ? data.payments : {};
      this.actualizarVisualizaciones();
    } catch (error) {
      console.error('Error cargando datos de caja:', error);
    }
  }

  async loadLiteDashboard(): Promise<void> {
    if (this.isRestaurantMode) return;
    if (!this.liteFromDate || !this.liteToDate) this.initializeLiteDateRange();

    this.liteDashboardLoading = true;
    this.liteDashboardError = '';
    try {
      this.liteDashboard = await firstValueFrom(this.liteDashboardService.getDashboard(
        this.liteFromDate,
        this.liteToDate,
        this.capabilities.businessId || undefined
      ));
      this.actualizarLiteMetrics();
    } catch (error: any) {
      this.liteDashboard = null;
      this.liteDashboardError = this.readLiteDashboardError(error);
    } finally {
      this.liteDashboardLoading = false;
      this.generarAvisos();
    }
  }

  onLiteDateChange(): void {
    if (!this.liteFromDate || !this.liteToDate || this.liteFromDate > this.liteToDate) return;
    void this.loadLiteDashboard();
  }

  private initializeLiteDateRange(): void {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    this.liteFromDate = this.toIsoDate(firstDay);
    this.liteToDate = this.toIsoDate(lastDay);
  }

  private toIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private actualizarLiteMetrics(): void {
    const sales = this.liteDashboard?.sales;
    if (!sales) return;
    this.totalOrdersToday = sales.invoice_count;
    this.total_sales_today = sales.sales_total;
  }

  private readLiteDashboardError(error: any): string {
    const message = error?.error?.message;
    if (typeof message === 'string' && message.trim()) return message;
    if (typeof error?.message === 'string' && error.message.trim()) return error.message;
    return 'No se pudo cargar el dashboard. Verifica la conexión e inténtalo nuevamente.';
  }

  private procesarDashboard(response: any): void {
    try {
      // Frappe puede entregar el resultado como message.data o directamente
      // en message. El endpoint nuevo de Restaurante usa ambos formatos
      // según la versión instalada.
      const envelope = response?.message ?? response ?? {};
      const payload = envelope?.data && typeof envelope.data === 'object'
        ? envelope.data
        : (envelope?.dashboard ?? envelope?.metrics ?? envelope);
      const data = payload?.dashboard && typeof payload.dashboard === 'object'
        ? payload.dashboard
        : (payload?.metrics && typeof payload.metrics === 'object' ? payload.metrics : payload);
      if (data?.dashboard_type && String(data.dashboard_type).toLowerCase() !== 'restaurant') {
        return;
      }
      const sales = data?.sales && typeof data.sales === 'object' ? data.sales : {};
      const orders = data?.orders && typeof data.orders === 'object' ? data.orders : {};
      const cash = data?.cash && typeof data.cash === 'object' ? data.cash : {};
      const rawTopProducts = data?.top_products
        ?? data?.topProducts
        ?? data?.top_productos
        ?? data?.top_productos_vendidos
        ?? data?.top_selling_products
        ?? data?.product_sales
        ?? data?.products
        ?? [];

      this.totalOrdersToday = this.dashboardNumber(
        data?.total_orders_today
        ?? data?.orders_today
        ?? data?.orders_count
        ?? data?.total_orders
        ?? orders.today
        ?? orders.count
        ?? orders.total_orders
        ?? orders.today_count
        ?? sales.orders_count
        ?? 0
      );
      this.total_sales_today = this.dashboardNumber(
        data?.total_sales_today
        ?? data?.sales_today
        ?? data?.total_sales
        ?? data?.sales_total
        ?? sales.sales_total
        ?? sales.total_sales
        ?? sales.total_ventas
        ?? sales.total
        ?? 0
      );
      this.topProducts = Array.isArray(rawTopProducts)
        ? rawTopProducts.map((product: any) => ({
            ...product,
            name: product?.name
              ?? product?.item_name
              ?? product?.product_name
              ?? product?.producto
              ?? product?.product
              ?? 'Sin nombre',
            count: this.dashboardNumber(
              product?.count
              ?? product?.quantity
              ?? product?.qty
              ?? product?.cantidad
              ?? product?.cantidad_vendida
              ?? product?.quantity_sold
              ?? product?.units_sold
              ?? product?.total_qty
              ?? product?.units
              ?? 0
            )
          }))
        : [];
      // El backend ya separa efectivo de tarjeta/transferencia y devuelve el
      // valor correcto. No recalcular expected_cash con total_sales_today.
      this.cashIsOpen = cash.is_open === true || cash.is_open === 1 || `${cash.is_open ?? ''}`.trim() === '1' || `${cash.is_open ?? ''}`.toLowerCase() === 'true';
      this.montoApertura = this.dashboardNumber(cash.monto_apertura);
      this.totalRetiros = this.dashboardNumber(cash.total_retiros);
      this.efectivoSistema = this.dashboardNumber(cash.efectivo_sistema);
      this.efectivoEsperadoBackend = this.dashboardNumber(cash.expected_cash);
      this.cashPayments = cash.payments && typeof cash.payments === 'object' ? cash.payments : {};
      if (!this.cashIsOpen) this.idApertura = '';
      this.actualizarVisualizaciones();
    } catch (error) {
      console.error('Error procesando dashboard:', error);
    }
  }

  private dashboardNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  procesarEmpresa(data: any) {
    try {
      const resp = data?.message ?? data;
      if (resp) {
        const business = resp?.business && typeof resp.business === 'object'
          ? resp.business
          : resp;
        const taxProfile = resp?.tax_profile && typeof resp.tax_profile === 'object'
          ? resp.tax_profile
          : (business?.tax_profile && typeof business.tax_profile === 'object' ? business.tax_profile : {});
        const certificateReference = taxProfile.certificate_reference
          ?? business.urlfirma
          ?? business.certificate_reference
          ?? resp.certificate_reference;
        const certificateStatus = String(
          taxProfile.certificate_status
          ?? business.certificate_status
          ?? resp.certificate_status
          ?? ''
        ).trim();
        const hasCertificatePassword = taxProfile.has_certificate_password;
        const certificateConfigured = hasCertificatePassword !== undefined && hasCertificatePassword !== null
          ? hasCertificatePassword === true || hasCertificatePassword === 1 || `${hasCertificatePassword}`.trim() === '1' || `${hasCertificatePassword}`.toUpperCase().trim() === 'TRUE'
          : !isNullOrEmpty(certificateReference);
        const normalizedCertificateStatus = certificateStatus
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toUpperCase();
        const unavailableCertificate = ['NO CONFIGURADO', 'VENCIDO', 'NO VIGENTE', 'ERROR DE LECTURA'].includes(normalizedCertificateStatus);
        this.companyData = {
          name: business.businessname || business.business_name || business.trade_name || business.legal_name || business.name || 'Sin nombre',
          phone: taxProfile.phone || business.phone,
          email: taxProfile.email || business.email,
          address: taxProfile.main_address || business.address || business.main_address,
          environment: taxProfile.environment || taxProfile.ambiente || business.environment || business.ambiente,
          firma: !certificateConfigured || unavailableCertificate,
          certificateStatus,
          cert_not_after: taxProfile.certificate_valid_to || business.cert_not_after,
          cert_not_before: taxProfile.certificate_valid_from || business.cert_not_before

        };
      }
    } catch (error) {
      console.error('Error procesando empresa:', error);
    }
  }

  private procesarCierre(resp: any): void {
    try {
      const data = resp?.message || {};
      this.idApertura = data.apertura || '';
      this.montoApertura = data.monto_apertura || 0;
      this.totalRetiros = data.total_retiros || 0;
      this.efectivoSistema = data.efectivo_sistema || 0;
    } catch (error) {
      console.error('Error datos cierre:', error);
    }
  }

  // Método para generar avisos según la lógica de negocio
  private generarAvisos(): void {
    // Limpiar avisos previos
    this.avisos = [];
    if (this.isBillingDashboard && this.liteDashboardError) {
      this.agregarAviso('Dashboard', this.liteDashboardError, 'error');
    }
    if (this.isBillingDashboard && this.litePlanIsInactive) {
      this.agregarAviso('Plan actual', 'El plan no está activo. La emisión de comprobantes está bloqueada.', 'warning');
    } else if (this.isBillingDashboard && this.litePlan && !this.litePlanUnlimited && (Number(this.litePlan.remaining_authorized_documents) || 0) <= 0) {
      this.agregarAviso('Comprobantes', 'Se agotó el límite de comprobantes autorizados del plan.', 'warning');
    } else if (this.isBillingDashboard && this.litePlanExpiringSoon) {
      this.agregarAviso('Plan actual', `El plan vence en ${this.litePlanDaysToExpire} día(s).`, 'warning');
    }
    if (this.isBillingDashboard && this.liteStockAlert) {
      this.agregarAviso('Inventario', `Hay ${this.liteDashboard?.inventory.out_of_stock_items.length || 0} producto(s) sin stock.`, 'warning');
    }
    if (this.companyData?.firma) {
      this.agregarAviso('Aviso', 'Ingrese su firma para poder emitir facturas.',
        'warning');
    }
  
    if (this.isRestaurantMode && !this.idApertura) {
      this.agregarAviso(
        'Caja',
        'No hay apertura de caja activa. Por favor, realiza la apertura.',
        'warning'
      );
    }

    const certificateEnd = this.companyData?.cert_not_after;
    const dateEndCert = certificateEnd ? String(certificateEnd).trim() : '';
    if (dateEndCert) {
      const dias = diasRestantes(dateEndCert);
      this.certDaysLeft = dias;
      if (dias <= 30 && dias > 0) {
        this.agregarAviso(
          'Firma',
          `La firma vencera en ${dias} día(s).`,
          'warning'
        );
      } else if (dias <= 0) {
        this.agregarAviso(
          'Firma',
          'La firma ha expirado',
          'error'
        );
      }
    } else {
      this.certDaysLeft = null;
    }





    // Ejemplo: Diferencia en efectivo
    // if (this.montoApertura > 0) {
    //   const diferencia = this.efectivoSistema - this.montoApertura + this.totalRetiros;
    //   if (Math.abs(diferencia) > 50) {
    //     this.agregarAviso(
    //       '💰 Posible Faltante de Caja',
    //       `Hay una diferencia de $${diferencia.toFixed(2)} en el efectivo.`,
    //       'error'
    //     );
    //   }
    // }

    // Ejemplo: Muchos pedidos
    // if (this.totalOrdersToday > 50) {
    //   this.agregarAviso(
    //     'Alto Volumen de Ventas',
    //     `Has registrado ${this.totalOrdersToday} pedidos hoy. ¡Excelente desempeño!`,
    //     'success'
    //   );
    // }

    // Ejemplo: Sin ventas
    // if (this.totalOrdersToday === 0 && this.userData) {
    //   this.agregarAviso(
    //     'ℹSin Ventas',
    //     'Aún no hay pedidos registrados hoy.',
    //     'info'
    //   );
    // }

    // Ejemplo: Retiros pendientes
    // if (this.totalRetiros > 100) {
    //   this.agregarAviso(
    //     'Retiros Elevados',
    //     `Se han retirado $${this.totalRetiros.toFixed(2)} durante el turno.`,
    //     'warning'
    //   );
    // }


  }

  // Método público para agregar avisos manualmente
  agregarAviso(titulo: string, mensaje: string, tipo: 'error' | 'warning' | 'info' | 'success'): void {
    const aviso: Aviso = {
      id: `aviso_${this.avisoCounter++}`,
      titulo,
      mensaje,
      tipo,
      fecha: new Date()
    };
    this.avisos.push(aviso);
  }

  // Método para eliminar un aviso
  eliminarAviso(id: string): void {
    this.avisos = this.avisos.filter(aviso => aviso.id !== id);
  }

  // Método para limpiar todos los avisos
  limpiarAvisos(): void {
    this.avisos = [];
  }

  get cajaAbierta(): boolean {
    return this.cashIsOpen || !!this.idApertura;
  }

  get isFacturadorMode(): boolean {
    return !this.isRestaurantMode;
  }

  /** Dashboard informativo de facturación cuando no está habilitado Restaurante. */
  get isBillingDashboard(): boolean {
    return !this.isRestaurantMode;
  }

  get isLiteMode(): boolean {
    return this.businessMode === 'FACTURADA_LITE' && !this.isRestaurantMode;
  }

  get isRestaurantMode(): boolean {
    return this.capabilities.isEnabled('restaurant');
  }

  get modeLabel(): string {
    if (this.isLiteMode) return 'FacturADA Lite';
    return this.isFacturadorMode ? 'Facturador' : 'Restaurante';
  }

  get dashboardTitle(): string {
    return this.isFacturadorMode ? 'Panel de facturación' : 'Panel operativo';
  }

  get dashboardSubtitle(): string {
    return this.isFacturadorMode
      ? `Facturación electrónica, clientes y documentos: ${this.today.toLocaleDateString('es-EC')}`
      : `Operación del restaurante, caja y órdenes: ${this.today.toLocaleDateString('es-EC')}`;
  }

  get heroClasses(): string {
    return this.isFacturadorMode
      ? 'from-slate-950 via-violet-700 to-primary'
      : 'from-slate-950 via-primary to-sky-700';
  }

  get primaryActions(): DashboardAction[] {
    if (this.isFacturadorMode) {
      return this.filterAllowedActions([
        { label: 'Emitir factura', detail: 'Factura directa al SRI', route: '/dashboard/invoicing', tone: 'bg-primary text-white', feature: 'direct_invoice', requiresEmission: true },
        { label: 'Ver facturas', detail: 'Historial y reenvíos', route: '/dashboard/invoices', tone: 'bg-violet-600 text-white', feature: 'direct_invoice' },
        { label: 'Clientes', detail: 'Datos fiscales', route: '/dashboard/customers', tone: 'bg-slate-900 text-white', feature: 'customers' },
        { label: 'Productos', detail: 'Catálogo facturable', route: '/dashboard/products', tone: 'bg-emerald-600 text-white', feature: 'products' },
        { label: 'Notas crédito', detail: 'Anulaciones y ajustes', route: '/dashboard/credit-notes', tone: 'bg-amber-600 text-white', feature: 'credit_note' }
      ]).slice(0, 5);
    }

    const restaurantActions: DashboardAction[] = [
      { label: 'Abrir POS', detail: 'Venta y orden rápida', route: '/dashboard/pos', tone: 'bg-primary text-white', feature: 'restaurant_pos' },
      { label: 'Órdenes', detail: 'Seguimiento del día', route: '/dashboard/orders', tone: 'bg-slate-900 text-white', feature: 'orders' },
      { label: 'Tiempo real', detail: 'Cocina y atención', route: '/dashboard/orders-realtime', tone: 'bg-sky-600 text-white', feature: 'kitchen' },
      { label: this.cajaAbierta ? 'Cerrar caja' : 'Abrir caja', detail: 'Control del turno', route: this.cajaAbierta ? '/caja/cierre' : '/caja/apertura', tone: 'bg-emerald-600 text-white', feature: 'cash_register' }
    ];
    // Facturación no pertenece al POS: puede coexistir con Restaurante y se
    // muestra sin depender de restaurant_pos, mesas, cocina o caja.
    const billingActions: DashboardAction[] = [
      { label: 'Emitir factura', detail: 'Factura directa al SRI', route: '/dashboard/invoicing', tone: 'bg-violet-600 text-white', feature: 'direct_invoice', requiresEmission: true },
      { label: 'Notas crédito', detail: 'Ajustes tributarios', route: '/dashboard/credit-notes', tone: 'bg-amber-600 text-white', feature: 'credit_note' }
    ];
    return this.filterAllowedActions([...restaurantActions, ...billingActions]).slice(0, 6);
  }

  private filterAllowedActions(actions: DashboardAction[]): DashboardAction[] {
    return actions.filter((action) => !action.feature || this.capabilities.isEnabled(action.feature));
  }

  isFeatureEnabled(feature: CompanyFeatureKey): boolean {
    return this.capabilities.isEnabled(feature);
  }

  isActionBlocked(action: DashboardAction): boolean {
    return !!action.requiresEmission && !!this.litePlanBlockMessage;
  }

  onPrimaryActionClick(event: Event, action: DashboardAction): void {
    const blockMessage = action.requiresEmission ? this.litePlanBlockMessage : null;
    if (!blockMessage) return;
    event.preventDefault();
    event.stopPropagation();
    this.agregarAviso('Plan actual', blockMessage, 'warning');
  }

  get hasCurrentPlan(): boolean {
    return !!this.currentPlan;
  }

  get planName(): string {
    return this.currentPlan?.plan_name || this.currentPlan?.plan || 'Sin plan asignado';
  }

  get planStatus(): string {
    return `${this.currentPlan?.status || 'SIN PLAN'}`.toUpperCase();
  }

  get planStatusClasses(): string {
    return this.getPlanStatusClasses(this.planStatus);
  }

  get planIsInactive(): boolean {
    return !!this.currentPlan && this.currentPlan.active === false;
  }

  get planUnlimitedVouchers(): boolean {
    return !!this.currentPlan?.unlimited_authorized_vouchers || Number(this.currentPlan?.remaining_authorized_vouchers) === -1;
  }

  get planUsedVouchers(): number {
    return Number(this.currentPlan?.used_authorized_vouchers) || 0;
  }

  get planPurchasedVouchers(): number {
    return Number(this.currentPlan?.purchased_authorized_vouchers) || 0;
  }

  get planRemainingLabel(): string {
    if (!this.currentPlan) return '—';
    if (this.planUnlimitedVouchers) return 'Ilimitados';
    return `${Number(this.currentPlan.remaining_authorized_vouchers) || 0}`;
  }

  get planVoucherUsageLabel(): string {
    if (!this.currentPlan) return '—';
    if (this.planUnlimitedVouchers) return `${this.planUsedVouchers} usados / Ilimitados`;
    return `${this.planUsedVouchers} usados / ${this.planPurchasedVouchers} incluidos`;
  }

  get planVigenciaLabel(): string {
    if (!this.currentPlan) return '—';
    return `${this.formatPlanDate(this.currentPlan.start_date)} hasta ${this.formatPlanDate(this.currentPlan.end_date)}`;
  }

  get planDaysToExpire(): number | null {
    if (!this.currentPlan?.end_date) return null;
    const end = this.parsePlanDate(this.currentPlan.end_date);
    if (!end) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((end.getTime() - today.getTime()) / 86400000);
  }

  get planExpiringSoon(): boolean {
    return this.planDaysToExpire !== null && this.planDaysToExpire >= 0 && this.planDaysToExpire <= 7;
  }

  get shouldShowPlanAutoRenew(): boolean {
    return this.currentPlan?.auto_renew !== undefined && this.currentPlan?.auto_renew !== null && `${this.currentPlan?.auto_renew}` !== '';
  }

  get planAutoRenewLabel(): string {
    const value = this.currentPlan?.auto_renew;
    return value === true || value === 1 || `${value ?? ''}` === '1' ? 'Sí' : 'No';
  }

  get liteSales() {
    return this.liteDashboard?.sales;
  }

  get liteBusinessName(): string {
    const business = this.capabilities.business || {};
    return String(
      business.business_name || business.businessname || business.trade_name || business.legal_name || business.name ||
      this.liteDashboard?.business || 'Negocio'
    );
  }

  get liteEnabledModules(): string[] {
    const labels: Array<[CompanyFeatureKey, string]> = [
      ['direct_invoice', 'Facturación'],
      ['customers', 'Clientes'],
      ['products', 'Productos'],
      ['inventory', 'Inventario'],
      ['credit_note', 'Notas de crédito']
    ];
    return labels.filter(([feature]) => this.isFeatureEnabled(feature)).map(([, label]) => label);
  }

  get litePlan(): LiteDashboardPlan | null {
    if (this.liteDashboard?.plan) return this.liteDashboard.plan;
    if (!this.currentPlan) return null;
    return {
      name: this.currentPlan.plan_name || this.currentPlan.plan,
      status: this.currentPlan.status,
      active: this.currentPlan.active,
      start_date: this.currentPlan.start_date,
      end_date: this.currentPlan.end_date,
      unlimited_documents: this.currentPlan.unlimited_authorized_vouchers,
      max_authorized_documents: this.currentPlan.purchased_authorized_vouchers,
      used_authorized_documents: this.currentPlan.used_authorized_vouchers,
      remaining_authorized_documents: this.currentPlan.remaining_authorized_vouchers
    };
  }

  get litePlanIsInactive(): boolean {
    if (!this.litePlan) return false;
    if (this.litePlan.active === false) return true;
    const status = `${this.litePlan.status || ''}`.toUpperCase();
    return ['VENCIDO', 'SUSPENDIDO', 'CANCELADO', 'INACTIVO'].includes(status);
  }

  get litePlanUnlimited(): boolean {
    return this.litePlan?.unlimited_documents === true;
  }

  get litePlanRemainingLabel(): string {
    if (!this.litePlan) return '—';
    if (this.litePlanUnlimited) return 'Ilimitados';
    return `${Number(this.litePlan.remaining_authorized_documents) || 0}`;
  }

  get litePlanConsumptionLabel(): string {
    if (!this.litePlan) return '—';
    return this.litePlanUnlimited ? 'Ilimitada' : 'Por comprobantes';
  }

  get litePlanBlockMessage(): string | null {
    if (!this.isBillingDashboard) return this.capabilities.getPlanBlockMessage('direct_invoice');
    if (!this.litePlan) return 'La empresa no tiene un plan asignado para emitir comprobantes.';
    if (this.litePlanIsInactive) return 'El plan de la empresa no está activo.';
    if (!this.litePlanUnlimited && (Number(this.litePlan.remaining_authorized_documents) || 0) <= 0) {
      return 'No quedan comprobantes disponibles en el plan actual.';
    }
    return null;
  }

  get litePlanStatusClasses(): string {
    return this.getPlanStatusClasses(`${this.litePlan?.status || 'SIN PLAN'}`);
  }

  get litePlanDaysToExpire(): number | null {
    const end = this.litePlan?.end_date || this.currentPlan?.end_date;
    const parsed = this.parsePlanDate(end);
    if (!parsed) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((parsed.getTime() - today.getTime()) / 86400000);
  }

  get litePlanExpiringSoon(): boolean {
    return this.litePlanDaysToExpire !== null && this.litePlanDaysToExpire >= 0 && this.litePlanDaysToExpire <= 7;
  }

  get liteHasNoData(): boolean {
    if (!this.liteDashboard || this.liteDashboardLoading) return false;
    return !this.liteDashboard.recent_invoices.length;
  }

  get liteStockAlert(): boolean {
    if (!this.isFeatureEnabled('inventory')) return false;
    return (this.liteDashboard?.inventory.low_stock_items || 0) > 0 || (this.liteDashboard?.inventory.out_of_stock_items.length || 0) > 0;
  }

  get liteDashboardPeriodLabel(): string {
    const from = this.liteDashboard?.period?.from_date || this.liteFromDate;
    const to = this.liteDashboard?.period?.to_date || this.liteToDate;
    return `${this.formatPlanDate(from)} hasta ${this.formatPlanDate(to)}`;
  }

  get litePlanDateRangeLabel(): string {
    const start = this.litePlan?.start_date || this.currentPlan?.start_date;
    const end = this.litePlan?.end_date || this.currentPlan?.end_date;
    if (!start && !end) return 'Vigencia no disponible';
    return `${this.formatPlanDate(start)} hasta ${this.formatPlanDate(end)}`;
  }

  formatLiteInvoiceDate(value: unknown): string {
    const raw = `${value || ''}`.trim();
    if (!raw) return '—';
    const datePart = raw.split(/[T ]/)[0];
    return this.formatPlanDate(datePart);
  }

  liteInvoiceName(invoice: any): string {
    return String(invoice?.name || invoice?.invoice_name || invoice?.document || invoice?.documento || '—');
  }

  liteInvoiceCustomer(invoice: any): string {
    return String(invoice?.customer_name || invoice?.customer || invoice?.customer_data?.nombre || invoice?.customer_data?.full_name || 'Consumidor final');
  }

  liteInvoiceStatus(invoice: any): string {
    return String(invoice?.status || invoice?.einvoice_status || invoice?.sri_status || '—');
  }

  liteInvoiceTotal(invoice: any): number {
    return Number(invoice?.total ?? invoice?.grand_total ?? invoice?.amount ?? 0) || 0;
  }

  get ticketPromedio(): number {
    if (!this.totalOrdersToday) {
      return 0;
    }
    return this.total_sales_today / this.totalOrdersToday;
  }

  get firmaLabel(): string {
    if (this.companyData?.firma) {
      return 'Sin firma';
    }
    if (this.certDaysLeft === null) {
      return 'Pendiente de validar';
    }
    if (this.certDaysLeft <= 0) {
      return 'Vencida';
    }
    if (this.certDaysLeft <= 30) {
      return `Vence en ${this.certDaysLeft} dias`;
    }
    return 'Al dia';
  }

  get firmaClasses(): string {
    if (this.companyData?.firma || this.certDaysLeft !== null && this.certDaysLeft <= 0) {
      return 'bg-red-100 text-red-700';
    }
    if (this.certDaysLeft === null) return 'bg-amber-100 text-amber-700';
    if (this.certDaysLeft <= 30) {
      return 'bg-amber-100 text-amber-700';
    }
    return 'bg-emerald-100 text-emerald-700';
  }

  getProductShare(count: number): number {
    const maxCount = Math.max(...this.topProducts.map((item: any) => Number(item.count) || 0), 0);
    if (!maxCount) {
      return 0;
    }
    return ((Number(count) || 0) / maxCount) * 100;
  }

  get topProductName(): string {
    if (!this.topProducts.length) {
      return 'Sin datos';
    }
    return String(this.topProducts[0]?.name || 'Sin nombre');
  }

  get topProductCount(): number {
    if (!this.topProducts.length) {
      return 0;
    }
    return Number(this.topProducts[0]?.count) || 0;
  }

  get totalTopProductsUnits(): number {
    return this.topProducts.reduce((acc: number, item: any) => acc + (Number(item?.count) || 0), 0);
  }

  get topProductShareInTop(): number {
    if (!this.totalTopProductsUnits) {
      return 0;
    }
    return (this.topProductCount / this.totalTopProductsUnits) * 100;
  }

  get top3ShareInTop(): number {
    if (!this.totalTopProductsUnits) {
      return 0;
    }
    const top3Units = this.topProducts
      .slice(0, 3)
      .reduce((acc: number, item: any) => acc + (Number(item?.count) || 0), 0);
    return (top3Units / this.totalTopProductsUnits) * 100;
  }

  get retirosVsVentasPercent(): number {
    if (!this.total_sales_today) {
      return 0;
    }
    return (this.totalRetiros / this.total_sales_today) * 100;
  }

  get efectivoEsperado(): number {
    return this.efectivoEsperadoBackend;
  }

  get diferenciaCaja(): number {
    return this.efectivoSistema - this.efectivoEsperado;
  }

  get diferenciaCajaLabel(): string {
    if (Math.abs(this.diferenciaCaja) < 0.01) {
      return 'Sin diferencia';
    }
    if (this.diferenciaCaja > 0) {
      return 'Sobrante';
    }
    return 'Faltante';
  }

  get diferenciaCajaClasses(): string {
    if (Math.abs(this.diferenciaCaja) < 0.01) {
      return 'bg-slate-100 text-slate-700';
    }
    if (this.diferenciaCaja > 0) {
      return 'bg-emerald-100 text-emerald-700';
    }
    return 'bg-red-100 text-red-700';
  }

  get ordersPerHour(): number {
    const currentHour = new Date().getHours();
    const elapsedHours = Math.max(currentHour + 1, 1);
    return this.totalOrdersToday / elapsedHours;
  }

  get ticketPromedioLabel(): string {
    if (!this.totalOrdersToday) {
      return 'Sin pedidos';
    }
    if (this.ticketPromedio >= 15) {
      return 'Ticket fuerte';
    }
    if (this.ticketPromedio >= 8) {
      return 'Ticket estable';
    }
    return 'Ticket bajo';
  }

  get ticketPromedioClasses(): string {
    if (!this.totalOrdersToday) {
      return 'bg-slate-100 text-slate-700';
    }
    if (this.ticketPromedio >= 15) {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (this.ticketPromedio >= 8) {
      return 'bg-sky-100 text-sky-700';
    }
    return 'bg-amber-100 text-amber-700';
  }

  get ritmoTurnoLabel(): string {
    if (!this.totalOrdersToday) {
      return 'Sin movimiento';
    }
    if (this.ordersPerHour >= 4) {
      return 'Ritmo alto';
    }
    if (this.ordersPerHour >= 2) {
      return 'Ritmo estable';
    }
    return 'Ritmo bajo';
  }

  get ritmoTurnoClasses(): string {
    if (!this.totalOrdersToday) {
      return 'bg-slate-100 text-slate-700';
    }
    if (this.ordersPerHour >= 4) {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (this.ordersPerHour >= 2) {
      return 'bg-sky-100 text-sky-700';
    }
    return 'bg-amber-100 text-amber-700';
  }

  get diferenciaCajaAbs(): number {
    return Math.abs(this.diferenciaCaja);
  }

  get estadoTurnoLabel(): string {
    if (this.isFacturadorMode) {
      if (this.companyData?.firma || this.certDaysLeft !== null && this.certDaysLeft <= 0) return 'Revisar firma';
      if (!this.totalOrdersToday) return 'Listo para emitir';
      return 'Facturación activa';
    }
    if (!this.cajaAbierta) {
      return 'Atencion requerida';
    }
    if (this.diferenciaCajaAbs > 20) {
      return 'Revisar caja';
    }
    if (!this.totalOrdersToday) {
      return 'Sin movimiento';
    }
    return 'Operacion estable';
  }

  get estadoTurnoClasses(): string {
    if (this.isFacturadorMode) {
      if (this.companyData?.firma || this.certDaysLeft !== null && this.certDaysLeft <= 0) return 'bg-red-100 text-red-700';
      if (!this.totalOrdersToday) return 'bg-sky-100 text-sky-700';
      return 'bg-emerald-100 text-emerald-700';
    }
    if (!this.cajaAbierta || this.diferenciaCajaAbs > 20) {
      return 'bg-red-100 text-red-700';
    }
    if (!this.totalOrdersToday) {
      return 'bg-amber-100 text-amber-700';
    }
    return 'bg-emerald-100 text-emerald-700';
  }

  get resumenVentasClaro(): string {
    if (!this.totalOrdersToday) {
      return this.isFacturadorMode ? 'Aun no hay documentos o ventas registradas hoy.' : 'Aun no hay pedidos registrados hoy.';
    }
    return this.isFacturadorMode
      ? `Llevas ${this.totalOrdersToday} documento(s)/venta(s) por ${this.total_sales_today.toFixed(2)} USD.`
      : `Llevas ${this.totalOrdersToday} pedidos por ${this.total_sales_today.toFixed(2)} USD.`;
  }

  get resumenCajaClaro(): string {
    if (this.isFacturadorMode) {
      if (this.companyData?.firma) return 'Falta registrar la firma electrónica para emitir comprobantes.';
      if (this.certDaysLeft === null) return 'Certificado configurado; su vigencia está pendiente de validar.';
      if (this.certDaysLeft <= 0) return 'La firma está vencida. Debes renovarla antes de emitir.';
      return `Firma activa. Certificado con ${this.certDaysLeft} día(s) disponibles.`;
    }
    if (!this.cajaAbierta) {
      return 'No hay apertura de caja activa en este turno.';
    }
    if (this.diferenciaCajaAbs < 0.01) {
      return 'La caja esta cuadrada con el valor esperado.';
    }
    if (this.diferenciaCaja > 0) {
      return `Hay un sobrante de ${this.diferenciaCajaAbs.toFixed(2)} USD frente a lo esperado.`;
    }
    return `Hay un faltante de ${this.diferenciaCajaAbs.toFixed(2)} USD frente a lo esperado.`;
  }

  get resumenProductosClaro(): string {
    if (!this.topProducts.length) {
      return this.isFacturadorMode ? 'Sin productos facturados para mostrar ranking.' : 'Sin ventas de productos para mostrar ranking.';
    }
    return `${this.topProductName} lidera ${this.isFacturadorMode ? 'la facturación' : 'las ventas'} con ${this.topProductCount} unidades.`;
  }

  get accionesSugeridas(): string[] {
    const acciones: string[] = [];

    if (this.isFacturadorMode) {
      if (this.companyData?.firma) {
        acciones.push('Registrar firma electrónica para habilitar emisión de comprobantes.');
      }
      if (this.certDaysLeft !== null && this.certDaysLeft <= 30) {
        acciones.push(`Renovar certificado de firma (${this.certDaysLeft} día(s) restantes).`);
      }
      if (this.totalOrdersToday === 0) {
        acciones.push('Emitir una factura directa o revisar documentos pendientes.');
      }
      acciones.push('Mantener actualizados clientes, productos y datos fiscales.');
      return acciones;
    }

    if (!this.cajaAbierta) {
      acciones.push('Realizar apertura de caja para iniciar el turno.');
    }
    if (this.companyData?.firma) {
      acciones.push('Registrar firma electronica para habilitar facturacion.');
    }
    if (this.certDaysLeft !== null && this.certDaysLeft <= 30) {
      acciones.push(`Renovar certificado de firma (${this.certDaysLeft} dia(s) restantes).`);
    }
    if (this.diferenciaCajaAbs > 20) {
      acciones.push('Verificar retiros y movimientos de caja por diferencia alta.');
    }
    if (this.totalOrdersToday === 0) {
      acciones.push('Confirmar que POS y toma de pedidos esten operativos.');
    }

    if (!acciones.length) {
      acciones.push('Mantener operacion actual y monitorear cierres de pedidos.');
    }

    return acciones;
  }

  get mixVentasLabel(): string {
    if (!this.topProducts.length) {
      return 'Sin datos';
    }
    if (this.topProductShareInTop >= 45) {
      return 'Alta dependencia';
    }
    if (this.top3ShareInTop >= 75) {
      return 'Mix concentrado';
    }
    return 'Mix balanceado';
  }

  get mixVentasClasses(): string {
    if (!this.topProducts.length) {
      return 'bg-slate-100 text-slate-700';
    }
    if (this.topProductShareInTop >= 45) {
      return 'bg-rose-100 text-rose-700';
    }
    if (this.top3ShareInTop >= 75) {
      return 'bg-amber-100 text-amber-700';
    }
    return 'bg-emerald-100 text-emerald-700';
  }

  get mixVentasDetalle(): string {
    if (!this.topProducts.length) {
      return 'Todavia no hay suficientes ventas para evaluar el mix de productos.';
    }
    if (this.topProductShareInTop >= 45) {
      return `${this.topProductName} concentra ${this.topProductShareInTop.toFixed(1)}% del top vendido.`;
    }
    if (this.top3ShareInTop >= 75) {
      return `Los 3 productos lideres concentran ${this.top3ShareInTop.toFixed(1)}% de las unidades vendidas.`;
    }
    return 'Las ventas se reparten bien entre varios productos del ranking.';
  }

  get resumenComercialClaro(): string {
    if (!this.totalOrdersToday) {
      return 'Aun no hay pedidos suficientes para leer el rendimiento comercial del turno.';
    }
    return `Promedio de ${this.ordersPerHour.toFixed(1)} pedidos por hora con un ticket medio de ${this.ticketPromedio.toFixed(2)} USD.`;
  }

  get saludCajaPercent(): number {
    const base = Math.max(Math.abs(this.efectivoEsperado), 1);
    const desvio = (Math.abs(this.diferenciaCaja) / base) * 100;
    return Math.max(0, Math.min(100, 100 - desvio));
  }

  get retirosSobreVentasPercentSafe(): number {
    return Math.max(0, Math.min(this.retirosVsVentasPercent, 100));
  }

  private actualizarVisualizaciones(): void {
    this.construirChartTopProductos();
    this.construirChartFlujoCaja();
    this.construirChartResumenMonetario();
  }

  formatPlanDate(value?: string | null): string {
    const raw = `${value || ''}`.trim();
    if (!raw) return '—';
    const parts = raw.split('-');
    if (parts.length !== 3) return raw;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  private getPlanStatusClasses(status: string): string {
    const normalized = `${status || ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

    if (normalized === 'ACTIVO') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (normalized === 'PRUEBA') return 'bg-sky-100 text-sky-700 border-sky-200';
    if (normalized === 'VENCIDO') return 'bg-red-100 text-red-700 border-red-200';
    if (normalized === 'SUSPENDIDO') return 'bg-orange-100 text-orange-700 border-orange-200';
    if (normalized === 'CANCELADO' || normalized === 'RENOVADO') return 'bg-slate-100 text-slate-600 border-slate-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }

  private parsePlanDate(value?: string | null): Date | null {
    const raw = `${value || ''}`.trim();
    const parts = raw.split('-').map((part) => Number(part));
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
    const [year, month, day] = parts;
    return new Date(year, month - 1, day);
  }

  private formatChartDecimal(value: number): string {
    return (Number(value) || 0).toFixed(2);
  }

  private formatChartCurrency(value: number): string {
    return `$${this.formatChartDecimal(value)}`;
  }

  private construirChartTopProductos(): void {
    const top = this.topProducts.slice(0, 8);
    const categorias = top.length ? top.map((item: any) => String(item?.name || 'Sin nombre')) : ['Sin ventas'];
    const values = top.length ? top.map((item: any) => Number(item?.count) || 0) : [0];

    this.topProductsBarOptions = {
      series: [
        {
          name: 'Unidades',
          data: values
        }
      ],
      chart: {
        type: 'bar',
        height: 360,
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 550 }
      },
      plotOptions: {
        bar: {
          horizontal: true,
          barHeight: '58%',
          borderRadius: 6,
          distributed: true
        }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: categorias,
        labels: {
          style: { colors: '#64748b' }
        }
      },
      yaxis: {
        labels: {
          style: { colors: '#334155', fontWeight: 600 }
        }
      },
      colors: ['#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444'],
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 4
      },
      tooltip: {
        y: {
          formatter: (value: number) => `${this.formatChartDecimal(value)} vendidos`
        }
      }
    };
  }

  private construirChartFlujoCaja(): void {
    const series = [
      Number(this.montoApertura) || 0,
      Number(this.total_sales_today) || 0,
      Number(this.totalRetiros) || 0
    ];

    this.cashFlowDonutOptions = {
      series,
      chart: {
        type: 'donut',
        height: 330,
        toolbar: { show: false }
      },
      labels: ['Apertura', 'Ventas', 'Retiros'],
      colors: ['#f59e0b', '#10b981', '#f43f5e'],
      legend: {
        show: false
      },
      dataLabels: {
        enabled: true,
        formatter: (val: number) => `${this.formatChartDecimal(val)}%`
      },
      stroke: { width: 0 },
      plotOptions: {
        pie: {
          donut: {
            size: '66%',
            labels: {
              show: true,
              name: {
                show: true
              },
              value: {
                show: true,
                formatter: (value: string) => this.formatChartCurrency(Number(value))
              },
              total: {
                show: true,
                label: 'Movimiento',
                formatter: () => this.formatChartCurrency(series.reduce((acc: number, current: number) => acc + current, 0))
              }
            }
          }
        }
      },
      tooltip: {
        y: {
          formatter: (value: number) => this.formatChartCurrency(value)
        }
      },
      responsive: [
        {
          breakpoint: 1280,
          options: {
            chart: { height: 300 }
          }
        }
      ]
    };
  }

  private construirChartResumenMonetario(): void {
    const diferenciaColor = this.diferenciaCaja >= 0 ? '#16a34a' : '#dc2626';
    const values = [
      Number(this.total_sales_today) || 0,
      Number(this.totalRetiros) || 0,
      Number(this.efectivoSistema) || 0,
      Number(this.efectivoEsperado) || 0,
      Number(this.diferenciaCaja) || 0
    ];

    this.moneyBarsOptions = {
      series: [
        {
          name: 'USD',
          data: values
        }
      ],
      chart: {
        type: 'bar',
        height: 340,
        toolbar: { show: false },
        animations: { enabled: true, easing: 'easeinout', speed: 550 }
      },
      plotOptions: {
        bar: {
          horizontal: false,
          borderRadius: 6,
          columnWidth: '48%',
          distributed: true
        }
      },
      dataLabels: { enabled: false },
      xaxis: {
        categories: ['Ventas', 'Retiros', 'Efectivo', 'Esperado', 'Diferencia'],
        labels: {
          style: { colors: '#64748b' }
        }
      },
      yaxis: {
        labels: {
          formatter: (val: number) => this.formatChartDecimal(val),
          style: { colors: '#64748b' }
        }
      },
      colors: ['#10b981', '#f43f5e', '#2563eb', '#0ea5e9', diferenciaColor],
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 4
      },
      tooltip: {
        y: {
          formatter: (value: number) => this.formatChartCurrency(value)
        }
      }
    };
  }
}
