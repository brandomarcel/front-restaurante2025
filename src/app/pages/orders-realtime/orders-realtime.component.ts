import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { RealtimeOrdersService, OrderVM } from 'src/app/services/realtime-orders.service';
import { OrdersService } from 'src/app/services/orders.service';
import { UtilsService } from 'src/app/core/services/utils.service';

import { OrderCardComponent } from './ui/order-card/order-card.component';
import { OrderKitchenCardComponent } from './ui/order-kitchen-card/order-kitchen-card.component';
import { OrderModalComponent } from './ui/order-modal/order-modal.component';
import { OrderTableComponent } from './ui/order-table/order-table.component';
import { Router } from '@angular/router';

@Component({
  selector: 'app-orders-realtime',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    OrderCardComponent,
    OrderKitchenCardComponent,
    OrderModalComponent,
    OrderTableComponent
  ],
  templateUrl: './orders-realtime.component.html'
})
export class OrdersRealtimeComponent implements OnInit, OnDestroy {

  orders: OrderVM[] = [];
  selectedOrder: OrderVM | null = null;
  modoCocina = false;
  search = '';
  newCount = 0;

  total$ = this.rt.streamTotal();
  private sub = new Subscription();

  constructor(
    private rt: RealtimeOrdersService,
    private ordersApi: OrdersService,
    private utils: UtilsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const today = this.utils.getSoloFechaEcuador();
    this.rt.loadInitial(50, 0, today, today);

    this.sub.add(
      this.rt.streamOrders().subscribe(list => {
        this.orders = list ?? [];
      })
    );

    this.sub.add(
      this.rt.streamNewCount().subscribe(n => this.newCount = n)
    );
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  toggleModoCocina() {
    this.modoCocina = !this.modoCocina;
  }

  open(o: OrderVM) {
    this.selectedOrder = o;
  }

  closeModal() {
    this.selectedOrder = null;
  }

  toPreparacion(o: OrderVM) {
    o.status = 'Preparación';
    this.ordersApi.updateStatus(o.name, 'Preparación').subscribe();
  }

  toCerrada(o: OrderVM) {
  const prev = o.status;

  o.status = 'Cerrada';
  (o as any)._flash = true;
  (o as any)._flashType = 'update';

  this.ordersApi.updateStatus(o.name, 'Cerrada').subscribe({
    next: () => {
      //  Navegar a pantalla de detalle
      this.router.navigate(['/dashboard/orders', o.name]);
    },
    error: () => {
      o.status = prev as any;
      delete (o as any)._flash;
      delete (o as any)._flashType;
    }
  });
}

}
