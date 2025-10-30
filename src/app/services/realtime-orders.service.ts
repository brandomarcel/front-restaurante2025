// src/app/services/realtime-orders.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject, debounceTime } from 'rxjs';
import { OrdersService, OrderDTO, OrdersListResponse } from './orders.service';
import { FrappeSocketService } from './frappe-socket.service';
import { UserService } from './user.service';

export interface OrderVM {
  name: string;
  type?: string;
  createdAt?: string;
  subtotal?: number;
  iva?: number;
  total?: number;
  customer?: string | { nombre?: string };
  sri?: { status?: string };
  usuario?: string;
  items?: any[];
  _flash?: boolean;
  _ts?: number; // timestamp interno para ordenar y anti desincronización
  _flashType?: 'insert' | 'update' | 'delete'; // 👈 nuevo
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class RealtimeOrdersService {
  private readonly DT_LC = 'orders'; // 👈 importante: minúsculas

  private orders$ = new BehaviorSubject<OrderVM[]>([]);
  private newCount$ = new BehaviorSubject<number>(0);
  private total$ = new BehaviorSubject<number>(0);
  private firstLoadDone = false;

  private refetchTrigger = new Subject<void>();

  constructor(
    private api: OrdersService,
    private sock: FrappeSocketService,
    private userService: UserService
  ) {

    console.log('[RealtimeOrdersService] initializing...', localStorage.getItem('companyId'));

    const companyId = localStorage.getItem('companyId');
    // 1️⃣ Conectar y suscribirse al canal correcto
    this.sock.connect();

    // 👇 suscríbete al room que coincide con el backend
    // this.sock.subscribe('doctype:orders'); // ✅ room permitido

    // 2️⃣ Escuchar tu evento personalizado desde Frappe
    
    this.sock.on<any>(`brando_conect:company:${companyId}`, (evt) => {
      console.log('[ws] brando_conect event received:', evt);
      if (!evt?.name) return;
      if ((evt.company || 'DEFAULT') !== companyId) return; // filtra multiempresa
      console.log('PASO DE COMPANY');
      const action = (evt._action || '').toLowerCase() as 'insert' | 'update' | 'delete';

      if (action === 'delete') {
        // pinta como delete un instante antes de quitarlo (opcional)
        this.upsert({ name: evt.name, _flash: true, _flashType: 'delete' }, true, false);
        setTimeout(() => this.remove(evt.name), 300);
        this.refetchTrigger.next();
      } else {
        this.refreshOne(evt.name, this.firstLoadDone, action); // 👈 pasa el tipo
      }
    });


    // 3️⃣ Reconciliación (re-fetch después de un pequeño delay)
    this.refetchTrigger.pipe(debounceTime(600)).subscribe(() => {
      this.api.getAll(20, 0).subscribe((res: OrdersListResponse) => {
        const list = this.mapList(res);
        this.orders$.next(list);
        this.total$.next(res.message?.total ?? list.length);
      });
    });
  }

  /** ===== API pública para la UI ===== */

  /** Carga inicial desde tu backend */
  loadInitial(limit = 20, offset = 0, createdFrom?: any, createdTo?: any) {
    this.api.getAll(limit, offset, createdFrom, createdTo).subscribe((res: OrdersListResponse) => {
      const list = this.mapList(res);
      this.orders$.next(list);
      this.total$.next(res.message?.total ?? list.length);
      this.firstLoadDone = true;
    });
    return this.orders$;
  }

  streamOrders() { return this.orders$.asObservable(); }
  streamNewCount() { return this.newCount$.asObservable(); }
  streamTotal() { return this.total$.asObservable(); }
  markNewSeen() { this.newCount$.next(0); }

  /** ===== Helpers internos ===== */

  /** Obtiene una orden específica y la actualiza localmente */
  private refreshOne(name: string, flash = false, flashType: 'insert' | 'update' = 'update') {
    this.api.getById(name).subscribe({
      next: (r) => {
        const doc = (r as any)?.data || (r as any)?.message || r;
        const vm = this.mapOne(doc as OrderDTO);
        if (vm) this.upsert({ ...vm, _flashType: flashType }, flash, flashType === 'insert');
      },
      error: () => {
        this.upsert({ name, _flash: flash, _flashType: flashType }, flash, flashType === 'insert');
      }
    });
  }


  /** Inserta o actualiza una orden en memoria */
  // orden lógico de estados: primero lo más “activo”
  STATUS_ORDER: Record<string, number> = {
    'Ingresada': 0,
    'Preparación': 1,
    'Cerrada': 2
  };

  private upsert(row: OrderVM, flash = false, isNew = false) {
    const list = [...this.orders$.value];
    const i = list.findIndex(x => x.name === row.name);

    // normaliza fecha y timestamp
    if (row.createdAt) row.createdAt = this.toIsoLike(row.createdAt);
    let ts = row.createdAt ? new Date(row.createdAt).getTime() : undefined;

    if (i >= 0) {
      const prev = list[i];

      // si no vino fecha, conserva la anterior
      if (!ts) ts = prev._ts ?? Date.now();
      row._ts = ts;

      // evita sobrescribir con algo más viejo
      if (prev._ts && row._ts && row._ts < prev._ts) return;

      // detectar cambio de estado
      const prevStatus = (prev.status || prev.type) as string | undefined;
      const nextStatus = (row.status || row.type) as string | undefined;
      const statusChanged = !!prevStatus && !!nextStatus && prevStatus !== nextStatus;

      // si solo cambió de estado y no pediste flash explícito, flashea como update
      const nextFlash = flash || statusChanged;
      const nextFlashType = (row._flashType ?? (statusChanged ? 'update' : prev._flashType)) as OrderVM['_flashType'];

      list[i] = { ...prev, ...row, _flash: nextFlash, _flashType: nextFlashType };
    } else {
      // nuevo registro
      if (!ts) ts = Date.now();
      row._ts = ts;

      list.unshift({ ...row, _flash: flash, _flashType: row._flashType ?? 'insert' });

      if (isNew) this.newCount$.next(this.newCount$.value + 1);
      this.total$.next(this.total$.value + 1);
    }

    // ordenar por status y luego por fecha desc
    list.sort((a, b) => {
      const ra = this.STATUS_ORDER[(a.status || a.type || '')] ?? 99;
      const rb = this.STATUS_ORDER[(b.status || b.type || '')] ?? 99;
      if (ra !== rb) return ra - rb;
      return (b._ts ?? 0) - (a._ts ?? 0);
    });

    this.orders$.next(list);

    // limpiar flash luego de un ratito
    // const flashedName = row.name;
    // const shouldClear = flash || (i >= 0 && ((list[i]?._flash) || row._flash));
    // if (shouldClear) {
    //   setTimeout(() => {
    //     const cur = [...this.orders$.value];
    //     const idx = cur.findIndex(x => x.name === flashedName);
    //     if (idx >= 0) {
    //       delete cur[idx]._flash;
    //       delete cur[idx]._flashType;
    //       this.orders$.next(cur);
    //     }
    //   }, 1500);
    // }
  }



  /** Elimina una orden localmente */
  private remove(name: string) {
    const filtered = this.orders$.value.filter(x => x.name !== name);
    if (filtered.length !== this.orders$.value.length) {
      this.total$.next(Math.max(0, this.total$.value - 1));
    }
    this.orders$.next(filtered);
  }

  /** Convierte respuesta paginada del backend a VM */
  private mapList(res: OrdersListResponse): OrderVM[] {
    const arr = res?.message?.data ?? [];
    return arr.map(this.mapOne);
  }

  /** Convierte un OrderDTO a ViewModel */
  private mapOne = (o: OrderDTO): OrderVM => ({
    name: o.name,
    status: (o as any).status || (o as any).estado || o.type, // 👈 preferimos status
    type: o.type, // opcional, puedes eliminarlo si ya usas 'status' en la UI
    createdAt: this.toIsoLike((o as any).createdAtISO || o.createdAt),
    subtotal: o.subtotal,
    iva: o.iva,
    total: o.total,
    customer: typeof o.customer === 'string' ? o.customer : o.customer?.nombre || '—',
    sri: o.sri ? { status: o.sri.status } : undefined,
    usuario: o.usuario,
    items: o.items,
    _ts: o.createdAt ? new Date(o.createdAt).getTime() : Date.now()
  });


  /** Convierte "YYYY-MM-DD hh:mm:ss" → "YYYY-MM-DDThh:mm:ss" para DatePipe */
  private toIsoLike(s?: string): string | undefined {
    if (!s) return s;
    return s.includes('T') ? s : s.replace(' ', 'T');
  }
}
