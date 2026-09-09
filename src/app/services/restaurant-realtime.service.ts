import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeSocketService } from './frappe-socket.service';

export type RestaurantRealtimeEventType =
  | 'table.created'
  | 'table.updated'
  | 'order.created'
  | 'order.updated'
  | 'order_split.created'
  | 'order_split.updated'
  | 'order_split.deleted';

export interface RestaurantRealtimeEvent {
  business: string;
  event_type: RestaurantRealtimeEventType;
  action: string;
  data: any;
}

/**
 * Canal privado de eventos del restaurante para el negocio activo.
 *
 * Este servicio no hace polling ni mezcla negocios: conserva una sola
 * suscripción por instancia y descarta cualquier evento cuyo business no
 * coincida con el canal seleccionado.
 */
@Injectable({ providedIn: 'root' })
export class RestaurantRealtimeService {
  private readonly eventSubject = new Subject<RestaurantRealtimeEvent>();
  private readonly reconnectSubject = new Subject<string>();
  private readonly businessSubject = new BehaviorSubject<string | null>(null);
  private currentChannel = '';
  private currentBusiness = '';
  private wasConnected = false;
  private readonly handleEvent = (event: RestaurantRealtimeEvent) => this.receive(event);

  readonly events$: Observable<RestaurantRealtimeEvent> = this.eventSubject.asObservable();
  readonly reconnected$: Observable<string> = this.reconnectSubject.asObservable();
  readonly activeBusiness$: Observable<string | null> = this.businessSubject.asObservable();
  readonly connected$ = this.socket.connected$;

  constructor(
    private socket: FrappeSocketService,
    private capabilities: CompanyCapabilitiesService,
    private zone: NgZone
  ) {
    this.socket.connected$.subscribe((connected) => {
      if (connected && this.wasConnected && this.currentBusiness) {
        this.zone.run(() => this.reconnectSubject.next(this.currentBusiness));
      }
      this.wasConnected = connected;
    });
  }

  /** Activa únicamente el canal del negocio restaurante indicado. */
  activate(business?: string): void {
    const selected = String(
      business || this.capabilities.activeBusinessId || localStorage.getItem('active_business') || ''
    ).trim();
    const enabled = this.capabilities.features.restaurant === true;

    if (!selected || !enabled) {
      this.deactivate(false);
      return;
    }
    if (selected === this.currentBusiness && this.currentChannel) return;

    this.deactivate(false);
    this.currentBusiness = selected;
    this.currentChannel = `facturada_restaurant:business:${selected}`;
    this.businessSubject.next(selected);
    this.socket.connect();
    this.socket.subscribe(this.currentChannel);
    this.socket.on<RestaurantRealtimeEvent>(this.currentChannel, this.handleEvent);
  }

  /** Cambia de negocio limpiando listeners antes de suscribir el nuevo canal. */
  changeBusiness(business: string): void {
    this.activate(business);
  }

  /** Elimina listeners del canal actual. El socket global lo controla AuthService. */
  deactivate(disconnect = false): void {
    if (this.currentChannel) {
      this.socket.off(this.currentChannel);
      this.socket.unsubscribe(this.currentChannel);
    }
    this.currentChannel = '';
    this.currentBusiness = '';
    this.businessSubject.next(null);
    if (disconnect) this.socket.disconnect();
  }

  disconnect(): void {
    this.deactivate(true);
  }

  get activeBusiness(): string | null {
    return this.currentBusiness || null;
  }

  private receive(rawEvent: RestaurantRealtimeEvent): void {
    const event = this.normalizeEvent(rawEvent);
    if (!event || event.business !== this.currentBusiness) return;
    if (!event.event_type || !event.data) return;
    this.zone.run(() => {
      this.eventSubject.next(event);
      // Evento genérico para componentes legados que aún refrescan su vista
      // tras una acción HTTP. Las pantallas nuevas pueden usar events$ y
      // actualizar su store sin recargar la lista completa.
      window.dispatchEvent(new CustomEvent('facturada:restaurant-realtime', { detail: event }));
    });
  }

  private normalizeEvent(rawEvent: any): RestaurantRealtimeEvent | null {
    let event = rawEvent;
    if (typeof event === 'string') {
      try { event = JSON.parse(event); } catch { return null; }
    }
    event = event?.message ?? event?.data?.event ?? event;
    if (typeof event === 'string') {
      try { event = JSON.parse(event); } catch { return null; }
    }
    if (!event || typeof event !== 'object') return null;
    return event as RestaurantRealtimeEvent;
  }
}
