import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from 'src/environments/environment';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';

export type SubscriptionMovementType =
  | 'Alta' | 'Renovación' | 'Cambio de plan' | 'Ajuste' | 'Suspensión'
  | 'Reactivación' | 'Vencimiento' | 'Cancelación' | 'Sincronización';

export interface SubscriptionMovement {
  movement_type: SubscriptionMovementType;
  status: 'Aplicado' | 'Programado' | 'Anulado';
  effective_date: string | null;
  applied_at: string | null;
  plan_name: string | null;
  previous_plan_name: string | null;
  subscription_status: string | null;
  subscription_start: string | null;
  subscription_end: string | null;
  unlimited_documents: number;
  max_authorized_documents: number;
  used_before: number;
  amount: number;
}

export interface SubscriptionOverview {
  has_subscription: boolean;
  plan_code?: string;
  plan_name?: string;
  description?: string;
  status?: string;
  is_active?: boolean;
  quota_mode?: string;
  billing_period?: string;
  start_date?: string | null;
  end_date?: string | null;
  days_left?: number | null;
  unlimited_documents?: boolean;
  max_authorized_documents?: number;
  used_authorized_documents?: number;
  max_users?: number;
  /** Etiquetas de los módulos encendidos («Facturación», «POS»…). */
  modules?: string[];
  scheduled: { movement_type: SubscriptionMovementType; effective_date: string; plan_name: string } | null;
  movements: SubscriptionMovement[];
}

/**
 * Plan del negocio con su historial (`facturada_core.api.subscriptions.get_subscription_overview`).
 * Solo lectura: renovar o cambiar de plan lo hace BMARC desde el Desk.
 */
@Injectable({ providedIn: 'root' })
export class SubscriptionService {
  private readonly api = `${environment.apiUrl}/method/facturada_core.api.subscriptions`;

  constructor(private http: HttpClient) {}

  getOverview(business: string): Observable<SubscriptionOverview> {
    const params = new HttpParams().set('business', business);
    return this.http
      .get<any>(`${this.api}.get_subscription_overview`, {
        params,
        withCredentials: true,
        context: new HttpContext().set(REQUIRE_AUTH, true),
      })
      .pipe(map((res) => (res?.message?.data ?? { has_subscription: false, scheduled: null, movements: [] }) as SubscriptionOverview));
  }
}
