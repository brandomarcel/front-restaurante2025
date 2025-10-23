// src/app/pages/orders-realtime/orders-realtime.component.ts
import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { RealtimeOrdersService, OrderVM } from 'src/app/services/realtime-orders.service';
import { OrdersService } from 'src/app/services/orders.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { OrderRealtimeFilterPipe } from 'src/app/core/pipes/order-realtime-filter';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-orders-realtime',
  standalone: true,
  imports: [CommonModule,OrderRealtimeFilterPipe,RouterModule,FormsModule],
  templateUrl: './orders-realtime.component.html'
})
export class OrdersRealtimeComponent implements OnInit, OnDestroy {
  search: string = '';   // ← usados por [(ngModel)]
  tipo: string = '';     // ← usados por [(ngModel)]

  orders: OrderVM[] = [];
  newCount = 0;
  private sub = new Subscription();

  @ViewChild('topAnchor') topAnchor!: ElementRef;

  constructor(
    private rt: RealtimeOrdersService,
    private ordersApi: OrdersService
  ) {}

total$ = this.rt.streamTotal();

ngOnInit(): void {
  this.sub.add(this.rt.loadInitial(20, 0).subscribe(list => {
    this.orders = list
    console.log('list', list);
  }));
  this.sub.add(this.rt.streamOrders().subscribe(list =>{
    this.orders = list
    console.log('list', list);
  }));
  this.sub.add(this.rt.streamNewCount().subscribe(n => this.newCount = n));
}

  scrollToTop() {
    this.topAnchor?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.rt.markNewSeen();
  }

  trackByName = (_: number, item: OrderVM) => item.name;

  /** Helper seguro para imprimir el cliente sin errores de parser */
getCustomerName(o: OrderVM): string {
  if (!o.customer) return '—';
  return typeof o.customer === 'string' ? o.customer : (o.customer.nombre || '—');
}


  ngOnDestroy(): void { this.sub.unsubscribe(); }
}