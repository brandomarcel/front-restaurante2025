// src/app/services/frappe-socket.service.ts
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class FrappeSocketService {
  private socket?: Socket; // socket del namespace
  private rooms = new Set<string>();
  private documents = new Map<string, { doctype: string; name: string; subscribers: number }>();
  private listeners = new Map<string, Map<(...args: any[]) => void, (...args: any[]) => void>>();

  private connectedSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<any>(null);

  connected$: Observable<boolean> = this.connectedSubject.asObservable();
  lastError$: Observable<any> = this.errorSubject.asObservable();

  /**
   * Namespace de Socket.IO = nombre del sitio Frappe; el realtime rechaza la
   * conexión si no coincide con el sitio del dominio. Lo manda el backend en
   * `get_user_context.site` (un mismo build sirve varios dominios/sitios); se
   * recuerda por dominio para conectar bien al recargar, y el valor del
   * environment queda como respaldo.
   */
  private site = cleanSite(readStoredSite()) || cleanSite(environment.frappeSiteNamespace);

  constructor(private zone: NgZone) { }

  /** Fija el sitio que informa el backend; si cambió, reconecta al namespace correcto. */
  setSite(name: unknown): void {
    const site = cleanSite(name);
    if (!site) return;
    writeStoredSite(site);
    if (site === this.site) return;
    this.site = site;
    if (!this.socket) return;
    const wasActive = this.socket.active;
    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = undefined;
    this.connectedSubject.next(false);
    // Los listeners, rooms y documentos se conservan y se vuelven a enganchar.
    if (wasActive) this.connect();
  }

  connect(): void {
    if (this.socket?.connected) return;
    // Reutiliza la instancia después de una desconexión para conservar los
    // listeners de los canales privados. Socket.IO ya gestiona aquí la
    // reconexión automática y la re-suscripción de rooms.
    if (this.socket) {
      this.socket.connect();
      return;
    }

    // En desarrollo se usa el host del proxy Angular; en producción se usa
    // el dominio público. En ambos casos el navegador nunca toca :9000:
    // el proxy/Nginx conserva la cookie y enruta /socket.io al realtime.
    const base = environment.production ? window.location.origin : '';
    const site = this.site;
    const nsUrl = `${base}${site ? `/${site}` : ''}`;

    console.log('[frappe-socket] connecting to', nsUrl);
    this.socket = io(nsUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 8000,
      timeout: 15000
    });

    // en FrappeSocketService, después de crear this.socket
    (this.socket as any).onAny?.((event: string, ...args: any[]) => {
      //console.log('[ws:any]', event, args?.[0]);
    });

    // Al recrear el socket (cambio de sitio) se re-enganchan los listeners ya registrados.
    for (const [event, handlers] of this.listeners) {
      for (const wrapped of handlers.values()) this.socket.on(event, wrapped);
    }


    this.socket.on('connect', () => {
      this.zone.run(() => {
        this.connectedSubject.next(true);
        for (const r of this.rooms) this.socket!.emit('subscribe', r);
        for (const document of this.documents.values()) {
          this.socket!.emit('doc_subscribe', document.doctype, document.name);
        }
      });
    });


    this.socket.on('disconnect', () => {
      this.zone.run(() => this.connectedSubject.next(false));
    });

    this.socket.on('connect_error', (err) => {
      console.error('[frappe-socket] connect_error', err);
      this.zone.run(() => this.errorSubject.next(err));
    });


  }

  disconnect(): void {
    try { this.socket?.disconnect(); } finally { this.connectedSubject.next(false); }
  }

  subscribe(room: string): void {
    if (!room) return;
    this.rooms.add(room);
    this.socket?.emit('subscribe', room);   // 👈 string, no [room]
  }


  unsubscribe(room: string): void {
    if (!room) return;
    this.rooms.delete(room);
    this.socket?.emit('unsubscribe', room);

  }

  emit(event: string, payload?: any): void {
    this.socket?.emit(event, payload);
  }

  subscribeDocument(doctype: string, name: string): void {
    const key = `${doctype}/${name}`;
    const existing = this.documents.get(key);
    if (existing) { existing.subscribers++; return; }
    this.documents.set(key, { doctype, name, subscribers: 1 });
    if (this.socket?.connected) this.socket.emit('doc_subscribe', doctype, name);
  }

  unsubscribeDocument(doctype: string, name: string): void {
    const key = `${doctype}/${name}`;
    const existing = this.documents.get(key);
    if (!existing || --existing.subscribers > 0) return;
    this.documents.delete(key);
    this.socket?.emit('doc_unsubscribe', doctype, name);
  }

  on<T = any>(event: string, handler: (data: T) => void): void {
    if (!this.socket) return;
    let handlers = this.listeners.get(event);
    if (!handlers) { handlers = new Map(); this.listeners.set(event, handlers); }
    if (handlers.has(handler)) return;
    const wrapped = (data: T) => this.zone.run(() => handler(data));
    handlers.set(handler, wrapped);
    this.socket.on(event, wrapped);
  }

  off(event: string, handler?: (...args: any[]) => void): void {
    if (handler) {
      const handlers = this.listeners.get(event);
      const wrapped = handlers?.get(handler);
      if (wrapped) this.socket?.off(event, wrapped);
      handlers?.delete(handler);
      if (!handlers?.size) this.listeners.delete(event);
    } else {
      this.socket?.off(event);
      this.listeners.delete(event);
    }
  }
}

const SITE_STORAGE_KEY = 'facturada.frappe_site';

function cleanSite(value: unknown): string {
  return String(value ?? '').trim().replace(/^\/+|\/+$/g, '');
}

function readStoredSite(): string {
  try { return localStorage.getItem(SITE_STORAGE_KEY) || ''; } catch { return ''; }
}

function writeStoredSite(site: string): void {
  try { localStorage.setItem(SITE_STORAGE_KEY, site); } catch { /* sin almacenamiento: queda en memoria */ }
}
