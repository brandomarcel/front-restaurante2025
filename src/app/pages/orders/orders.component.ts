import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit } from '@angular/core';
import { OrdersService } from 'src/app/services/orders.service';
import { EcuadorTimePipe } from '../../core/pipes/ecuador-time-pipe.pipe';
import { NgxSpinnerService } from 'ngx-spinner';
import { FormsModule } from '@angular/forms';
import { PrintService } from 'src/app/services/print.service';
import { PrintStationService } from 'src/app/services/print-station.service';
import { toast } from 'ngx-sonner';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { environment } from 'src/environments/environment.prod';
import { UtilsService } from 'src/app/core/services/utils.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { OrderModalComponent } from '../orders-realtime/ui/order-modal/order-modal.component';
import { AppPaginationComponent } from 'src/app/shared/components/pagination/app-pagination.component';
import { FilterDates, FilterTab, ListFilterBarComponent } from 'src/app/shared/components/list-filter-bar/list-filter-bar.component';
import { debouncedCallback } from 'src/app/shared/utils/debounced-callback';
import { readListQuery, readListQueryExtra, writeListQuery } from 'src/app/shared/utils/list-query';

/** Estado de la orden en el backend (también la clave de `status_counts`); vacío = todas. */
type EstadoOrden = '' | 'Ingresada' | 'Preparacion' | 'Lista' | 'Cerrada' | 'Cancelada';

/** Pestañas con los colores de las insignias de estado de la tabla. */
const ORDER_STATUS_TABS: FilterTab[] = [
  { value: '', label: 'Todas', countKey: 'ALL', hint: 'Todas las órdenes' },
  { value: 'Ingresada', label: 'Ingresadas', dot: 'bg-danger-500', hint: 'Recién tomadas, cocina no las empezó' },
  { value: 'Preparacion', label: 'En preparación', shortLabel: 'Preparación', dot: 'bg-warning-500', hint: 'Cocina las está preparando' },
  { value: 'Lista', label: 'Listas', dot: 'bg-info-500', hint: 'Listas para entregar' },
  { value: 'Cerrada', label: 'Cerradas', dot: 'bg-success-500', hint: 'Servidas o cobradas' },
  { value: 'Cancelada', label: 'Canceladas', dot: 'bg-muted-foreground/50', hint: 'Canceladas' },
];
const ORDER_TYPES = ['Factura', 'Nota Venta'] as const;

@Component({
  selector: 'app-orders',
  imports: [CommonModule,
    // EcuadorTimePipe,
    FormsModule,
    RouterModule,
    OrderModalComponent,
    AppPaginationComponent,
    ListFilterBarComponent
  ],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})
export class OrdersComponent implements OnInit {
  orders: any;
  ordersFiltradosList: any[] = [];
  orderSelected: any | null = null;
  expandedOrderId: number | null = null;
  mostrarModal = false;

  page = 1;
  pageSize = 10;
  totalOrders = 0;
  totalPages = 1;

  private _searchTerm = '';
  activeTab = 'info';
  roleName: 'Gerente' | 'Cajero' | 'Mesero' | 'Desconocido' = 'Desconocido';

  // Filtros (todos se resuelven en el backend, con conteos por estado)
  tipoFiltro: '' | 'Factura' | 'Nota Venta' = '';
  estadoFiltro: EstadoOrden = '';
  /** Fecha de creación `YYYY-MM-DD`; Mesero y Cajero ven siempre el día de hoy. */
  fromDate = '';
  toDate = '';
  statusCounts: Record<string, number> | null = null;
  readonly statusTabs = ORDER_STATUS_TABS;
  private readonly searchBackend: () => void;

  private url = environment.URL
  constructor(
    private ordersService: OrdersService,
    public spinner: NgxSpinnerService,
    private printService: PrintService,
    private printStation: PrintStationService,
    private utils: UtilsService,
    private capabilities: CompanyCapabilitiesService,
    private route: ActivatedRoute,
    private router: Router,
    destroyRef: DestroyRef,
  ) {
    this.searchBackend = debouncedCallback(destroyRef, () => {
      this.page = 1;
      this.loadOrders();
    });
  }

  /** El mesero solo ve las órdenes que creó. */
  get onlyMine(): boolean {
    return this.capabilities.isWaiterOnly;
  }

  ngOnInit() {
    this.roleName = this.detectRole();
    // Filtros y página en la dirección: al volver del detalle la lista sigue igual.
    const query = readListQuery(this.route);
    this.estadoFiltro = ORDER_STATUS_TABS.some(tab => tab.value && tab.value === query.estado) ? query.estado as EstadoOrden : '';
    this._searchTerm = query.q;
    this.fromDate = query.desde;
    this.toDate = query.hasta;
    this.page = query.pagina;
    this.tipoFiltro = readListQueryExtra(this.route, 'tipo', ORDER_TYPES) as '' | 'Factura' | 'Nota Venta';
    this.loadOrders();
  }

  loadOrders(): void {
    this.spinner.show();
    const offset = (this.page - 1) * this.pageSize;
    const today = String(this.utils.getSoloFechaEcuador());
    const createdFrom = this.isMeseroOrCajero ? today : (this.fromDate || undefined);
    const createdTo = this.isMeseroOrCajero ? today : (this.toDate || undefined);
    writeListQuery(this.router, this.route, {
      estado: this.estadoFiltro, q: this._searchTerm, desde: this.fromDate, hasta: this.toDate, pagina: this.page,
      extra: { tipo: this.tipoFiltro },
    });

    this.ordersService.getAll(this.pageSize, offset, createdFrom, createdTo, 'desc', this.estadoFiltro || undefined, this.onlyMine,
      { search: this._searchTerm, fiscalStatus: this.tipoFiltro || undefined }).subscribe({
      next: (res: any) => {
        const rows = res.message.data || [];
        this.orders = rows;
        const counts = res.message?.status_counts;
        this.statusCounts = counts && typeof counts === 'object' ? counts : null;
        this.pageSize = Number(res.message?.limit ?? this.pageSize) || this.pageSize;
        const responseOffset = Number(res.message?.offset);
        if (Number.isFinite(responseOffset) && responseOffset >= 0) {
          this.page = Math.floor(responseOffset / this.pageSize) + 1;
        }
        this.totalOrders = Number(res.message?.total ?? res.message?.total_count ?? res.message?.count ?? this.orders.length) || 0;
        const hasNext = Boolean(res.message?.has_next ?? res.message?.hasNext);
        this.totalPages = Math.max(1, Math.ceil(this.totalOrders / this.pageSize) || 1, hasNext ? this.page + 1 : 1);

        this.actualizarOrdenesFiltradas();  // aplicar filtros con la data nueva
        this.spinner.hide();
      },
      error: (err) => {
        this.spinner.hide();
        console.error('Error al cargar los pedidos:', err);
      }
    });
  }

  nextPage(): void {
    if (this.page < this.totalPages) { this.page++; this.loadOrders(); }
  }
  prevPage(): void {
    if (this.page > 1) { this.page--; this.loadOrders(); }
  }

  onPaginationPage(page: number): void {
    if (page === this.page) return;
    this.page = page;
    this.loadOrders();
  }

  onPaginationPageSize(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.loadOrders();
  }

  get searchTerm(): string { return this._searchTerm; }
  /** La búsqueda se resuelve en el backend al terminar de escribir. */
  set searchTerm(value: string) {
    this._searchTerm = value || '';
    this.searchBackend();
  }

  get hasActiveFilters(): boolean {
    return !!this._searchTerm.trim() || !!this.estadoFiltro || !!this.tipoFiltro || !!this.fromDate || !!this.toDate;
  }

  onTipoChange(): void {
    this.page = 1;
    this.loadOrders();
  }

  onDatesChange(range: FilterDates): void {
    this.fromDate = range.from;
    this.toDate = range.to;
    this.page = 1;
    this.loadOrders();
  }

  /** Compatibilidad con la plantilla: la página ya viene filtrada del backend. */
  actualizarOrdenesFiltradas(): void {
    this.ordersFiltradosList = Array.isArray(this.orders) ? [...this.orders] : [];
  }

  limpiarFiltros(): void {
    this._searchTerm = '';
    this.tipoFiltro = '';
    this.estadoFiltro = '';
    this.fromDate = '';
    this.toDate = '';
    this.page = 1;
    this.loadOrders();
  }

  setEstadoFiltro(value: string): void {
    this.estadoFiltro = value as EstadoOrden;
    this.page = 1;
    this.loadOrders();
  }

  getEstadoBadgeClass(value: any): string {
    const st = this.getCanonicalStatus(value);
    if (st === 'Ingresada') return 'badge-red';
    if (st === 'Preparación') return 'badge-yellow';
    if (st === 'Cerrada') return 'badge-green';
    return 'badge-gray';
  }

  isCerrada(order: any): boolean {
    console.log('order', order);
    console.log('order?.status', order?.status);
    return this.getCanonicalStatus(order?.status) === 'Cerrada';
  }

  getCanonicalStatus(value: any): string {
    const normalized = this.normalizeStatus(value);
    if (!normalized) return '';
    if (normalized.includes('ingres')) return 'Ingresada';
    if (normalized.includes('prepar')) return 'Preparación';
    if (normalized.includes('cerr') || normalized.includes('lista') || normalized.includes('entreg')) return 'Cerrada';
    return String(value ?? '');
  }

  toggleOrderDetail(order: any) {
    this.activeTab = 'info';
    this.orderSelected = this.normalizeOrderForModal(order || {});
    console.log('orderSelected', this.orderSelected);
    this.mostrarModal = true;
  }

  cerrarModal() { this.mostrarModal = false; }

  openClosedOrderDetail(order: any): void {
    if (!order?.name) return;

    this.spinner.show();
    this.ordersService.getById(order.name).subscribe({
      next: (res: any) => {
        const detail = res?.data || res?.message || order;
        this.orderSelected = this.normalizeOrderForModal(detail);
        this.mostrarModal = true;
        this.spinner.hide();
      },
      error: () => {
        this.orderSelected = this.normalizeOrderForModal(order);
        this.mostrarModal = true;
        this.spinner.hide();
      }
    });
  }

  printFromModal(order: any): void {
    this.orderSelected = this.normalizeOrderForModal(order || {});
    const type = String(this.orderSelected?.type || '').toLowerCase();

    if (type.includes('factura') && this.orderSelected?.sri?.invoice) {
      this.getFacturaPdf();
      return;
    }

    this.getNotaVentaPdf();
  }

  /** Por QZ Tray si este equipo tiene impresora de comandas; si no, la ventana de siempre. */
  getComandaPdf() {
    const name = this.orderSelected.name;
    this.printStation.printComanda(name, false, () => this.openComandaWindow(name));
  }

  private openComandaWindow(name: string) {
    const order = this.url + this.printService.getComanda(name);
    const width = 800;
    const height = 800;

    const left = window.screenX + (window.innerWidth - width) / 2;
    const top = window.screenY + (window.innerHeight - height) / 2;

    const features = [
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      'toolbar=no',
      'location=no',
      'directories=no',
      'status=no',
      'menubar=no',
      'scrollbars=yes',
      'resizable=yes',
    ];

    const printWindow = window.open(order, '_blank', features.join(','));

    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }


    // printWindow.document.open();
    // printWindow.document.close();

  }

  // validarYGenerarFactura() {
  //   this.spinner.show();
  //   this.ordersService.validar_y_generar_factura(this.orderSelected.name).subscribe({
  //     next: (res: any) => {
  //       console.log('res', res);
  //       this.spinner.hide();
  //       toast.success('Factura regenerada con éxito');
  //       this.loadOrders();
  //       this.cerrarModal();
  //     },
  //     error: (err) => {
  //       this.spinner.hide();
  //       console.error('Error al cargar los pedidos:', err);
  //     }
  //   });
  // }

  getFacturaPdf() {
    const order = this.url + this.printService.getFacturaPdf(this.orderSelected.sri.invoice);
    const printWindow = window.open(order, '_blank');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }
  }


  getNotaVentaPdf() {
    const order = this.url + this.printService.getNotaVentaPdf(this.orderSelected.name);
    const printWindow = window.open(order, '_blank');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }
  }

  get isMeseroOrCajero(): boolean {
    return this.roleName === 'Mesero' || this.roleName === 'Cajero';
  }

  private detectRole(): 'Gerente' | 'Cajero' | 'Mesero' | 'Desconocido' {
    const raw = localStorage.getItem('user');
    if (!raw) return 'Desconocido';

    try {
      const user = JSON.parse(raw);
      const role = String(user?.roles?.[0] ?? '').toLowerCase();
      if (role.includes('mesero')) return 'Mesero';
      if (role.includes('cajero')) return 'Cajero';
      if (role.includes('gerente') || role.includes('admin')) return 'Gerente';
    } catch {
      return 'Desconocido';
    }

    return 'Desconocido';
  }

  private normalizeStatus(value: any): string {
    return String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  private normalizeOrderForModal(order: any): any {
    const customer = order?.customer || {};
    const sri = order?.sri || {};

    return {
      name: order?.name || '',
      status: this.getCanonicalStatus(order?.status) || order?.status || '',
      type: order?.type || 'Nota Venta',
      createdAt: order?.createdAt || order?.creation || '',
      createdAtISO: order?.createdAtISO || '',
      subtotal: Number(order?.subtotal ?? 0),
      iva: Number(order?.iva ?? 0),
      total: Number(order?.total ?? 0),
      customer: {
        nombre: customer?.nombre || customer?.fullName || 'Consumidor Final',
        num_identificacion: customer?.num_identificacion || '',
        correo: customer?.correo || '',
        telefono: customer?.telefono || '',
        direccion: customer?.direccion || '',
      },
      sri: {
        status: sri?.status || order?.estado_sri || 'Sin factura',
        authorization_datetime: sri?.authorization_datetime || '',
        access_key: sri?.access_key || '',
        invoice: sri?.invoice || '',
        number: sri?.number || '',
      },
      items: Array.isArray(order?.items) ? order.items : [],
      payments: Array.isArray(order?.payments) ? order.payments : [],
    };
  }

}
