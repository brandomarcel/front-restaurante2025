import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { OrderSplitResponse, SplitOrderPayload, SplitPaymentRequest } from './order-split.types';

@Injectable({ providedIn: 'root' })
export class OrderSplitService {
  constructor() {}

  getOrderSplits(orderName: string): Observable<OrderSplitResponse> {
    return throwError(() => new Error('Las divisiones de órdenes no están disponibles en el contrato actual de restaurante.'));
  }

  splitOrder(payload: SplitOrderPayload): Observable<any> {
    return throwError(() => new Error('Las divisiones de órdenes no están disponibles en el contrato actual de restaurante.'));
  }

  createAndEmitFromSplit(splitName: string, payments: SplitPaymentRequest[] = []): Observable<any> {
    return throwError(() => new Error('La facturación de divisiones no está disponible en el contrato actual de restaurante.'));
  }

  deleteOrderSplit(splitName: string): Observable<any> {
    return throwError(() => new Error('Las divisiones de órdenes no están disponibles en el contrato actual de restaurante.'));
  }
}
