import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { OrdersService } from 'src/app/services/orders.service';

@Component({
  selector: 'app-orders',
  imports: [CommonModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css'
})
export class OrdersComponent implements OnInit {

  orders: any[] = [];
  orderSelected: any | null = null;
  expandedOrderId: number | null = null;
  mostrarModal: boolean = false;
  constructor(private ordersService: OrdersService) { }
  ngOnInit() {
    // Simula la carga de datos desde el backend
    this.loadOrders();
  }

  //cargar order
  // Cargar pedidos desde el servicio
  loadOrders(): void {
    this.ordersService.getAll().subscribe({
      next: (orders) => {
        console.log('Pedidos cargados:', orders);
        this.orders = orders;
      },
      error: (err) => {
        console.error('Error al cargar los pedidos:', err);
        // Aquí podrías mostrar un mensaje al usuario si deseas
      }
    });
  }

  toggleOrderDetail(order: any) {
    this.orderSelected = order  ? order : null;
    this.mostrarModal = true;

  }

  cerrarModal() {
    this.mostrarModal = false;
    // this.productoEditando = null;
    // this.productoForm = this.resetForm();
  }
}