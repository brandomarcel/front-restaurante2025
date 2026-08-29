import { Injectable, signal } from '@angular/core';

export type BusinessMode = 'RESTAURANTE' | 'FACTURADOR';
export type CompanyFeatureKey =
  | 'orders'
  | 'tables'
  | 'kitchen'
  | 'cash_register'
  | 'direct_invoice'
  | 'credit_note'
  | 'customers'
  | 'products'
  | 'additional_fields';

export type CompanyFeatures = Record<CompanyFeatureKey, boolean>;

export interface CompanyPlan {
  subscription?: string;
  plan?: string;
  plan_name?: string;
  code?: string;
  status?: 'ACTIVO' | 'PRUEBA' | 'VENCIDO' | 'SUSPENDIDO' | 'CANCELADO' | string;
  active?: boolean | number | string;
  auto_renew?: boolean | number | string | null;
  start_date?: string | null;
  end_date?: string | null;
  allow_restaurant_mode?: boolean;
  allow_invoice_mode?: boolean;
  unlimited_authorized_vouchers?: boolean | number | string;
  purchased_authorized_vouchers?: number;
  used_authorized_vouchers?: number;
  remaining_authorized_vouchers?: number;
}

export interface CompanyCapabilitiesConfig {
  businessMode: BusinessMode;
  features: CompanyFeatures;
  plan: CompanyPlan | null;
  loaded: boolean;
}

const RESTAURANT_FALLBACK: CompanyFeatures = {
  orders: true,
  tables: true,
  kitchen: true,
  cash_register: true,
  direct_invoice: true,
  credit_note: true,
  customers: true,
  products: true,
  additional_fields: true
};

@Injectable({ providedIn: 'root' })
export class CompanyCapabilitiesService {
  private readonly storageKey = 'company_capabilities';
  private readonly state = signal(this.readStored());

  readonly config = this.state.asReadonly();

  get businessMode(): BusinessMode { return this.state().businessMode; }
  get features(): CompanyFeatures { return this.state().features; }
  get plan(): CompanyPlan | null { return this.state().plan; }
  get isLoaded(): boolean { return this.state().loaded; }

  setFromResponse(response: any): void {
    const rawCompany = response?.message?.data ?? response?.message ?? response?.data ?? response ?? {};
    const company = Array.isArray(rawCompany) ? (rawCompany[0] ?? {}) : rawCompany;
    const businessModeValue = company?.business_mode ?? response?.message?.business_mode ?? response?.business_mode;
    const businessMode = this.resolveBusinessMode(businessModeValue);
    const received = company?.features ?? response?.message?.features ?? response?.features;
    const features = received && typeof received === 'object'
      ? this.featureKeys.reduce((result, key) => {
          result[key] = received[key] === true || received[key] === 1;
          return result;
        }, { ...RESTAURANT_FALLBACK })
      : { ...RESTAURANT_FALLBACK };

    const plan = this.normalizePlan(company?.plan ?? response?.message?.plan ?? response?.plan);

    const config: CompanyCapabilitiesConfig = { businessMode, features, plan, loaded: true };
    this.state.set(config);
    localStorage.setItem(this.storageKey, JSON.stringify(config));
  }

  useSafeFallback(): void {
    if (this.state().loaded) return;
    this.state.set({ businessMode: 'RESTAURANTE', features: { ...RESTAURANT_FALLBACK }, plan: null, loaded: true });
  }

  isEnabled(feature?: CompanyFeatureKey): boolean {
    if (!feature) return true;
    if (this.businessMode === 'FACTURADOR' && this.restaurantOnlyFeatures.includes(feature)) {
      return false;
    }
    return this.features[feature] === true;
  }

  hasRole(userRoles: unknown, allowedRoles?: string[]): boolean {
    if (!allowedRoles?.length) return true;
    const current = Array.isArray(userRoles) ? userRoles.map(role => this.normalize(String(role))) : [];
    return allowedRoles.some(role => current.includes(this.normalize(role)));
  }

  canAccess(feature: CompanyFeatureKey | undefined, allowedRoles: string[] | undefined, userRoles: unknown): boolean {
    return this.isEnabled(feature) && this.hasRole(userRoles, allowedRoles);
  }

  validateFeatureUse(feature?: CompanyFeatureKey): { allowed: boolean; message?: string } {
    if (feature && !this.isEnabled(feature)) {
      return { allowed: false, message: 'Este módulo no está incluido en el plan de la empresa.' };
    }

    if (!this.isEmissionFeature(feature)) {
      return { allowed: true };
    }

    const plan = this.plan;
    if (!plan) {
      return { allowed: false, message: 'La empresa no tiene un plan asignado para emitir comprobantes.' };
    }

    if (plan.active === false) {
      return { allowed: false, message: 'El plan de la empresa no está activo.' };
    }

    if (this.businessMode === 'RESTAURANTE' && plan.allow_restaurant_mode === false) {
      return { allowed: false, message: 'El plan actual no permite operar en modo restaurante.' };
    }

    if (this.businessMode === 'FACTURADOR' && plan.allow_invoice_mode === false) {
      return { allowed: false, message: 'El plan actual no permite operar en modo facturador.' };
    }

    if (!this.hasUnlimitedVouchers(plan) && Number(plan.remaining_authorized_vouchers || 0) <= 0) {
      return { allowed: false, message: 'No quedan comprobantes disponibles en el plan actual.' };
    }

    return { allowed: true };
  }

  canEmit(): boolean {
    return this.validateFeatureUse('direct_invoice').allowed;
  }

  getPlanBlockMessage(feature: CompanyFeatureKey = 'direct_invoice'): string | null {
    const result = this.validateFeatureUse(feature);
    return result.allowed ? null : result.message || 'Acción no permitida por el plan actual.';
  }

  getLandingRoute(userRoles: unknown): string {
    if (this.businessMode === 'FACTURADOR' && this.hasRole(userRoles, ['GERENTE', 'CAJERO'])) {
      return '/dashboard/main';
    }
    if (this.canAccess('tables', ['GERENTE', 'CAJERO', 'MESERO'], userRoles)) return '/dashboard/pos';
    if (this.canAccess('direct_invoice', ['GERENTE', 'CAJERO'], userRoles)) return '/dashboard/invoicing';
    if (this.canAccess('kitchen', ['GERENTE', 'COCINA'], userRoles)) return '/dashboard/orders-realtime';
    return '/dashboard/no-access';
  }

  getPosExitRoute(userRoles: unknown): string {
    if (this.canAccess('orders', ['GERENTE', 'CAJERO', 'MESERO'], userRoles)) return '/dashboard/orders';
    if (this.canAccess('direct_invoice', ['GERENTE', 'CAJERO'], userRoles)) return '/dashboard/invoicing';
    if (this.canAccess('kitchen', ['GERENTE', 'COCINA'], userRoles)) return '/dashboard/orders-realtime';
    return '/dashboard/no-access';
  }

  clear(): void {
    localStorage.removeItem(this.storageKey);
    this.state.set(this.defaultState());
  }

  private get featureKeys(): CompanyFeatureKey[] {
    return ['orders', 'tables', 'kitchen', 'cash_register', 'direct_invoice', 'credit_note', 'customers', 'products', 'additional_fields'];
  }

  private get restaurantOnlyFeatures(): CompanyFeatureKey[] {
    return ['orders', 'tables', 'kitchen', 'cash_register'];
  }

  private readStored(): CompanyCapabilitiesConfig {
    try {
      const stored = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
      if (stored?.features) {
        return {
          businessMode: this.resolveBusinessMode(stored.businessMode),
          features: { ...RESTAURANT_FALLBACK, ...stored.features },
          plan: this.normalizePlan(stored.plan),
          loaded: stored.loaded === true
        };
      }
    } catch { }
    return this.defaultState();
  }

  private defaultState(): CompanyCapabilitiesConfig {
    return { businessMode: 'RESTAURANTE', features: { ...RESTAURANT_FALLBACK }, plan: null, loaded: false };
  }

  private normalizePlan(value: unknown): CompanyPlan | null {
    if (!value || typeof value !== 'object') return null;
    const plan = value as CompanyPlan;

    return {
      ...plan,
      active: this.coerceOptionalBoolean(plan.active),
      auto_renew: this.coerceOptionalBoolean(plan.auto_renew),
      allow_restaurant_mode: this.coerceOptionalBoolean(plan.allow_restaurant_mode),
      allow_invoice_mode: this.coerceOptionalBoolean(plan.allow_invoice_mode),
      unlimited_authorized_vouchers: this.coerceOptionalBoolean(plan.unlimited_authorized_vouchers) === true,
      purchased_authorized_vouchers: Number(plan.purchased_authorized_vouchers) || 0,
      used_authorized_vouchers: Number(plan.used_authorized_vouchers) || 0,
      remaining_authorized_vouchers: Number(plan.remaining_authorized_vouchers) || 0
    };
  }

  private coerceOptionalBoolean(value: unknown): boolean | undefined {
    if (value === undefined || value === null || `${value}`.trim() === '') return undefined;
    const normalized = this.normalize(String(value));
    return value === true || normalized === '1' || normalized === 'TRUE' || normalized === 'SI';
  }

  private isEmissionFeature(feature?: CompanyFeatureKey): boolean {
    return feature === 'direct_invoice' || feature === 'credit_note';
  }

  private hasUnlimitedVouchers(plan: CompanyPlan): boolean {
    return plan.unlimited_authorized_vouchers === true || Number(plan.remaining_authorized_vouchers) === -1;
  }

  private resolveBusinessMode(value: unknown): BusinessMode {
    const normalized = this.normalize(String(value || ''));
    if (
      normalized === 'FACTURADOR' ||
      normalized === 'FACTURACION' ||
      normalized === 'FACTURACION_ELECTRONICA' ||
      normalized.includes('FACTUR')
    ) {
      return 'FACTURADOR';
    }

    return 'RESTAURANTE';
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  }
}
