import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { OrdersService } from 'src/app/services/orders.service';
import { EcuadorTimePipe } from '../../core/pipes/ecuador-time-pipe.pipe';
import { NgxSpinnerService } from 'ngx-spinner';
import { NgxPaginationModule } from 'ngx-pagination';
import { FormsModule } from '@angular/forms';
import { PrintService } from 'src/app/services/print.service';
import { toast } from 'ngx-sonner';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';

import { RouterModule } from '@angular/router';
import { environment } from 'src/environments/environment.prod';
import { UtilsService } from 'src/app/core/services/utils.service';
import { OrderModalComponent } from '../orders-realtime/ui/order-modal/order-modal.component';

type EstadoOrden = '' | 'Ingresada' | 'Preparación' | 'Cerrada';

@Component({
  selector: 'app-orders',
  imports: [CommonModule,
    // EcuadorTimePipe,
    NgxPaginationModule,
    FormsModule, ButtonComponent,
    RouterModule,
    OrderModalComponent
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

  // NUEVOS filtros
  tipoFiltro: '' | 'Factura' | 'Nota Venta' = '';
  estadoFiltro: EstadoOrden = '';
  anulacionFiltro: '' | 'soloAnuladas' | 'excluirAnuladas' = '';

  private url = environment.URL
  constructor(
    private ordersService: OrdersService,
    public spinner: NgxSpinnerService,
    private printService: PrintService,
    private utils: UtilsService,

  ) { }

  ngOnInit() {
    this.roleName = this.detectRole();
    this.loadOrders();
    console.log('THIS.url', this.url);
  }

  loadOrders(): void {
    this.spinner.show();
    const offset = (this.page - 1) * this.pageSize;
    const today = String(this.utils.getSoloFechaEcuador());
    const createdFrom = this.isMeseroOrCajero ? today : undefined;
    const createdTo = this.isMeseroOrCajero ? today : undefined;

    this.ordersService.getAll(this.pageSize, offset, createdFrom, createdTo).subscribe({
      next: (res: any) => {
        console.log('res', res);
        this.orders = res.message.data || [];
        console.log('this.orders', this.orders);
        this.totalOrders = res.message.total || 0;
        this.totalPages = Math.ceil(this.totalOrders / this.pageSize) || 1;

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

  get searchTerm(): string { return this._searchTerm; }
  set searchTerm(value: string) {
    this._searchTerm = value || '';
    this.actualizarOrdenesFiltradas();
  }

  /** Determina si la orden está anulada (estado_sri que contenga 'anul') */
  private esAnulada(o: any): boolean {
    const estado = (o?.estado_sri || o?.sri?.estado_sri || '').toString().toLowerCase();
    return estado.includes('anul'); // cubre 'ANULADO', 'ANULADA'
  }

  /** Texto para búsqueda: name, cliente, identificación, tipo, estado */
  private textHayCoincidencia(o: any, term: string): boolean {
    if (!term) return true;
    const hay = [
      o?.name,
      o?.alias,
      o?.customer?.nombre,
      o?.customer?.num_identificacion,
      o?.type,
      o?.status,
      o?.estado_sri || o?.sri?.estado_sri
    ]
      .map(v => (v ?? '').toString().toLowerCase())
      .some(v => v.includes(term));
    return hay;
  }

  /** Aplica todos los filtros */
  actualizarOrdenesFiltradas(): void {
    const term = (this._searchTerm || '').toLowerCase();

    let lista = Array.isArray(this.orders) ? [...this.orders] : [];

    lista = lista.filter((o: any) => {
      // filtro por texto
      const byText = this.textHayCoincidencia(o, term);

      // filtro por tipo (Factura / Nota de venta)
      const byTipo = !this.tipoFiltro || (o?.type === this.tipoFiltro);
      const byEstado = !this.estadoFiltro || this.getCanonicalStatus(o?.status) === this.estadoFiltro;

      // filtro por anulación
      const anulada = this.esAnulada(o);
      const byAnulacion =
        this.anulacionFiltro === ''
          ? true
          : this.anulacionFiltro === 'soloAnuladas'
            ? anulada
            : !anulada; // 'excluirAnuladas'

      return byText && byTipo && byEstado && byAnulacion;
    });

    this.ordersFiltradosList = lista;
  }

  limpiarFiltros(): void {
    this._searchTerm = '';
    this.tipoFiltro = '';
    this.estadoFiltro = '';
    this.anulacionFiltro = '';
    this.actualizarOrdenesFiltradas();
  }

  setEstadoFiltro(value: EstadoOrden): void {
    this.estadoFiltro = value;
    this.actualizarOrdenesFiltradas();
  }

  countByEstado(value: EstadoOrden): number {
    const lista = Array.isArray(this.orders) ? this.orders : [];
    if (!value) return lista.length;
    return lista.filter((o: any) => this.getCanonicalStatus(o?.status) === value).length;
  }

  countByTipo(value: '' | 'Factura' | 'Nota Venta'): number {
    const lista = Array.isArray(this.orders) ? this.orders : [];
    if (!value) return lista.length;
    return lista.filter((o: any) => String(o?.type || '') === value).length;
  }

  isEstadoActivo(value: EstadoOrden): boolean {
    return this.estadoFiltro === value;
  }

  getEstadoBadgeClass(value: any): string {
    const st = this.getCanonicalStatus(value);
    if (st === 'Ingresada') return 'badge-red';
    if (st === 'PreparaciÃ³n') return 'badge-yellow';
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

  getComandaPdf() {
    const order = this.url + this.printService.getComanda(this.orderSelected.name);
    console.log('order', order);
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
