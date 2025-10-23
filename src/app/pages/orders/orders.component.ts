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


@Component({
  selector: 'app-orders',
  imports: [CommonModule,
    // EcuadorTimePipe,
    NgxPaginationModule,
    FormsModule, ButtonComponent,
    RouterModule
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

  // NUEVOS filtros
  tipoFiltro: '' | 'Factura' | 'Nota de venta' = '';
  anulacionFiltro: '' | 'soloAnuladas' | 'excluirAnuladas' = '';

  private url = environment.URL
  constructor(
    private ordersService: OrdersService,
    public spinner: NgxSpinnerService,
    private printService: PrintService,

  ) { }

  ngOnInit() {
    this.loadOrders();
    console.log('THIS.url', this.url);
  }

  loadOrders(): void {
    this.spinner.show();
    const offset = (this.page - 1) * this.pageSize;

    this.ordersService.getAll(this.pageSize, offset).subscribe({
      next: (res: any) => {
        console.log('res', res);
        this.orders = res.message.data || [];
        console.log('this.orders', this.orders);
        this.totalOrders = res.message.total || 0;
        this.totalPages = Math.ceil(this.totalOrders / this.pageSize) || 1;

        this.actualizarOrdenesFiltradas();  // ✅ aplicar filtros con la data nueva
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
      o?.customer?.nombre,
      o?.customer?.num_identificacion,
      o?.type,
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

      // filtro por anulación
      const anulada = this.esAnulada(o);
      const byAnulacion =
        this.anulacionFiltro === ''
          ? true
          : this.anulacionFiltro === 'soloAnuladas'
            ? anulada
            : !anulada; // 'excluirAnuladas'

      return byText && byTipo && byAnulacion;
    });

    this.ordersFiltradosList = lista;
  }

  limpiarFiltros(): void {
    this._searchTerm = '';
    this.tipoFiltro = '';
    this.anulacionFiltro = '';
    this.actualizarOrdenesFiltradas();
  }

  toggleOrderDetail(order: any) {
    this.activeTab = 'info';
    this.orderSelected = order || null;
    console.log('orderSelected', this.orderSelected);
    this.mostrarModal = true;
  }

  cerrarModal() { this.mostrarModal = false; }

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

}