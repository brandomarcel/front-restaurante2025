import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { RealtimeOrdersService, OrderVM } from 'src/app/services/realtime-orders.service';
import { OrdersService } from 'src/app/services/orders.service';
import { Subscription } from 'rxjs';

// Pipe de filtros (asegúrate de que exista y sea standalone)
import { OrderRealtimeFilterPipe } from 'src/app/core/pipes/order-realtime-filter';
import { UtilsService } from '../../core/services/utils.service';

@Component({
  selector: 'app-orders-realtime',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, OrderRealtimeFilterPipe],
  templateUrl: './orders-realtime.component.html'
})
export class OrdersRealtimeComponent implements OnInit, OnDestroy {
  // filtros UI
  search: string = '';
  tipo: string = '';

  // data
  orders: OrderVM[] = [];
  newCount = 0;

  // total (observable por si lo quieres mostrar en la barra)
  total$ = this.rt.streamTotal();

  private sub = new Subscription();

  @ViewChild('topAnchor') topAnchor!: ElementRef;

  constructor(
    private rt: RealtimeOrdersService,
    private ordersApi: OrdersService,
    private utilsService: UtilsService
  ) {}

  ngOnInit(): void {
    // carga inicial (página 0, 20 items)
    const today = this.utilsService.getSoloFechaEcuador(); // "2025-10-27"

    this.sub.add(
      this.rt.loadInitial(20, 0, today, today).subscribe(list => {
        this.orders = list;
        // console.log('[init list]', list);
      })
    );

    // stream en tiempo real
    this.sub.add(
      this.rt.streamOrders().subscribe(list => {
        this.orders = list;
        // console.log('[stream list]', list);
      })
    );

    // contador de nuevos
    this.sub.add(
      this.rt.streamNewCount().subscribe(n => this.newCount = n)
    );
  }

  scrollToTop() {
    this.topAnchor?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.rt.markNewSeen();
  }

  trackByName = (_: number, item: OrderVM) => item.name;

  /** Helper: imprime el nombre del cliente seguro */
  getCustomerName(o: OrderVM): string {
    if (!o?.customer) return '—';
    return typeof o.customer === 'string'
      ? o.customer
      : (o.customer?.['nombre'] || '—');
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  toPreparacion(o: OrderVM) {
  const prev = o.status;
  // optimista
  o.status = 'Preparación';
  (o as any)._flash = true;
  (o as any)._flashType = 'update';

  this.ordersApi.updateStatus(o.name, 'Preparación').subscribe({
    next: () => { /* el socket traerá el update real */ },
    error: () => { o.status = prev as any; delete (o as any)._flash; delete (o as any)._flashType; }
  });
}

toCerrada(o: OrderVM) {
  const prev = o.status;
  o.status = 'Cerrada';
  (o as any)._flash = true;
  (o as any)._flashType = 'update';

  this.ordersApi.updateStatus(o.name, 'Cerrada').subscribe({
    next: () => {},
    error: () => { o.status = prev as any; delete (o as any)._flash; delete (o as any)._flashType; }
  });
}


}
