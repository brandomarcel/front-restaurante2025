import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';

import { RealtimeOrdersService, OrderVM } from 'src/app/services/realtime-orders.service';
import { OrdersService } from 'src/app/services/orders.service';
import { UtilsService } from '../../core/services/utils.service';

import { OrderCardComponent } from './ui/order-card/order-card.component';
import { OrderTableComponent } from './ui/order-table/order-table.component';
import { OrderModalComponent } from './ui/order-modal/order-modal.component';

@Component({
  selector: 'app-orders-realtime',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    OrderCardComponent,
    OrderTableComponent,
    OrderModalComponent
  ],
  templateUrl: './orders-realtime.component.html'
})
export class OrdersRealtimeComponent implements OnInit, OnDestroy {

  @ViewChild('topAnchor') topAnchor!: ElementRef;

  search = '';
  orders: OrderVM[] = [];
  newCount = 0;
  selectedOrder: OrderVM | null = null;

  total$ = this.rt.streamTotal();
  private sub = new Subscription();

  constructor(
    private rt: RealtimeOrdersService,
    private ordersApi: OrdersService,
    private utils: UtilsService
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

  scrollToTop() {
    this.topAnchor.nativeElement.scrollIntoView({ behavior: 'smooth' });
    this.rt.markNewSeen();
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
    o.status = 'Cerrada';
    this.ordersApi.updateStatus(o.name, 'Cerrada').subscribe();
  }
}
