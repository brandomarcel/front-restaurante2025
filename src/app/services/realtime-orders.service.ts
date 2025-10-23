// src/app/services/realtime-orders.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { OrdersService, OrderDTO, OrdersListResponse } from './orders.service';
import { FrappeSocketService } from './frappe-socket.service';

export interface OrderVM {
  name: string;
  type?: string;
  createdAt?: string;
  subtotal?: number;
  iva?: number;
  total?: number;
  customer?: { nombre?: string } | string;
  sri?: { status?: string };
  usuario?: string;
  items?: any[];
  _flash?: boolean;
}

@Injectable({ providedIn: 'root' })
export class RealtimeOrdersService {
  private readonly DT_LC = 'Orders';

  private orders$ = new BehaviorSubject<OrderVM[]>([]);
  private newCount$ = new BehaviorSubject<number>(0);
  private total$ = new BehaviorSubject<number>(0);
  private firstLoadDone = false;

  constructor(
    private api: OrdersService,
    private sock: FrappeSocketService
  ) {
    // Conexión + suscripción al room correcto
    this.sock.connect();
    this.sock.subscribe(`doctype:${this.DT_LC}`);

    // Evento estándar: list_update
    this.sock.on<any>('list_update', (evt) => {
      // if (evt?.doctype !== 'Orders') return;
      // debería loguearse aquí cuando hagas la prueba del paso 1
      console.log('[list_update]', evt);
      if (evt._action === 'delete') this.remove(evt.name);
      else this.refreshOne(evt.name, this.firstLoadDone);
    });

    // Evento estándar: list_update
    this.sock.on<any>('debug_broadcast', (evt) => {
      // if (evt?.doctype !== 'Orders') return;
      // debería loguearse aquí cuando hagas la prueba del paso 1
      console.log('[debug_broadcast]', evt);
      // if (evt._action === 'delete') this.remove(evt.name);
      // else this.refreshOne(evt.name, this.firstLoadDone);
    });

    this.sock.on<any>('brando_conect', (evt) => {
      // if (evt?.doctype !== 'Orders') return;
      // debería loguearse aquí cuando hagas la prueba del paso 1
      console.log('[brando_conect]', evt);
      // if (evt._action === 'delete') this.remove(evt.name);
      // else this.refreshOne(evt.name, this.firstLoadDone);
    });


    // (Opcional) Evento custom con doc completo: order_created
    // Actívalo si lo publicas en el backend
    // this.sock.on<OrderDTO>('order_created', (order) => this.upsertFromServer(order, true));
  }

  /** Carga inicial usando tu getAll(limit, offset) */
  loadInitial(limit = 20, offset = 0) {
    this.api.getAll(limit, offset).subscribe((res: OrdersListResponse) => {
      const list = this.mapList(res);
      this.orders$.next(list);
      this.total$.next(res.message?.total ?? list.length);
      this.firstLoadDone = true;
    });
    return this.orders$;
  }

  // Streams públicos para la UI
  streamOrders() { return this.orders$.asObservable(); }
  streamNewCount() { return this.newCount$.asObservable(); }
  streamTotal() { return this.total$.asObservable(); }
  markNewSeen() { this.newCount$.next(0); }

  /** ===== Helpers ===== */

  /** Refresca una orden específica desde la API (por name) y hace upsert */
  private refreshOne(name: string, flash = false) {
    this.api.getById(name).subscribe({
      next: (r) => {
        const doc = (r as any)?.data || (r as any)?.message || r; // tolerante
        const vm = this.mapOne(doc as OrderDTO);
        if (vm) this.upsert(vm, flash);
      },
      error: () => {
        // fallback: placeholder para mostrar "llegó algo"
        this.upsert({ name, _flash: flash }, flash);
      }
    });
  }

  /** Si recibes el doc completo desde el socket (order_created), úsalo directo */
  upsertFromServer(doc: OrderDTO, flash = true) {
    const vm = this.mapOne(doc);
    this.upsert(vm, flash);
  }

  /** Inserta o actualiza en memoria */
  private upsert(row: OrderVM, flash = false) {
    const list = [...this.orders$.value];
    const i = list.findIndex(x => x.name === row.name);

    if (i >= 0) {
      list[i] = { ...list[i], ...row, _flash: flash };
    } else {
      list.unshift({ ...row, _flash: flash });
      if (flash) this.newCount$.next(this.newCount$.value + 1);
      this.total$.next(this.total$.value + 1);
    }

    this.orders$.next(list);

    // Quita efecto flash luego de 1.5s
    if (flash) setTimeout(() => {
      const cur = [...this.orders$.value];
      const idx = cur.findIndex(x => x.name === row.name);
      if (idx >= 0) { delete cur[idx]._flash; this.orders$.next(cur); }
    }, 1500);
  }

  private remove(name: string) {
    const filtered = this.orders$.value.filter(x => x.name !== name);
    if (filtered.length !== this.orders$.value.length) {
      this.total$.next(Math.max(0, this.total$.value - 1));
    }
    this.orders$.next(filtered);
  }

  /** Mapea tu respuesta paginada -> VM */
  private mapList(res: OrdersListResponse): OrderVM[] {
    const arr = res?.message?.data ?? [];   // 👈 tu payload real
    return arr.map(this.mapOne);
  }

  /** Mapea una OrderDTO -> VM que usa la UI */
  private mapOne = (o: OrderDTO): OrderVM => ({
    name: o.name,
    type: o.type,
    createdAt: o.createdAt,
    subtotal: o.subtotal,
    iva: o.iva,
    total: o.total,
    customer: o.customer?.nombre || o.customer, // para UI simple
    sri: o.sri ? { status: o.sri.status } : undefined,
    usuario: o.usuario,
    items: o.items
  });
}
