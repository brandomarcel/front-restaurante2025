// src/app/services/frappe-socket.service.ts
import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class FrappeSocketService {
  private socket?: Socket; // socket del namespace
  private rooms = new Set<string>();

  private connectedSubject = new BehaviorSubject<boolean>(false);
  private errorSubject = new BehaviorSubject<any>(null);

  connected$: Observable<boolean> = this.connectedSubject.asObservable();
  lastError$: Observable<any> = this.errorSubject.asObservable();

  constructor(private zone: NgZone) { }

  connect(): void {
    if (this.socket?.connected) return;

    // dentro de connect()
    const base = environment.production ? environment.URL : ''; // '' en dev para usar el proxy
    const nsUrl = `${base}/${environment.frappeSiteNamespace}`; // -> "/restaurante_bmarc" en dev

    //const nsUrl = `${environment.apiUrl.replace(/^http/, 'ws')}/${environment.frappeSiteNamespace}`;
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

  on<T = any>(event: string, handler: (data: T) => void): void {
    this.socket?.on(event, (data: T) => this.zone.run(() => handler(data)));
  }

  off(event: string, handler?: (...args: any[]) => void): void {
    if (handler) this.socket?.off(event, handler);
    else this.socket?.off(event);
  }
}
