import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeData } from '../core/utils/frappe-response';

export interface LiteDashboardSales {
  invoice_count: number;
  authorized_count: number;
  pending_count: number;
  rejected_count: number;
  canceled_count: number;
  sales_total: number;
  collected_total: number;
}

export interface LiteDashboardPlan {
  name?: string;
  status?: string;
  active?: boolean | number | string;
  start_date?: string | null;
  end_date?: string | null;
  unlimited_documents?: boolean | number | string;
  max_authorized_documents?: number;
  used_authorized_documents?: number;
  remaining_authorized_documents?: number | null;
}

export interface LiteDashboardInventoryItem {
  name?: string;
  item_code?: string;
  item_name?: string;
  current_stock?: number;
}

export interface LiteDashboardInventory {
  tracked_items: number;
  low_stock_items: number;
  out_of_stock_items: LiteDashboardInventoryItem[];
}

export interface LiteDashboard {
  business?: string;
  period?: { from_date?: string; to_date?: string };
  sales: LiteDashboardSales;
  plan: LiteDashboardPlan | null;
  inventory: LiteDashboardInventory;
  recent_invoices: any[];
}

@Injectable({ providedIn: 'root' })
export class FacturadaLiteDashboardService {
  private readonly apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private capabilities: CompanyCapabilitiesService
  ) {}

  getDashboard(fromDate?: string, toDate?: string, business?: string): Observable<LiteDashboard> {
    let params = new HttpParams();
    const selectedBusiness = business || this.capabilities.businessId || localStorage.getItem('businessId') || '';

    if (selectedBusiness) params = params.set('business', selectedBusiness);
    if (fromDate) params = params.set('from_date', fromDate);
    if (toDate) params = params.set('to_date', toDate);

    return this.http.get<any>(
      `${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_dashboard`,
      {
        context: new HttpContext().set(REQUIRE_AUTH, true),
        params
      }
    ).pipe(map((response) => this.normalizeResponse(response)));
  }

  private normalizeResponse(response: any): LiteDashboard {
    const message = frappeData<any>(response) || {};
    const sales = message.sales && typeof message.sales === 'object' ? message.sales : {};
    const plan = message.plan && typeof message.plan === 'object' ? message.plan : null;
    const inventory = message.inventory && typeof message.inventory === 'object' ? message.inventory : {};

    return {
      business: message.business,
      period: message.period,
      sales: {
        invoice_count: this.number(sales.invoice_count),
        authorized_count: this.number(sales.authorized_count),
        pending_count: this.number(sales.pending_count),
        rejected_count: this.number(sales.rejected_count),
        canceled_count: this.number(sales.canceled_count),
        sales_total: this.number(sales.sales_total),
        collected_total: this.number(sales.collected_total)
      },
      plan: plan ? {
        ...plan,
        active: plan.active === undefined ? undefined : this.boolean(plan.active),
        unlimited_documents: this.boolean(plan.unlimited_documents),
        max_authorized_documents: this.number(plan.max_authorized_documents),
        used_authorized_documents: this.number(plan.used_authorized_documents),
        remaining_authorized_documents: plan.remaining_authorized_documents === null || plan.remaining_authorized_documents === undefined
          ? null
          : this.number(plan.remaining_authorized_documents)
      } : null,
      inventory: {
        tracked_items: this.number(inventory.tracked_items),
        low_stock_items: this.number(inventory.low_stock_items),
        out_of_stock_items: Array.isArray(inventory.out_of_stock_items) ? inventory.out_of_stock_items : []
      },
      recent_invoices: Array.isArray(message.recent_invoices)
        ? message.recent_invoices
        : (Array.isArray(message.data) ? message.data : [])
    };
  }

  private number(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private boolean(value: unknown): boolean {
    return value === true || value === 1 || `${value ?? ''}`.toLowerCase() === 'true' || `${value ?? ''}` === '1';
  }
}
