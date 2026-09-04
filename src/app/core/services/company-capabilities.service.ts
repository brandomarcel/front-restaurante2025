import { Injectable, inject, signal } from '@angular/core';
import { frappeData } from '../utils/frappe-response';
import { UtilsService } from './utils.service';

export type BusinessMode = 'RESTAURANTE' | 'FACTURADOR' | 'FACTURADA_LITE';
export type CompanyFeatureKey =
  | 'orders'
  | 'tables'
  | 'kitchen'
  | 'cash_register'
  | 'direct_invoice'
  | 'credit_note'
  | 'customers'
  | 'products'
  | 'additional_fields'
  | 'inventory';

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
  remaining_authorized_vouchers?: number | null;
  unlimited_documents?: boolean | number | string;
  max_authorized_documents?: number;
  used_authorized_documents?: number;
  remaining_authorized_documents?: number | null;
}

export interface CompanyCapabilitiesConfig {
  businessMode: BusinessMode;
  features: CompanyFeatures;
  plan: CompanyPlan | null;
  business: any | null;
  activeBusiness?: any | null;
  businesses: any[];
  roles: string[];
  businessRole?: string | null;
  permissions?: Record<string, any> | string[] | null;
  certificateStatus?: string | null;
  certificateLastError?: string | null;
  liteSetupReady?: boolean | null;
  liteSetupMissing: string[];
  sequences?: any[];
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
  additional_fields: true,
  inventory: true
};

@Injectable({ providedIn: 'root' })
export class CompanyCapabilitiesService {
  private readonly storageKey = 'company_capabilities';
  private readonly state = signal(this.readStored());
  private readonly utilsService = inject(UtilsService);

  readonly config = this.state.asReadonly();

  get businessMode(): BusinessMode { return this.state().businessMode; }
  get features(): CompanyFeatures { return this.state().features; }
  get plan(): CompanyPlan | null { return this.state().plan; }
  get business(): any | null { return this.state().business; }
  /** Negocio seleccionado actualmente (alias explícito para el contexto Lite). */
  get activeBusiness(): any | null { return this.state().activeBusiness ?? this.state().business; }
  get activeBusinessId(): string | null { return this.activeBusiness?.name || this.activeBusiness?.business || this.businessId; }
  get businesses(): any[] { return this.state().businesses; }
  get roles(): string[] { return this.state().roles; }
  get businessRole(): string | null { return this.state().businessRole || null; }
  get permissions(): Record<string, any> | string[] | null { return this.state().permissions || null; }
  get certificateStatus(): string | null { return this.state().certificateStatus || null; }
  get certificateLastError(): string | null { return this.state().certificateLastError || null; }
  get liteSetupReady(): boolean | null { return this.state().liteSetupReady ?? null; }
  get liteSetupMissing(): string[] { return this.state().liteSetupMissing || []; }
  get sequences(): any[] { return this.state().sequences || []; }
  hasActiveInvoiceSequence(environment?: unknown): boolean {
    const target = this.normalize(String(environment
      || this.business?.environment
      || this.business?.ambiente
      || this.business?.tax_profile?.environment
      || ''));
    if (!target) return false;
    return this.sequences.some((sequence: any) =>
      this.normalize(String(sequence?.document_type ?? sequence?.documentType ?? '')) === 'FACTURA'
      && this.normalize(String(sequence?.environment ?? '')) === target
      && this.normalize(String(sequence?.status ?? '')) === 'ACTIVO'
    );
  }
  get businessId(): string | null { return this.business?.name || this.business?.business || null; }
  get isLoaded(): boolean { return this.state().loaded; }
  get isLiteMode(): boolean { return this.businessMode === 'FACTURADA_LITE'; }

  /** Rol autorizado para modificar la configuración tributaria del negocio. */
  get canManageBusinessSetup(): boolean {
    const roles = this.roles || [];
    const hasAdminRole = roles.some((role) => [
      'ADMINISTRADOR DEL NEGOCIO',
      'ADMINISTRADOR',
      'ADMINISTRATOR',
      'SYSTEM MANAGER'
    ].includes(this.normalize(String(role))));
    if (hasAdminRole) return true;

    // En Lite el backend puede conceder la configuración al rol de negocio
    // mediante este permiso, aunque no tenga un rol Frappe de administrador.
    return !!this.permissions && this.hasPermission('business.settings.manage');
  }

  setFromResponse(response: any): void {
    const message = frappeData<any>(response) || {};
    const rawBusiness = message?.business;
    const rawCompany = rawBusiness && typeof rawBusiness === 'object'
      ? rawBusiness
      : (message?.company ?? message?.empresa ?? message?.data ?? message);
    const companyCandidate = Array.isArray(rawCompany) ? (rawCompany[0] ?? {}) : rawCompany;
    const company = companyCandidate && typeof companyCandidate === 'object'
      ? { ...companyCandidate, name: companyCandidate.name ?? (typeof rawBusiness === 'string' ? rawBusiness : companyCandidate.business) }
      : { name: typeof rawBusiness === 'string' ? rawBusiness : String(companyCandidate || '') };
    const nestedCompany = company?.business && typeof company.business === 'object'
      ? company.business
      : (company?.company && typeof company.company === 'object' ? company.company : (company?.empresa && typeof company.empresa === 'object' ? company.empresa : {}));
    const normalizedCompany = nestedCompany && typeof nestedCompany === 'object'
      ? { ...company, ...nestedCompany, tax_profile: company?.tax_profile ?? nestedCompany?.tax_profile }
      : company;
    // get_user_context puede omitir el perfil tributario. Conservamos el
    // ambiente que ya fue cargado desde get_lite_setup para no perderlo al
    // refrescar el contexto de usuario.
    if (normalizedCompany && !normalizedCompany.environment && !normalizedCompany.ambiente) {
      const previousEnvironment = this.state().business?.environment ?? this.state().business?.ambiente;
      if (previousEnvironment) normalizedCompany.environment = previousEnvironment;
    }
    const businessModeValue =
      normalizedCompany?.business_mode ??
      normalizedCompany?.businessMode ??
      nestedCompany?.business_mode ??
      nestedCompany?.businessMode ??
      normalizedCompany?.business_model ??
      normalizedCompany?.businessModel ??
      nestedCompany?.business_model ??
      nestedCompany?.businessModel ??
      company?.mode ??
      nestedCompany?.mode ??
      company?.app_mode ??
      nestedCompany?.app_mode ??
      message?.business_mode ??
      message?.businessMode ??
      message?.mode ??
      message?.app_mode;
    const received = message?.features ?? normalizedCompany?.features ?? nestedCompany?.features ?? response?.features;
    let businessMode = this.resolveBusinessMode(businessModeValue);
    if (!businessModeValue && this.looksLikeLiteFeatures(received)) {
      businessMode = 'FACTURADA_LITE';
    }
    const features = received && typeof received === 'object'
      ? this.featureKeys.reduce((result, key) => {
          const value = this.coerceOptionalBoolean(received[key]);
          if (value !== undefined) result[key] = value === true;
          return result;
        }, this.defaultFeaturesForMode(businessMode))
      : this.defaultFeaturesForMode(businessMode);

    const plan = this.normalizePlan(message?.plan ?? normalizedCompany?.plan ?? nestedCompany?.plan ?? response?.plan);
    const businesses = Array.isArray(message?.businesses) ? message.businesses : [];
    const businessRole = message?.business_role ?? normalizedCompany?.business_role ?? null;
    const roles = this.normalizeRoles(message?.roles ?? message?.user_roles ?? normalizedCompany?.roles ?? response?.roles);
    if (businessRole) {
      const normalizedBusinessRole = this.normalize(String(businessRole));
      if (normalizedBusinessRole && !roles.includes(normalizedBusinessRole)) roles.push(normalizedBusinessRole);
    }
    const permissions = message?.permissions && (Array.isArray(message.permissions) || typeof message.permissions === 'object')
      ? message.permissions
      : null;
    const taxProfile = message?.tax_profile ?? normalizedCompany?.tax_profile ?? message?.business?.tax_profile ?? {};
    const setupEnvironment = taxProfile?.environment ?? taxProfile?.ambiente;
    const hasCertificatePassword = taxProfile?.has_certificate_password ?? normalizedCompany?.has_certificate_password;
    const certificateStatus = taxProfile?.certificate_status ?? normalizedCompany?.certificate_status
      ?? (businessMode === 'FACTURADA_LITE' && hasCertificatePassword !== undefined && this.coerceOptionalBoolean(hasCertificatePassword) !== true
        ? 'NO CONFIGURADO'
        : null);

    const config: CompanyCapabilitiesConfig = {
      businessMode,
      features,
      plan,
      business: normalizedCompany || null,
      activeBusiness: normalizedCompany || null,
      businesses,
      roles,
      businessRole: businessRole ? String(businessRole) : null,
      permissions,
      certificateStatus,
      certificateLastError: taxProfile?.certificate_last_error ?? company?.certificate_last_error ?? null,
      liteSetupReady: message?.ready !== undefined || normalizedCompany?.ready !== undefined
        ? this.toBoolean(message?.ready ?? normalizedCompany?.ready)
        : this.state().liteSetupReady,
      liteSetupMissing: message?.missing !== undefined || normalizedCompany?.missing !== undefined
        ? this.normalizeMissing(message?.missing ?? normalizedCompany?.missing)
        : this.state().liteSetupMissing,
      sequences: Array.isArray(message?.sequences) ? message.sequences : (this.state().sequences || []),
      loaded: true
    };
    this.state.set(config);
    localStorage.setItem(this.storageKey, JSON.stringify(config));
    if (setupEnvironment) this.utilsService.cambiarAmbiente(setupEnvironment);
    const businessId = config.business?.name || (typeof config.business?.business === 'string' ? config.business.business : null) || null;
    if (businessId) {
      localStorage.setItem('active_business', businessId);
      localStorage.setItem('businessId', businessId);
    }
  }

  /** Actualiza exclusivamente el estado devuelto por get_lite_setup. */
  setLiteSetupState(response: any): void {
    const data = response?.data && typeof response.data === 'object' ? response.data : (response || {});
    const current = this.state();
    const taxProfile = data?.tax_profile && typeof data.tax_profile === 'object' ? data.tax_profile : {};
    const hasCertificatePassword = taxProfile.has_certificate_password;
    const setupBusiness = data?.business && typeof data.business === 'object' ? data.business : {};
    const setupEnvironment = taxProfile.environment ?? taxProfile.ambiente;
    const business = Object.keys(setupBusiness).length || setupEnvironment
      ? {
          ...(current.business || {}),
          ...setupBusiness,
          // El ambiente de emisión pertenece al perfil tributario. Se copia
          // como alias de lectura para que componentes heredados puedan
          // mostrarlo sin volver a consultar ni inventar otro valor.
          ...(setupEnvironment ? { environment: setupEnvironment, ambiente: setupEnvironment } : {})
        }
      : current.business;
    const next = {
      ...current,
      business,
      activeBusiness: business || current.activeBusiness,
      plan: data?.plan && typeof data.plan === 'object' ? this.normalizePlan(data.plan) : current.plan,
      features: data?.features && typeof data.features === 'object'
        ? this.mergeFeatures(current.features, data.features)
        : current.features,
      certificateStatus: taxProfile.certificate_status
        ?? (hasCertificatePassword !== undefined && hasCertificatePassword !== null && this.toBoolean(hasCertificatePassword) === false
          ? 'NO CONFIGURADO'
          : current.certificateStatus),
      certificateLastError: taxProfile.certificate_last_error ?? current.certificateLastError,
      liteSetupReady: data?.ready === undefined || data?.ready === null ? current.liteSetupReady : this.toBoolean(data.ready),
      liteSetupMissing: data?.missing === undefined ? current.liteSetupMissing : this.normalizeMissing(data.missing),
      sequences: Array.isArray(data?.sequences) ? data.sequences : (current.sequences || []),
      loaded: true
    };
    this.state.set(next);
    localStorage.setItem(this.storageKey, JSON.stringify(next));
    if (setupEnvironment) this.utilsService.cambiarAmbiente(setupEnvironment);
  }

  /** Conserva la lista de negocios y selecciona uno antes de consultar el contexto. */
  setActiveBusiness(business: any, businesses?: any[]): void {
    const current = this.state();
    const list = Array.isArray(businesses) ? businesses : current.businesses;
    const selectedId = typeof business === 'string' ? business : (business?.name || business?.business || '');
    const selected = typeof business === 'object'
      ? business
      : list.find((item: any) => String(item?.name || item?.business || '') === String(selectedId));
    if (!selectedId || !selected) return;
    const next = {
      ...current,
      business: selected,
      activeBusiness: selected,
      businesses: list,
      features: this.defaultFeaturesForMode(current.businessMode),
      permissions: null,
      businessRole: null,
      plan: null,
      certificateStatus: null,
      certificateLastError: null,
      liteSetupReady: null,
      liteSetupMissing: [],
      sequences: []
    };
    this.state.set(next);
    localStorage.setItem('active_business', String(selectedId));
    localStorage.setItem('businessId', String(selectedId));
    localStorage.setItem(this.storageKey, JSON.stringify(next));
  }

  setBusinesses(businesses: any[]): void {
    const next = { ...this.state(), businesses: Array.isArray(businesses) ? businesses : [] };
    this.state.set(next);
    if (next.loaded) localStorage.setItem(this.storageKey, JSON.stringify(next));
  }

  useSafeFallback(): void {
    if (this.state().loaded) return;
    this.state.set({ businessMode: 'RESTAURANTE', features: { ...RESTAURANT_FALLBACK }, plan: null, business: null, activeBusiness: null, businesses: [], roles: [], businessRole: null, permissions: null, certificateStatus: null, certificateLastError: null, liteSetupReady: null, liteSetupMissing: [], loaded: true });
  }

  setCertificateStatus(status?: unknown, lastError?: unknown): void {
    const current = this.state();
    const next = {
      ...current,
      certificateStatus: status === undefined || status === null ? current.certificateStatus || null : String(status),
      certificateLastError: lastError === undefined || lastError === null ? current.certificateLastError || null : String(lastError)
    };
    this.state.set(next);
    if (next.loaded) localStorage.setItem(this.storageKey, JSON.stringify(next));
  }

  isCertificateEmissionBlocked(): boolean {
    if (!this.isLiteMode) return false;
    const status = this.normalize(this.certificateStatus || '');
    return ['NO CONFIGURADO', 'VENCIDO', 'NO VIGENTE', 'ERROR DE LECTURA'].includes(status) || !!this.certificateLastError;
  }

  isEnabled(feature?: CompanyFeatureKey): boolean {
    if (!feature) return true;
    if ((this.businessMode === 'FACTURADOR' || this.isLiteMode) && this.restaurantOnlyFeatures.includes(feature)) {
      return false;
    }
    return this.features[feature] === true;
  }

  hasPermission(permission?: string): boolean {
    if (!permission || !this.permissions) return true;
    const permissions = this.permissions;
    const normalizedPermission = String(permission).trim();

    if (Array.isArray(permissions)) {
      const normalized = permissions.map((item) => String(item || '').trim().toLowerCase());
      const resource = normalizedPermission.toLowerCase();
      const [resourceName, action] = resource.split('.', 2);
      // El contexto Lite usa billing.* para las operaciones de facturación,
      // mientras que las pantallas históricas consultan direct_invoice y
      // credit_note. Ambos nombres representan el mismo permiso funcional.
      const aliases = ['direct_invoice', 'credit_note'].includes(resourceName)
        ? ['billing']
        : [resourceName];
      return aliases.some((alias) => {
        if (action) {
          return normalized.includes(`${alias}.${action}`)
            || (action === 'read' && normalized.includes(`${alias}.manage`));
        }
        return normalized.includes(alias)
          || normalized.includes(`${alias}.read`)
          || normalized.includes(`${alias}.create`)
          || normalized.includes(`${alias}.manage`);
      });
    }

    const [resource, action] = normalizedPermission.split('.', 2);
    const requiresExplicitPermission = action === 'manage';
    const resourceKeys = Object.keys(permissions);
    const candidates = [
      action ? undefined : `${normalizedPermission}.read`,
      action ? undefined : `${normalizedPermission}.manage`,
      action === 'read' && resource ? `${resource}.manage` : undefined,
      normalizedPermission,
      `can_${normalizedPermission}`,
      `view_${normalizedPermission}`,
      resource && action ? `can_${resource}_${action}` : undefined,
      resource && action ? `view_${resource}_${action}` : undefined
    ].filter((key): key is string => !!key);

    for (const key of candidates) {
      if (Object.prototype.hasOwnProperty.call(permissions, key)) {
        return this.coerceOptionalBoolean(permissions[key]) === true;
      }
    }

    // Algunos contextos devuelven permisos agrupados, por ejemplo:
    // { products: { read: true, create: false } }.
    const grouped = permissions[resource];
    if (grouped && typeof grouped === 'object' && action) {
      if (Object.prototype.hasOwnProperty.call(grouped, action)) {
        return this.coerceOptionalBoolean(grouped[action]) === true;
      }
    }

    // Las capacidades de lectura mantienen compatibilidad con contextos
    // antiguos que no enviaban permisos. Las capacidades de gestión, en
    // cambio, solo se habilitan si el backend las declara expresamente.
    const hasResourceEntries = resourceKeys.some((key) =>
      key === resource || key.startsWith(`${resource}.`) || key.startsWith(`can_${resource}`) || key.startsWith(`view_${resource}`)
    );
    return !requiresExplicitPermission && !hasResourceEntries;
  }

  hasRole(userRoles: unknown, allowedRoles?: string[]): boolean {
    if (!allowedRoles?.length) return true;
    const current = Array.isArray(userRoles) ? userRoles.map(role => this.normalize(String(role))) : [];
    if (this.hasAdminRole(current)) return true;
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

    // En Lite la configuración tributaria debe estar lista antes de permitir
    // cualquier intento de emisión, incluso si se invoca la acción por código
    // y no únicamente desde un botón deshabilitado.
    const setupBlockMessage = this.getLiteSetupBlockMessage();
    if (setupBlockMessage) {
      return { allowed: false, message: setupBlockMessage };
    }

    if (this.isCertificateEmissionBlocked()) {
      return { allowed: false, message: this.certificateLastError || `El certificado electrónico está ${this.certificateStatus || 'no vigente'}.` };
    }

    const plan = this.plan;
    if (!plan) {
      return { allowed: false, message: 'La empresa no tiene un plan asignado para emitir comprobantes.' };
    }

    const planStatus = this.normalize(String(plan.status || ''));
    if (plan.active === false || ['VENCIDO', 'SUSPENDIDO', 'CANCELADO', 'INACTIVO'].includes(planStatus)) {
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
    return this.validateFeatureUse('direct_invoice').allowed && !this.getLiteSetupBlockMessage();
  }

  getPlanBlockMessage(feature: CompanyFeatureKey = 'direct_invoice'): string | null {
    const result = this.validateFeatureUse(feature);
    return result.allowed ? null : result.message || 'Acción no permitida por el plan actual.';
  }

  getLiteSetupBlockMessage(): string | null {
    if (!this.isLiteMode || this.liteSetupReady === true) return null;
    if (this.liteSetupMissing.length) {
      const labels: Record<string, string> = {
        tax_profile: 'perfil tributario',
        establishment: 'establecimiento',
        emission_point: 'punto de emisión',
        invoice_sequence: 'secuencia de factura'
      };
      const pending = this.liteSetupMissing.map((item) => labels[item] || item).join(', ');
      return `Completa la configuración pendiente: ${pending}.`;
    }
    return 'Completa la configuración de FacturADA Lite antes de emitir facturas.';
  }

  getLandingRoute(userRoles: unknown): string {
    if (this.isLiteMode && this.hasRole(userRoles, ['GERENTE', 'CAJERO', 'FACTURACION', 'USUARIO', 'ADMINISTRADOR DEL NEGOCIO', 'ALL'])) {
      return '/dashboard/main';
    }
    if (this.businessMode === 'FACTURADOR' && this.hasRole(userRoles, ['GERENTE', 'CAJERO'])) {
      return '/dashboard/main';
    }
    if (this.canAccess('tables', ['GERENTE', 'CAJERO', 'MESERO'], userRoles)) return '/dashboard/pos';
    if (this.canAccess('direct_invoice', ['GERENTE', 'CAJERO', 'FACTURACION'], userRoles)) return '/dashboard/invoicing';
    if (this.canAccess('kitchen', ['GERENTE', 'COCINA'], userRoles)) return '/dashboard/orders-realtime';
    return '/dashboard/no-access';
  }

  getPosExitRoute(userRoles: unknown): string {
    if (this.isLiteMode && this.canAccess('direct_invoice', ['GERENTE', 'CAJERO', 'FACTURACION'], userRoles)) return '/dashboard/invoicing';
    if (this.canAccess('orders', ['GERENTE', 'CAJERO', 'MESERO'], userRoles)) return '/dashboard/orders';
    if (this.canAccess('direct_invoice', ['GERENTE', 'CAJERO', 'FACTURACION'], userRoles)) return '/dashboard/invoicing';
    if (this.canAccess('kitchen', ['GERENTE', 'COCINA'], userRoles)) return '/dashboard/orders-realtime';
    return '/dashboard/no-access';
  }

  clear(): void {
    localStorage.removeItem(this.storageKey);
    localStorage.removeItem('businessId');
    localStorage.removeItem('active_business');
    this.state.set(this.defaultState());
  }

  private get featureKeys(): CompanyFeatureKey[] {
    return ['orders', 'tables', 'kitchen', 'cash_register', 'direct_invoice', 'credit_note', 'customers', 'products', 'additional_fields', 'inventory'];
  }

  private get restaurantOnlyFeatures(): CompanyFeatureKey[] {
    return ['orders', 'tables', 'kitchen', 'cash_register'];
  }

  private readStored(): CompanyCapabilitiesConfig {
    try {
      const stored = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
      if (stored?.features) {
        const businessMode = this.resolveBusinessMode(stored.businessMode);
        return {
          businessMode,
          features: { ...this.defaultFeaturesForMode(businessMode), ...stored.features },
          plan: this.normalizePlan(stored.plan),
          business: stored.business ?? null,
          activeBusiness: stored.activeBusiness ?? stored.business ?? null,
          businesses: Array.isArray(stored.businesses) ? stored.businesses : [],
          roles: this.normalizeRoles(stored.roles),
          businessRole: stored.businessRole ?? null,
          permissions: stored.permissions && (Array.isArray(stored.permissions) || typeof stored.permissions === 'object') ? stored.permissions : null,
          certificateStatus: stored.certificateStatus ?? null,
          certificateLastError: stored.certificateLastError ?? null,
          liteSetupReady: stored.liteSetupReady ?? null,
          liteSetupMissing: Array.isArray(stored.liteSetupMissing) ? stored.liteSetupMissing : [],
          sequences: Array.isArray(stored.sequences) ? stored.sequences : [],
          loaded: stored.loaded === true
        };
      }
    } catch { }
    return this.defaultState();
  }

  private defaultState(): CompanyCapabilitiesConfig {
    return { businessMode: 'RESTAURANTE', features: { ...RESTAURANT_FALLBACK }, plan: null, business: null, activeBusiness: null, businesses: [], roles: [], permissions: null, certificateStatus: null, certificateLastError: null, liteSetupReady: null, liteSetupMissing: [], sequences: [], loaded: false };
  }

  private normalizePlan(value: unknown): CompanyPlan | null {
    if (!value || typeof value !== 'object') return null;
    const plan = value as CompanyPlan;
    // Lite usa la nomenclatura *_documents; el modelo histórico usa
    // *_authorized_vouchers. Normalizamos ambos al mismo contador interno.
    const unlimited = this.coerceOptionalBoolean(
      plan.unlimited_authorized_vouchers ?? plan.unlimited_documents
    ) === true;
    const rawPurchased = plan.purchased_authorized_vouchers ?? plan.max_authorized_documents;
    const rawUsed = plan.used_authorized_vouchers ?? plan.used_authorized_documents;
    const rawRemaining = plan.remaining_authorized_vouchers ?? plan.remaining_authorized_documents;

    return {
      ...plan,
      status: this.normalize(String(plan.status || '')),
      active: this.coerceOptionalBoolean(plan.active),
      auto_renew: this.coerceOptionalBoolean(plan.auto_renew),
      allow_restaurant_mode: this.coerceOptionalBoolean(plan.allow_restaurant_mode),
      allow_invoice_mode: this.coerceOptionalBoolean(plan.allow_invoice_mode),
      unlimited_authorized_vouchers: unlimited,
      unlimited_documents: unlimited,
      max_authorized_documents: Number(rawPurchased) || 0,
      used_authorized_documents: Number(rawUsed) || 0,
      purchased_authorized_vouchers: Number(rawPurchased) || 0,
      used_authorized_vouchers: Number(rawUsed) || 0,
      remaining_authorized_vouchers: unlimited
        ? -1
        : (rawRemaining === null || rawRemaining === undefined || `${rawRemaining}`.trim() === ''
          ? 0
          : Number(rawRemaining) || 0),
      remaining_authorized_documents: unlimited
        ? -1
        : (rawRemaining === null || rawRemaining === undefined || `${rawRemaining}`.trim() === ''
          ? 0
          : Number(rawRemaining) || 0)
    };
  }

  private toBoolean(value: unknown): boolean {
    return this.coerceOptionalBoolean(value) === true;
  }

  private normalizeMissing(value: unknown): string[] {
    if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>)
        .filter(([, present]) => present === true || present === 1 || present === '1'
          || (typeof present === 'string' && present.trim() !== '')
          || (present !== null && typeof present === 'object'))
        .map(([key]) => key);
    }
    return value ? [String(value).trim()].filter(Boolean) : [];
  }

  private mergeFeatures(current: CompanyFeatures, received: Record<string, unknown>): CompanyFeatures {
    const next = { ...current };
    this.featureKeys.forEach((key) => {
      if (received[key] !== undefined) next[key] = this.toBoolean(received[key]);
    });
    return next;
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
    return plan.unlimited_authorized_vouchers === true
      || plan.unlimited_documents === true
      || Number(plan.remaining_authorized_vouchers ?? plan.remaining_authorized_documents) === -1;
  }

  private resolveBusinessMode(value: unknown): BusinessMode {
    const normalized = this.normalize(String(value || ''));
    // "Facturacion Simple" es el modelo comercial del nuevo backend Lite.
    // No debe caer en el modo FACTURADOR histórico solo porque contiene
    // la palabra FACTURACION.
    if (
      normalized === 'FACTURACION SIMPLE' ||
      normalized === 'FACTURADA SIMPLE' ||
      normalized === 'FACTURACION LITE'
    ) {
      return 'FACTURADA_LITE';
    }
    if (
      normalized === 'LITE' ||
      normalized === 'FACTURADA_LITE' ||
      normalized === 'FACTURADA LITE' ||
      normalized === 'FACTURADA-LITE' ||
      normalized.includes('LITE')
    ) {
      return 'FACTURADA_LITE';
    }

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

  private defaultFeaturesForMode(mode: BusinessMode): CompanyFeatures {
    if (mode === 'FACTURADA_LITE') {
      return {
        orders: false,
        tables: false,
        kitchen: false,
        cash_register: false,
        direct_invoice: true,
        credit_note: false,
        customers: true,
        products: true,
        additional_fields: true,
        inventory: false
      };
    }

    return { ...RESTAURANT_FALLBACK };
  }

  private looksLikeLiteFeatures(features: unknown): boolean {
    if (!features || typeof features !== 'object') return false;
    const value = features as Partial<Record<CompanyFeatureKey, unknown>>;
    return this.coerceOptionalBoolean(value.direct_invoice) === true &&
      this.coerceOptionalBoolean(value.orders) === false &&
      this.coerceOptionalBoolean(value.tables) === false &&
      this.coerceOptionalBoolean(value.kitchen) === false &&
      this.coerceOptionalBoolean(value.cash_register) === false;
  }

  private normalizeRoles(value: unknown): string[] {
    const roles = Array.isArray(value) ? value : (value ? [value] : []);
    return roles.map(role => this.normalize(String(role))).filter(Boolean);
  }

  private hasAdminRole(roles: string[]): boolean {
    return roles.includes('SYSTEM MANAGER') || roles.includes('ADMINISTRATOR') || roles.includes('ADMINISTRADOR') || roles.includes('ADMINISTRADOR DEL NEGOCIO');
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  }
}
