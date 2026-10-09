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

  constructor(private zone: NgZone) { }

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
    const site = String(environment.frappeSiteNamespace || '').replace(/^\/+|\/+$/g, '');
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
