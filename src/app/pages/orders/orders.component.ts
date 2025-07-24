import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { OrdersService } from 'src/app/services/orders.service';
import { EcuadorTimePipe } from '../../core/pipes/ecuador-time-pipe.pipe';
import { NgxSpinnerService } from 'ngx-spinner';
import { NgxPaginationModule } from 'ngx-pagination';
import { FormsModule } from '@angular/forms';
import { PrintService } from 'src/app/services/print.service';
import { toast } from 'ngx-sonner';

@Component({
  selector: 'app-orders',
  imports: [CommonModule, EcuadorTimePipe, NgxPaginationModule, FormsModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})
export class OrdersComponent implements OnInit {

  orders: any;
  ordersFiltradosList: any[] = [];
  orderSelected: any | null = null;
  expandedOrderId: number | null = null;
  mostrarModal: boolean = false;

  page = 1;
  pageSize = 15;
  totalOrders = 0; // se actualiza desde la respuesta
  totalPages = 1;

  private _searchTerm: string = '';
activeTab = 'info'; // 'info' o 'sri'


  constructor(private ordersService: OrdersService,
    public spinner: NgxSpinnerService,
    private printService: PrintService,
  ) { }
  ngOnInit() {
    this.loadOrders();
  }

  //cargar order
  // Cargar pedidos desde el servicio
  loadOrders(): void {
    this.spinner.show();

    const offset = (this.page - 1) * this.pageSize;

    this.ordersService.getAll(this.pageSize, offset).subscribe({
      next: (res: any) => {

        console.log('res', res);
        this.orders = res.message.data;
        this.totalOrders = res.message.total;
        this.totalPages = Math.ceil(this.totalOrders / this.pageSize);

        this.ordersFiltradosList = [...this.orders];
        this.spinner.hide();
      },
      error: (err) => {
        this.spinner.hide();
        console.error('Error al cargar los pedidos:', err);
      }
    });
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.loadOrders();
    }
  }

  prevPage(): void {
    if (this.page > 1) {
      this.page--;
      this.loadOrders();
    }
  }


  get searchTerm(): string {
    return this._searchTerm;
  }

  set searchTerm(value: string) {
    this._searchTerm = value;
    this.actualizarProductosFiltrados(); // se actualiza cada vez que el usuario escribe
  }

  actualizarProductosFiltrados() {
    const term = this._searchTerm.toLowerCase();
    this.ordersFiltradosList = this.orders.filter((p: any) =>
      p.name.toLowerCase().includes(term)
    );
  }

  toggleOrderDetail(order: any) {
    this.activeTab = 'info';
    this.orderSelected = order ? order : null;
    console.log('this.orderSelected', this.orderSelected);
    this.mostrarModal = true;

  }

  cerrarModal() {
    this.mostrarModal = false;
    // this.productoEditando = null;
    // this.productoForm = this.resetForm();
  }

  getComandaPdf() {
    const order = 'http://207.180.197.160:1012' + this.printService.getComandaPdf(this.orderSelected.name);
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

  validarYGenerarFactura() {
    this.spinner.show();
    this.ordersService.validar_y_generar_factura(this.orderSelected.name).subscribe({
      next: (res: any) => {
        console.log('res', res);
        this.spinner.hide();
        toast.success('Factura regenerada con éxito');
        this.loadOrders();
        this.cerrarModal();
      },
      error: (err) => {
        this.spinner.hide();
        console.error('Error al cargar los pedidos:', err);
      }
    });
  }

  getFacturaPdf() {
    const order = 'http://207.180.197.160:1012' + this.printService.getFacturaPdf(this.orderSelected.name);
    const printWindow = window.open(order, '_blank');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }
  }


    getNotaVentaPdf() {
    const order = 'http://207.180.197.160:1012' + this.printService.getNotaVentaPdf(this.orderSelected.name);
    const printWindow = window.open(order, '_blank');
    if (!printWindow) {
      toast.error('No se pudo abrir la ventana de impresión');
      return;
    }
  }

}