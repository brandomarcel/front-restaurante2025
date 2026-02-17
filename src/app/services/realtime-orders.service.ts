import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { OrdersService, OrdersListResponse } from './orders.service';
import { FrappeSocketService } from './frappe-socket.service';

export interface OrderVM {
  name: string;
  status: string;
  type?: string;
  createdAt?: string;
  subtotal?: number;
  iva?: number;
  total?: number;
  customer?: any;
  sri?: { status?: string };
  usuario?: string;
  items?: any[];
  payments?: any[];
  _ts?: number;
}

@Injectable({ providedIn: 'root' })
export class RealtimeOrdersService {

  private orders$ = new BehaviorSubject<OrderVM[]>([]);
  private newCount$ = new BehaviorSubject<number>(0);
  private total$ = new BehaviorSubject<number>(0);

  constructor(
    private api: OrdersService,
    private sock: FrappeSocketService
  ) {
    const companyId = localStorage.getItem('companyId') ?? 'DEFAULT';
    this.sock.connect();

    this.sock.on<any>(`brando_conect:company:${companyId}`, (evt) => {
      if (!evt?.data) return;

      const vm = this.mapSocket(evt.data);
      const exists = this.orders$.value.some(o => o.name === vm.name);

      this.upsert(vm);

      if (!exists) {
        this.newCount$.next(this.newCount$.value + 1);
      }
    });
  }

  loadInitial(limit = 50, offset = 0, from?: any, to?: any): void {
    this.api.getAll(limit, offset, from, to)
      .subscribe((res: OrdersListResponse) => {
        const list = (res?.message?.data ?? []).map((o: any) => this.mapRest(o));
        this.orders$.next([...list]);
        this.total$.next(res?.message?.total ?? list.length);
      });
  }

  streamOrders() { return this.orders$.asObservable(); }
  streamNewCount() { return this.newCount$.asObservable(); }
  streamTotal() { return this.total$.asObservable(); }
  markNewSeen() { this.newCount$.next(0); }

  private upsert(row: OrderVM) {
    const list = [...this.orders$.value];
    const i = list.findIndex(x => x.name === row.name);

    row._ts = row.createdAt ? new Date(row.createdAt).getTime() : Date.now();

    if (i >= 0) {
      list[i] = { ...list[i], ...row };
    } else {
      list.unshift(row);
    }

    list.sort((a, b) => (b._ts ?? 0) - (a._ts ?? 0));
    this.orders$.next([...list]);
  }

  private mapRest(o: any): OrderVM {
    return {
      name: o.name,
      status: o.status,
      type: o.type,
      createdAt: o.createdAtISO || o.createdAt,
      subtotal: o.subtotal,
      iva: o.iva,
      total: o.total,
      customer: o.customer,
      sri: o.sri,
      usuario: o.usuario,
      items: o.items ?? [],
      payments: o.payments ?? [],
      _ts: o.createdAtISO ? new Date(o.createdAtISO).getTime() : Date.now()
    };
  }

  private mapSocket(o: any): OrderVM {
    return {
      name: o.name,
      status: o.status,
      type: o.estado,
      createdAt: o.creation,
      subtotal: o.subtotal,
      iva: o.iva,
      total: o.total,
      customer: { nombre: o.nombre_cliente ?? 'Consumidor Final' },
      sri: { status: o.estado_sri },
      usuario: o.owner,
      items: o.items ?? [],
      payments: o.payments ?? [],
      _ts: o.creation ? new Date(o.creation).getTime() : Date.now()
    };
  }
}
