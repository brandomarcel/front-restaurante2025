import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { OrdersService } from 'src/app/services/orders.service';
import { EcuadorTimePipe } from '../../core/pipes/ecuador-time-pipe.pipe';
import { NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-orders',
  imports: [CommonModule, EcuadorTimePipe],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})
export class OrdersComponent implements OnInit {

  orders: any[] = [];
  orderSelected: any | null = null;
  expandedOrderId: number | null = null;
  mostrarModal: boolean = false;
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

        this.orders = orders;
        this.spinner.hide();
      },

      error: (err) => {
        this.spinner.hide();
        console.error('Error al cargar los pedidos:', err);
        // Aquí podrías mostrar un mensaje al usuario si deseas
      }
    });
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