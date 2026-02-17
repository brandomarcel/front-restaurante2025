import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, debounceTime } from 'rxjs';
import { OrdersService, OrdersListResponse } from './orders.service';
import { FrappeSocketService } from './frappe-socket.service';
import { UserService } from './user.service';

/* ================================
   MODELOS EXACTOS SEGÚN TU RAW
================================ */

export interface CustomerVM {
  nombre: string;
  num_identificacion: string;
  correo: string;
  telefono: string;
  direccion: string;
}

export interface OrderItemVM {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  tax_rate?: number;
  subtotal?: number;
  iva?: number;
  total?: number;
}

export interface SriVM {
  status: string;
  authorization_datetime?: string;
  access_key?: string;
  invoice?: string;
  number?: string;
  grand_total?: number;
}

export interface OrderVM {
  name: string;
  status: 'Ingresada' | 'Preparación' | 'Cerrada' | string;
  type: string;

  createdAt: string;
  createdAtISO?: string;

  subtotal: number;
  iva: number;
  total: number;

  customer: CustomerVM;
  sri: SriVM;
  usuario?: string;

  items: OrderItemVM[];
  payments: any[];

  _flash?: boolean;
  _flashType?: 'insert' | 'update' | 'delete';
  _ts?: number;
}

/* ================================= */

@Injectable({ providedIn: 'root' })
export class RealtimeOrdersService {

  private orders$ = new BehaviorSubject<OrderVM[]>([]);
  private newCount$ = new BehaviorSubject<number>(0);
  private total$ = new BehaviorSubject<number>(0);

  private refetchTrigger = new Subject<void>();
  private firstLoadDone = false;

  private readonly STATUS_ORDER: Record<string, number> = {
    'Ingresada': 0,
    'Preparación': 1,
    'Cerrada': 2
  };

  constructor(
    private api: OrdersService,
    private sock: FrappeSocketService,
    private userService: UserService
  ) {
    const companyId = localStorage.getItem('companyId') ?? 'DEFAULT';

    this.sock.connect();

    /* ================= SOCKET ================= */

    this.sock.on<any>(`brando_conect:company:${companyId}`, (evt) => {
      console.log('evt',evt);

      if (!evt?.name) return;
      if ((evt.company || 'DEFAULT') !== companyId) return;

      const action = (evt._action || '').toLowerCase() as 'insert' | 'update' | 'delete';

      // DELETE
      if (action === 'delete') {
        this.remove(evt.name);
        return;
      }

      // 🔥 IMPORTANTE: si viene data completa, úsala directo
      if (evt.data) {
        const vm = this.mapOne(evt.data);
        const exists = this.orders$.value.some(o => o.name === vm.name);

        this.upsert(vm, true, !exists);
        return;
      }

      // fallback (por seguridad)
      this.refreshOne(evt.name, action);
    });

    /* ============ Reconciliación suave ============ */

    this.refetchTrigger.pipe(debounceTime(600)).subscribe(() => {
      this.api.getAll(50, 0).subscribe((res: OrdersListResponse) => {
        const list = this.mapList(res);
        this.orders$.next([...list]);
        this.total$.next((res as any)?.message?.total ?? list.length);
      });
    });
  }

  /* ================= API PÚBLICA ================= */

  // ⚠️ IMPORTANTE: YA NO retorna observable
  loadInitial(limit = 50, offset = 0, createdFrom?: any, createdTo?: any): void {
    this.api.getAll(limit, offset, createdFrom, createdTo)
      .subscribe((res: OrdersListResponse) => {
        const list = this.mapList(res);
        this.orders$.next([...list]);
        this.total$.next((res as any)?.message?.total ?? list.length);
        this.firstLoadDone = true;
      });
  }

  streamOrders() { return this.orders$.asObservable(); }
  streamNewCount() { return this.newCount$.asObservable(); }
  streamTotal() { return this.total$.asObservable(); }
  markNewSeen() { this.newCount$.next(0); }

  /* ================= Internos ================= */

  private refreshOne(name: string, action: 'insert' | 'update') {
    this.api.getById(name).subscribe({
      next: (r) => {
        const doc = (r as any)?.data || (r as any)?.message || r;
        const vm = this.mapOne(doc);
        const exists = this.orders$.value.some(o => o.name === vm.name);
        this.upsert(vm, true, !exists);
      },
      error: () => {
        this.refetchTrigger.next();
      }
    });
  }

  private upsert(row: OrderVM, flash = false, isNew = false) {
    const list = [...this.orders$.value];
    const index = list.findIndex(o => o.name === row.name);

    row._ts = this.getTs(row);

    if (index >= 0) {
      const prev = list[index];

      if (prev._ts && row._ts && row._ts < prev._ts) return;

      list[index] = {
        ...prev,
        ...row,
        _flash: flash,
        _flashType: isNew ? 'insert' : 'update'
      };
    } else {
      list.unshift({
        ...row,
        _flash: flash,
        _flashType: 'insert'
      });

      if (isNew) {
        this.newCount$.next(this.newCount$.value + 1);
        this.total$.next(this.total$.value + 1);
      }
    }

    list.sort((a, b) => {
      const ra = this.STATUS_ORDER[a.status] ?? 99;
      const rb = this.STATUS_ORDER[b.status] ?? 99;
      if (ra !== rb) return ra - rb;
      return (b._ts ?? 0) - (a._ts ?? 0);
    });

    this.orders$.next([...list]); // 🔥 nueva referencia
  }

  private remove(name: string) {
    const filtered = this.orders$.value.filter(o => o.name !== name);
    this.orders$.next([...filtered]);
    this.total$.next(Math.max(0, this.total$.value - 1));
  }

  private mapList(res: OrdersListResponse): OrderVM[] {
    const arr = (res as any)?.message?.data ?? [];
    return Array.isArray(arr) ? arr.map(o => this.mapOne(o)) : [];
  }

  /* ================= MAPEO EXACTO A TU RAW ================= */

  private mapOne(o: any): OrderVM {
    const createdISO = o.createdAtISO || this.toIsoLike(o.createdAt);

    return {
      name: o.name,
      status: o.status ?? 'Ingresada',
      type: o.type ?? '',
      createdAt: o.createdAt ?? '',
      createdAtISO: createdISO,

      subtotal: Number(o.subtotal ?? 0),
      iva: Number(o.iva ?? 0),
      total: Number(o.total ?? 0),

      customer: {
        nombre: o.customer?.nombre ?? 'Consumidor Final',
        num_identificacion: o.customer?.num_identificacion ?? '',
        correo: o.customer?.correo ?? '',
        telefono: o.customer?.telefono ?? '',
        direccion: o.customer?.direccion ?? ''
      },

      sri: {
        status: o.sri?.status ?? ''
      },

      usuario: o.usuario ?? '',
      items: Array.isArray(o.items) ? o.items : [],
      payments: Array.isArray(o.payments) ? o.payments : [],

      _ts: createdISO ? new Date(createdISO).getTime() : Date.now()
    };
  }

  private getTs(o: OrderVM): number {
    const d = o.createdAtISO || this.toIsoLike(o.createdAt);
    const t = d ? new Date(d).getTime() : NaN;
    return Number.isFinite(t) ? t : Date.now();
  }

  private toIsoLike(s?: string): string {
    if (!s) return '';
    return s.includes('T') ? s : s.replace(' ', 'T');
  }
}
