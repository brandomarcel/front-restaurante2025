import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, map, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { OrderSplitResponse, SplitOrderPayload, SplitPaymentRequest } from './order-split.types';

@Injectable({ providedIn: 'root' })
export class OrderSplitService {
  private readonly baseUrl = `${environment.apiUrl}/method/facturada_restaurante.api.frontend`;

  constructor(
    private http: HttpClient,
    private capabilities: CompanyCapabilitiesService
  ) {}

  getOrderSplits(orderName: string): Observable<OrderSplitResponse> {
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    const params = new HttpParams().set('order_name', orderName).set('business', business);
    return this.http.get<any>(`${this.baseUrl}.get_order_splits`, {
      context: new HttpContext().set(REQUIRE_AUTH, true), params
    }).pipe(map((response: any) => ({ message: { data: this.data(response) } })));
  }

  splitOrder(payload: SplitOrderPayload): Observable<any> {
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    const body = {
      business,
      order_name: String(payload?.order_name || '').trim(),
      split_label: String(payload?.split_label || '').trim(),
      customer: String(payload?.customer || '').trim() || undefined,
      items: (payload?.items || []).map((item: any) => ({
        ...(item?.order_item ? { order_item: String(item.order_item).trim() } : {}),
        ...(!item?.order_item && item?.product ? { product: String(item.product).trim() } : {}),
        qty: Number(item?.qty || 0)
      })),
      payments: this.normalizePayments(payload?.payments || []),
      notes: String(payload?.notes || '').trim()
    };
    return this.http.post<any>(`${this.baseUrl}.split_order`, body, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(map((response: any) => ({ message: { ...(response?.message || {}), data: this.data(response) } })));
  }

  /** Emite una sola vez la factura Lite asociada a la cuenta dividida. */
  emitInvoiceForSplit(splitName: string): Observable<any> {
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    return this.http.post<any>(`${this.baseUrl}.emit_invoice_for_split`, {
      business,
      split_name: splitName,
      ...(this.capabilities.activePosTerminal?.name ? { pos_terminal: this.capabilities.activePosTerminal.name } : {})
    }, { context: new HttpContext().set(REQUIRE_AUTH, true) })
      .pipe(map((response: any) => ({ message: { ...(response?.message || {}), data: this.data(response) } })));
  }

  createAndEmitFromSplit(splitName: string, _payments: SplitPaymentRequest[] = []): Observable<any> {
    return this.emitInvoiceForSplit(splitName);
  }

  deleteOrderSplit(splitName: string): Observable<any> {
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    return this.http.post<any>(`${this.baseUrl}.delete_order_split`, {
      business, split_name: splitName
    }, { context: new HttpContext().set(REQUIRE_AUTH, true) })
      .pipe(map((response: any) => ({ message: { ...(response?.message || {}), data: this.data(response) } })));
  }

  private activeBusinessOrError(): string | Error {
    const business = String(this.capabilities.activeBusinessId || '').trim();
    return business || new Error('Debe seleccionar un negocio.');
  }

  private data(response: any): any {
    return response?.message?.data ?? response?.data ?? response?.message ?? response ?? {};
  }

  private normalizePayments(payments: SplitPaymentRequest[]): any[] {
    return payments.map((payment: any) => ({
      payment_method: String(payment?.payment_method || payment?.formas_de_pago || '').trim(),
      payment_code: String(payment?.payment_code || (payment as any)?.forma_pago || (payment as any)?.codigo || '').trim(),
      amount: this.roundMoney(payment?.amount ?? payment?.monto ?? 0),
      reference: String(payment?.reference || '').trim()
    }));
  }

  private roundMoney(value: unknown): number {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) / 100 : 0;
  }
}
