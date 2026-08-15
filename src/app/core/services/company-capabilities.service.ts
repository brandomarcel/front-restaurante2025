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
  | 'products';

export type CompanyFeatures = Record<CompanyFeatureKey, boolean>;

const RESTAURANT_FALLBACK: CompanyFeatures = {
  orders: true,
  tables: true,
  kitchen: true,
  cash_register: true,
  direct_invoice: true,
  credit_note: true,
  customers: true,
  products: true
};

@Injectable({ providedIn: 'root' })
export class CompanyCapabilitiesService {
  private readonly storageKey = 'company_capabilities';
  private readonly state = signal(this.readStored());

  readonly config = this.state.asReadonly();

  get businessMode(): BusinessMode { return this.state().businessMode; }
  get features(): CompanyFeatures { return this.state().features; }
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

    const config = { businessMode, features, loaded: true };
    this.state.set(config);
    localStorage.setItem(this.storageKey, JSON.stringify(config));
  }

  useSafeFallback(): void {
    if (this.state().loaded) return;
    this.state.set({ businessMode: 'RESTAURANTE', features: { ...RESTAURANT_FALLBACK }, loaded: true });
  }

  isEnabled(feature?: CompanyFeatureKey): boolean {
    return !feature || this.features[feature] === true;
  }

  hasRole(userRoles: unknown, allowedRoles?: string[]): boolean {
    if (!allowedRoles?.length) return true;
    const current = Array.isArray(userRoles) ? userRoles.map(role => this.normalize(String(role))) : [];
    return allowedRoles.some(role => current.includes(this.normalize(role)));
  }

  canAccess(feature: CompanyFeatureKey | undefined, allowedRoles: string[] | undefined, userRoles: unknown): boolean {
    return this.isEnabled(feature) && this.hasRole(userRoles, allowedRoles);
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
    return ['orders', 'tables', 'kitchen', 'cash_register', 'direct_invoice', 'credit_note', 'customers', 'products'];
  }

  private readStored(): { businessMode: BusinessMode; features: CompanyFeatures; loaded: boolean } {
    try {
      const stored = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
      if (stored?.features) return stored;
    } catch { }
    return this.defaultState();
  }

  private defaultState() {
    return { businessMode: 'RESTAURANTE' as BusinessMode, features: { ...RESTAURANT_FALLBACK }, loaded: false };
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
