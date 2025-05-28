import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { OrdersService } from 'src/app/services/orders.service';
import { EcuadorTimePipe } from '../../core/pipes/ecuador-time-pipe.pipe';
import { NgxSpinnerService } from 'ngx-spinner';
import { NgxPaginationModule } from 'ngx-pagination';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-orders',
  imports: [CommonModule, EcuadorTimePipe, NgxPaginationModule,FormsModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})
export class OrdersComponent implements OnInit {

  orders: any[] = [];
  ordersFiltradosList: any[] = [];
  orderSelected: any | null = null;
  expandedOrderId: number | null = null;
  mostrarModal: boolean = false;

  page = 1;
  pageSize = 10;
  private _searchTerm: string = '';



  constructor(private ordersService: OrdersService,
    public spinner: NgxSpinnerService
  ) { }
  ngOnInit() {
    this.loadOrders();
  }

  //cargar order
  // Cargar pedidos desde el servicio
  loadOrders(): void {
    console.log(Intl.DateTimeFormat().resolvedOptions().timeZone);

    this.spinner.show();
    this.ordersService.getAll().subscribe({
      next: (orders: any) => {
        console.log('Pedidos cargados:', orders);

        this.orders = orders.message;
        this.ordersFiltradosList = [...this.orders]; // Inicializar la lista filtrada
        this.ordersFiltradosList.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        this.spinner.hide();
      },

      error: (err) => {
        this.spinner.hide();
        console.error('Error al cargar los pedidos:', err);
        // Aquí podrías mostrar un mensaje al usuario si deseas
      }
    });
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
    this.ordersFiltradosList = this.orders.filter(p =>
      p.name.toLowerCase().includes(term)
    );
  }

  toggleOrderDetail(order: any) {
    this.orderSelected = order ? order : null;
    this.mostrarModal = true;

  }

  cerrarModal() {
    this.mostrarModal = false;
    // this.productoEditando = null;
    // this.productoForm = this.resetForm();
  }
}