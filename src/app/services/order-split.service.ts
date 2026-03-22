import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { environment } from 'src/environments/environment';
import { OrderSplitResponse, SplitOrderPayload } from './order-split.types';

@Injectable({ providedIn: 'root' })
export class OrderSplitService {
  private readonly splitOrderUrl =
    `${environment.apiUrl}/method/restaurante_app.restaurante_bmarc.doctype.orders.orders.split_order`;
  private readonly getOrderSplitsUrl =
    `${environment.apiUrl}/method/restaurante_app.restaurante_bmarc.doctype.orders.orders.get_order_splits`;
  private readonly createAndEmitFromSplitUrl =
    `${environment.apiUrl}/method/restaurante_app.restaurante_bmarc.doctype.orders.orders.create_and_emit_from_split`;
  private readonly deleteOrderSplitUrl =
    `${environment.apiUrl}/method/restaurante_app.restaurante_bmarc.doctype.orders.orders.delete_order_split`;

  constructor(private http: HttpClient) {}

  getOrderSplits(orderName: string): Observable<OrderSplitResponse> {
    return this.http.get<OrderSplitResponse>(this.getOrderSplitsUrl, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params: { order_name: orderName }
    });
  }

  splitOrder(payload: SplitOrderPayload): Observable<any> {
    return this.http.post<any>(this.splitOrderUrl, payload, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  createAndEmitFromSplit(splitName: string): Observable<any> {
    return this.http.post<any>(this.createAndEmitFromSplitUrl, { split_name: splitName }, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  deleteOrderSplit(splitName: string): Observable<any> {
    return this.http.post<any>(this.deleteOrderSplitUrl, { split_name: splitName }, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }
}
