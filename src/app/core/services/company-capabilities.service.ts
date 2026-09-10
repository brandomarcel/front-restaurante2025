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
  | 'inventory'
  | 'restaurant'
  | 'pos'
  | 'restaurant_pos'
  | 'generic_pos'
  | 'pos_terminal'
  | 'billing'
  | 'api';

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
  establishments?: any[];
  emissionPoints?: any[];
  sequences?: any[];
  posTerminals?: any[];
  terminalAccessRequired?: boolean;
  requiresTerminalSelection?: boolean;
  hasTerminalAccess?: boolean;
  terminal?: any | null;
  /** Configuración de integración API devuelta por get_user_context. */
  apiConfiguration?: any | null;
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
  inventory: true,
  restaurant: false,
  pos: false,
  restaurant_pos: false,
  generic_pos: false,
  pos_terminal: false,
  billing: false,
  api: false
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
  /**
   * El selector del menú, el contexto y todas las solicitudes usan el mismo
   * identificador persistido. Solo se toma del storage si aún pertenece al
   * catálogo cargado; así una selección antigua no puede desalinear la UI.
   */
  get activeBusinessId(): string | null {
    const current = this.state();
    const persisted = String(localStorage.getItem('active_business') || localStorage.getItem('businessId') || '').trim();
    const currentId = String(current.activeBusiness?.name || current.activeBusiness?.business || current.business?.name || current.business?.business || '').trim();
    const belongsToList = persisted && current.businesses.some((item: any) =>
      String(item?.name || item?.business || '').trim() === persisted
    );
    if (persisted && (belongsToList || persisted === currentId)) return persisted;
    return currentId || null;
  }

  /** Negocio seleccionado actualmente, enriquecido con el contexto recibido. */
  get activeBusiness(): any | null {
    const current = this.state();
    const id = this.activeBusinessId;
    const listed = id ? current.businesses.find((item: any) => String(item?.name || item?.business || '').trim() === id) : null;
    const contextual = current.activeBusiness ?? current.business;
    return listed ? { ...listed, ...(contextual || {}) } : contextual;
  }
  get businesses(): any[] { return this.state().businesses; }
  get roles(): string[] { return this.state().roles; }
  get businessRole(): string | null { return this.state().businessRole || null; }
  get permissions(): Record<string, any> | string[] | null { return this.state().permissions || null; }
  get certificateStatus(): string | null { return this.state().certificateStatus || null; }
  get certificateLastError(): string | null { return this.state().certificateLastError || null; }
  get liteSetupReady(): boolean | null { return this.state().liteSetupReady ?? null; }
  get liteSetupMissing(): string[] { return this.state().liteSetupMissing || []; }
  get establishments(): any[] { return this.state().establishments || []; }
  get emissionPoints(): any[] { return this.state().emissionPoints || []; }
  get sequences(): any[] { return this.state().sequences || []; }
  get posTerminals(): any[] { return this.state().posTerminals || []; }
  get apiConfiguration(): any | null { return this.state().apiConfiguration ?? null; }
  get terminalAccessRequired(): boolean { return this.state().terminalAccessRequired === true; }
  get requiresTerminalSelection(): boolean { return this.state().requiresTerminalSelection === true; }
  get hasTerminalAccess(): boolean { return this.state().hasTerminalAccess !== false; }
  get activePosTerminal(): any | null {
    const business = this.activeBusinessId;
    if (!business) return null;
    const persisted = String(localStorage.getItem(this.posTerminalStorageKey(business)) || '').trim();
    const active = this.posTerminals.filter((item: any) => this.isActiveRecord(item));
    const contextual = this.state().terminal && this.isActiveRecord(this.state().terminal)
      && (!this.state().terminal.business || String(this.state().terminal.business) === business)
      ? this.state().terminal
      : null;
    return active.find((item: any) => String(item?.name || '').trim() === persisted)
      || active.find((item: any) => String(item?.name || '').trim() === String(this.state().terminal?.name || '').trim())
      || (contextual && (!persisted || String(contextual.name || '').trim() === persisted) ? contextual : null)
      || (this.requiresTerminalSelection ? null : active.length === 1 ? active[0] : null);
  }

  /**
   * Ubicación fiscal efectiva que se utilizará al emitir. Cuando existe un
   * terminal POS, sus datos tienen prioridad; de lo contrario se muestran el
   * establecimiento y punto seleccionados en la configuración Lite.
   */
  get activeFiscalLocation(): any | null {
    const terminal = this.activePosTerminal;
    const terminalEstablishment = terminal?.establishment
      ? this.activeEstablishments.find((item: any) => this.recordId(item) === String(terminal.establishment).trim())
      : null;
    const terminalPoint = terminal?.emission_point
      ? this.activeEmissionPointsFor(terminalEstablishment || String(terminal.emission_point).trim())
        .find((item: any) => this.recordId(item) === String(terminal.emission_point).trim())
      : null;
    const establishment = terminalEstablishment
      ? {
          ...terminalEstablishment,
          establishment_code: terminal?.establishment_code || terminalEstablishment.establishment_code,
          establishment_name: terminal?.establishment_name || terminalEstablishment.establishment_name
        }
      : this.selectedLiteEstablishment || (terminal?.establishment ? {
      name: terminal.establishment,
      establishment_code: terminal.establishment_code,
      establishment_name: terminal.establishment_name
    } : null);
    const emissionPoint = terminalPoint
      ? {
          ...terminalPoint,
          emission_point_code: terminal?.emission_point_code || terminalPoint.emission_point_code,
          emission_point_name: terminal?.emission_point_name || terminalPoint.emission_point_name
        }
      : this.selectedLiteEmissionPoint || (terminal?.emission_point ? {
      name: terminal.emission_point,
      emission_point_code: terminal.emission_point_code,
      emission_point_name: terminal.emission_point_name
    } : null);
    const environment = this.business?.environment
      || this.business?.ambiente
      || this.business?.tax_profile?.environment
      || this.business?.tax_profile?.ambiente
      || null;
    if (!terminal && !establishment && !emissionPoint) return null;
    return { terminal, establishment, emissionPoint, environment };
  }

  setActivePosTerminal(terminal: any | null): boolean {
    const business = this.activeBusinessId;
    const name = String(
      terminal?.name
      ?? terminal?.terminal
      ?? terminal?.id
      ?? (typeof terminal === 'string' ? terminal : '')
    ).trim();
    const candidates = this.state().terminal && !this.posTerminals.some((item: any) => String(item?.name || '') === String(this.state().terminal?.name || ''))
      ? [...this.posTerminals, this.state().terminal]
      : this.posTerminals;
    const match = business && candidates.find((item: any) =>
      String(item?.name || '').trim() === name && (!item.business || String(item.business) === business) && this.isActiveRecord(item)
    );
    if (!business || !match) return false;
    localStorage.setItem(this.posTerminalStorageKey(business), name);
    const next = { ...this.state(), terminal: match };
    this.state.set(next);
    localStorage.setItem(this.storageKey, JSON.stringify(next));
    return true;
  }

  clearActivePosTerminal(): void {
    const business = this.activeBusinessId;
    if (business) localStorage.removeItem(this.posTerminalStorageKey(business));
    this.state.set({ ...this.state(), terminal: null });
  }

  getPosTerminalBlockMessage(): string | null {
    if (!this.terminalAccessRequired) return null;
    if (!this.hasTerminalAccess) return 'No tiene un terminal POS activo asignado. Contacte al administrador.';
    if (this.requiresTerminalSelection && !this.activePosTerminal) return 'Seleccione un terminal POS para facturar.';
    return null;
  }
  /**
   * La selección tributaria se conserva por negocio; nunca es una variable
   * global reutilizable entre empresas. Los identificadores se validan de
   * nuevo contra el setup que el backend devuelve para el negocio activo.
   */
  get selectedLiteEstablishment(): any | null {
    const selection = this.getLiteDocumentSelection();
    return this.activeEstablishments.find((item: any) => this.recordId(item) === selection.establishment) || null;
  }

  get selectedLiteEmissionPoint(): any | null {
    const selection = this.getLiteDocumentSelection();
    const establishment = this.selectedLiteEstablishment;
    if (!establishment) return null;
    return this.activeEmissionPointsFor(establishment).find((item: any) => this.recordId(item) === selection.emissionPoint) || null;
  }

  get activeEstablishments(): any[] {
    return this.establishments.filter((item: any) => this.belongsToActiveBusiness(item) && this.isActiveRecord(item));
  }

  activeEmissionPointsFor(establishment: any | string | null): any[] {
    const establishmentId = typeof establishment === 'string' ? establishment : this.recordId(establishment);
    if (!establishmentId) return [];
    return this.emissionPoints.filter((item: any) =>
      this.belongsToActiveBusiness(item)
      && this.isActiveRecord(item)
      && String(item?.establishment || '').trim() === establishmentId
    );
  }

  /** Guarda una selección ya validada, exclusivamente bajo el negocio actual. */
  setLiteDocumentSelection(establishmentId?: unknown, emissionPointId?: unknown): boolean {
    const business = this.activeBusinessId;
    if (!business) return false;
    const establishment = this.activeEstablishments.find((item: any) => this.recordId(item) === String(establishmentId || '').trim());
    if (!establishment) return false;
    const normalizedPointId = String(emissionPointId || '').trim();
    // El establecimiento se puede seleccionar antes de que sus puntos estén
    // disponibles. Conservamos esa selección por negocio y completamos el
    // punto cuando el catálogo termine de cargarse.
    if (!normalizedPointId) {
      localStorage.setItem(this.liteDocumentSelectionKey(business), JSON.stringify({
        establishment: this.recordId(establishment),
        emissionPoint: ''
      }));
      return true;
    }
    const points = this.activeEmissionPointsFor(establishment);
    const point = points.find((item: any) => this.recordId(item) === normalizedPointId);
    if (!point) return false;
    localStorage.setItem(this.liteDocumentSelectionKey(business), JSON.stringify({
      establishment: this.recordId(establishment),
      emissionPoint: this.recordId(point)
    }));
    return true;
  }

  clearLiteDocumentSelection(): void {
    const business = this.activeBusinessId;
    if (business) localStorage.removeItem(this.liteDocumentSelectionKey(business));
  }

  /** Devuelve una combinación segura para emitir; no genera secuenciales. */
  getLiteDocumentConfiguration(documentType: 'Factura' | 'Nota de Credito', environment?: unknown): {
    business: string;
    establishment: any;
    emissionPoint: any;
    sequence: any;
    environment: 'Pruebas' | 'Produccion';
  } | null {
    const business = this.activeBusinessId;
    const terminal = this.activePosTerminal;
    const terminalEstablishmentId = String(terminal?.establishment || '').trim();
    const terminalPointId = String(terminal?.emission_point || '').trim();
    const establishment = this.selectedLiteEstablishment
      || this.activeEstablishments.find((item: any) => this.recordId(item) === terminalEstablishmentId)
      || null;
    const emissionPoint = this.selectedLiteEmissionPoint
      || (establishment ? this.activeEmissionPointsFor(establishment).find((item: any) => this.recordId(item) === terminalPointId) : null)
      || null;
    const target = this.normalizeEnvironment(environment
      || this.business?.environment
      || this.business?.ambiente
      || this.business?.tax_profile?.environment);
    if (!business || !establishment || !emissionPoint || !target) return null;
    const sequence = this.sequences.find((item: any) =>
      this.belongsToActiveBusiness(item)
      && this.isActiveRecord(item)
      && this.normalize(String(item?.document_type ?? item?.documentType ?? '')) === this.normalize(documentType)
      && this.normalizeEnvironment(item?.environment) === target
      && String(item?.establishment || '').trim() === this.recordId(establishment)
      && String(item?.emission_point ?? item?.emissionPoint ?? '').trim() === this.recordId(emissionPoint)
    );
    return sequence ? { business, establishment, emissionPoint, sequence, environment: target } : null;
  }

  hasActiveInvoiceSequence(environment?: unknown): boolean {
    return !!this.getLiteDocumentConfiguration('Factura', environment);
  }
  get businessId(): string | null { return this.business?.name || this.business?.business || null; }
  get isLoaded(): boolean { return this.state().loaded; }
  get isLiteMode(): boolean { return this.businessMode === 'FACTURADA_LITE'; }

  /**
   * Un negocio API-only factura desde el sistema externo del cliente. No
   * necesita usuarios operativos ni terminales POS administrados en FacturADA.
   */
  get isApiOnlyMode(): boolean {
    const features = this.features;
    return features.api === true
      && features.billing !== true
      && features.restaurant !== true;
  }

  /** La configuración tributaria es administrativa, incluso si el backend
   * entrega permisos operativos a otros roles. */
  get canManageBusinessInfrastructure(): boolean {
    const role = this.normalize(String(this.businessRole || ''));
    return this.hasAdminRole(this.roles)
      || role === 'ADMINISTRADOR'
      || role === 'GERENTE';
  }

  /** Rol autorizado para modificar la configuración tributaria del negocio. */
  get canManageBusinessSetup(): boolean {
    return this.canManageBusinessInfrastructure;
  }

  setFromResponse(response: any): void {
    const selectedBusinessId = this.activeBusinessId;
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
    const responseBusinessId = String(normalizedCompany?.name || normalizedCompany?.business || selectedBusinessId || '').trim();
    const matchesSelectedBusiness = !selectedBusinessId || !responseBusinessId || selectedBusinessId === responseBusinessId;
    // get_user_context puede omitir el perfil tributario. Conservamos el
    // ambiente que ya fue cargado desde get_lite_setup para no perderlo al
    // refrescar el contexto de usuario.
    if (normalizedCompany && !normalizedCompany.environment && !normalizedCompany.ambiente) {
      const previousEnvironment = this.state().business?.environment ?? this.state().business?.ambiente;
      if (previousEnvironment) normalizedCompany.environment = previousEnvironment;
    }
    const received = message?.features ?? normalizedCompany?.features ?? nestedCompany?.features ?? response?.features;
    const features = received && typeof received === 'object'
      ? this.featureKeys.reduce((result, key) => {
          const value = this.coerceOptionalBoolean(received[key]);
          if (value !== undefined) result[key] = value === true;
          return result;
        }, this.emptyFeatures())
      : this.state().features;
    // La modalidad es una vista derivada de las features del contexto. No se
    // toma del nombre del plan, business_model, business_type ni roles Frappe.
    const businessMode = this.resolveBusinessModeFromFeatures(features);

    const plan = this.normalizePlan(message?.plan ?? normalizedCompany?.plan ?? nestedCompany?.plan ?? response?.plan);
    // Algunos contextos resumidos no devuelven `businesses`. Conservamos el
    // catálogo consultado al iniciar sesión para que el combo no se vacíe ni
    // cambie de empresa visualmente.
    // `get_businesses` es la fuente canónica del selector. El contexto puede
    // devolver una lista resumida o atrasada; no debe reemplazar el catálogo
    // ni cambiar visualmente la empresa que el usuario ya seleccionó.
    const businesses = this.state().businesses.length
      ? this.state().businesses
      : (Array.isArray(message?.businesses) ? message.businesses : []);
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
      ?? ((features.billing === true || features.direct_invoice === true) && hasCertificatePassword !== undefined && this.coerceOptionalBoolean(hasCertificatePassword) !== true
        ? 'NO CONFIGURADO'
        : null);
    const terminalContext = message?.terminal && typeof message.terminal === 'object' ? message.terminal : null;
    const posTerminals = Array.isArray(message?.pos_terminals)
      ? message.pos_terminals
      : (Array.isArray(terminalContext?.pos_terminals)
        ? terminalContext.pos_terminals
        : (Array.isArray(terminalContext?.terminals) ? terminalContext.terminals : (this.state().posTerminals || [])));
    const terminalCandidates = posTerminals.filter((item: any) =>
      !item?.business || !responseBusinessId || String(item.business) === responseBusinessId
    );
    const persistedTerminalName = responseBusinessId
      ? String(localStorage.getItem(this.posTerminalStorageKey(responseBusinessId)) || '').trim()
      : '';
    const contextTerminal = terminalContext?.terminal && typeof terminalContext.terminal === 'object'
      ? terminalContext.terminal
      : (terminalContext?.selected_terminal && typeof terminalContext.selected_terminal === 'object'
        ? terminalContext.selected_terminal
        : (terminalContext?.selected && typeof terminalContext.selected === 'object'
          ? terminalContext.selected
          : (terminalContext?.name ? terminalContext : null)));
    const contextTerminalName = typeof message?.terminal === 'string'
      ? String(message.terminal).trim()
      : String(contextTerminal?.name || message?.terminal_name || '').trim();
    const selectedTerminal = terminalCandidates.find((item: any) => String(item?.name || '') === persistedTerminalName)
      || terminalCandidates.find((item: any) => String(item?.name || '') === contextTerminalName)
      || (contextTerminal && (!contextTerminal.business || !responseBusinessId || String(contextTerminal.business) === responseBusinessId) ? contextTerminal : null);

    const apiConfiguration = message?.api_configuration === undefined
      ? this.state().apiConfiguration
      : this.normalizeApiConfiguration(message.api_configuration);
    const config: CompanyCapabilitiesConfig = {
      businessMode,
      features,
      plan,
      business: matchesSelectedBusiness ? (normalizedCompany || null) : this.state().business,
      activeBusiness: matchesSelectedBusiness ? (normalizedCompany || null) : this.state().activeBusiness,
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
      establishments: Array.isArray(message?.establishments) ? message.establishments : (this.state().establishments || []),
      emissionPoints: Array.isArray(message?.emission_points) ? message.emission_points : (this.state().emissionPoints || []),
      sequences: Array.isArray(message?.sequences) ? message.sequences : (this.state().sequences || []),
      posTerminals: terminalCandidates,
      terminalAccessRequired: this.toBoolean(message?.terminal_access_required ?? terminalContext?.terminal_access_required),
      requiresTerminalSelection: this.toBoolean(message?.requires_terminal_selection ?? terminalContext?.requires_terminal_selection),
      hasTerminalAccess: message?.has_terminal_access === undefined && terminalContext?.has_terminal_access === undefined
        ? this.state().hasTerminalAccess
        : this.toBoolean(message?.has_terminal_access ?? terminalContext?.has_terminal_access),
      terminal: selectedTerminal,
      apiConfiguration,
      loaded: true
    };
    this.state.set(config);
    localStorage.setItem(this.storageKey, JSON.stringify(config));
    this.ensureLiteDocumentSelection();
    if (setupEnvironment) this.utilsService.cambiarAmbiente(setupEnvironment);
    const businessId = config.business?.name || (typeof config.business?.business === 'string' ? config.business.business : null) || null;
    if (businessId && matchesSelectedBusiness) {
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
    const selectedBusinessId = this.activeBusinessId;
    const setupBusinessId = String(setupBusiness?.name || setupBusiness?.business || '').trim();
    const matchesSelectedBusiness = !selectedBusinessId || !setupBusinessId || selectedBusinessId === setupBusinessId;
    const setupEnvironment = taxProfile.environment ?? taxProfile.ambiente;
    const business = matchesSelectedBusiness && (Object.keys(setupBusiness).length || setupEnvironment)
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
      // No reemplazar visualmente el negocio del selector con una respuesta
      // ajena o retrasada: la configuración siempre debe corresponder al
      // `business` elegido antes de aplicarse al estado.
      activeBusiness: matchesSelectedBusiness ? (business || current.activeBusiness) : current.activeBusiness,
      // Plan y features vienen del contexto de usuario. get_lite_setup solo
      // actualiza configuración tributaria, readiness e infraestructura.
      // No conservar "NO CONFIGURADO" de un contexto anterior cuando el
      // setup recién consultado confirma que existe contraseña/certificado.
      // Si el backend aún no publica vigencia, queda pendiente de validar y
      // no se inventa ni se bloquea por un estado obsoleto.
      certificateStatus: taxProfile.certificate_status
        ?? (hasCertificatePassword !== undefined && hasCertificatePassword !== null
          ? (this.toBoolean(hasCertificatePassword)
            ? (this.normalize(String(current.certificateStatus || '')) === 'NO CONFIGURADO'
              ? 'PENDIENTE DE VALIDAR'
              : current.certificateStatus)
            : 'NO CONFIGURADO')
          : current.certificateStatus),
      certificateLastError: taxProfile.certificate_last_error ?? current.certificateLastError,
      liteSetupReady: data?.ready === undefined || data?.ready === null ? current.liteSetupReady : this.toBoolean(data.ready),
      liteSetupMissing: data?.missing === undefined ? current.liteSetupMissing : this.normalizeMissing(data.missing),
      establishments: Array.isArray(data?.establishments) ? data.establishments : (current.establishments || []),
      emissionPoints: Array.isArray(data?.emission_points) ? data.emission_points : (current.emissionPoints || []),
      sequences: Array.isArray(data?.sequences) ? data.sequences : (current.sequences || []),
      loaded: true
    };
    this.state.set(next);
    localStorage.setItem(this.storageKey, JSON.stringify(next));
    if (matchesSelectedBusiness) {
      // El setup puede devolver la ubicación vigente en tax_context. Se usa
      // únicamente cuando no existe una selección guardada para este negocio;
      // una elección explícita del usuario siempre tiene prioridad.
      const taxContext = data?.tax_context && typeof data.tax_context === 'object' ? data.tax_context : {};
      const contextEstablishment = this.extractRecordId(
        taxContext?.establishment ?? taxContext?.establishment_name ?? data?.establishment
      );
      const contextEmissionPoint = this.extractRecordId(
        taxContext?.emission_point ?? taxContext?.emission_point_name ?? data?.emission_point
      );
      this.ensureLiteDocumentSelection(contextEstablishment, contextEmissionPoint);
    }
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
      features: this.emptyFeatures(),
      permissions: null,
      businessRole: null,
      plan: null,
      certificateStatus: null,
      certificateLastError: null,
      liteSetupReady: null,
      liteSetupMissing: [],
      establishments: [],
      emissionPoints: [],
      sequences: [],
      posTerminals: [],
      terminalAccessRequired: false,
      requiresTerminalSelection: false,
      hasTerminalAccess: true,
      terminal: null,
      apiConfiguration: null
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
    this.state.set({ businessMode: 'RESTAURANTE', features: this.emptyFeatures(), plan: null, business: null, activeBusiness: null, businesses: [], roles: [], businessRole: null, permissions: null, certificateStatus: null, certificateLastError: null, liteSetupReady: null, liteSetupMissing: [], establishments: [], emissionPoints: [], sequences: [], posTerminals: [], terminalAccessRequired: false, requiresTerminalSelection: false, hasTerminalAccess: false, terminal: null, apiConfiguration: null, loaded: true });
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
    // FacturADA Restaurante también emite mediante la infraestructura Lite;
    // la condición es la capacidad de facturación, no el nombre del modo.
    if (this.features.billing !== true) return false;
    const status = this.normalize(this.certificateStatus || '');
    return ['NO CONFIGURADO', 'VENCIDO', 'NO VIGENTE', 'ERROR DE LECTURA'].includes(status) || !!this.certificateLastError;
  }

  isEnabled(feature?: CompanyFeatureKey): boolean {
    if (!feature) return true;
    const features = this.features;
    const isRestaurant = features.restaurant === true;

    if (feature === 'restaurant') return isRestaurant;
    if (feature === 'restaurant_pos') return isRestaurant && features.restaurant_pos === true;
    if (feature === 'generic_pos') return features.generic_pos === true;
    if (feature === 'pos_terminal') return features.pos_terminal === true;
    // `pos` es la licencia POS; no habilita por sí sola la caja.
    if (feature === 'pos') return features.pos === true;
    // La caja de restaurante requiere su bandera explícita.
    if (feature === 'cash_register') return features.cash_register === true;

    // Facturación no depende del modo restaurante. `billing` habilita la
    // experiencia facturable completa; las claves previas se aceptan como
    // compatibilidad granular cuando billing aún no llegue del backend.
    if (feature === 'direct_invoice') return features.direct_invoice === true;
    if (feature === 'credit_note') return features.credit_note === true;

    // Las mesas pueden estar habilitadas en un negocio restaurante incluso
    // mientras el backend termina de publicar la bandera granular `tables`.
    if (feature === 'tables') {
      return isRestaurant && features.tables === true;
    }

    if (this.restaurantOnlyFeatures.includes(feature)) {
      return isRestaurant && features[feature] === true;
    }
    if (this.isApiOnlyMode && ['customers', 'products', 'inventory', 'additional_fields'].includes(feature)) return false;
    return features[feature] === true;
  }

  hasPermission(permission?: string): boolean {
    if (!permission || !this.permissions) return true;
    if (this.hasAdminRole(this.roles)) return true;
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
    if (plan.active === false || ['VENCIDO', 'SUSPENDIDO', 'CANCELADO', 'INACTIVO', 'PENDIENTE', 'PENDING'].includes(planStatus)) {
      return {
        allowed: false,
        message: planStatus === 'PENDIENTE' || planStatus === 'PENDING'
          ? 'La suscripción de la empresa está pendiente de activación.'
          : 'El plan de la empresa no está activo.'
      };
    }

    if (this.businessMode === 'RESTAURANTE' && plan.allow_restaurant_mode === false) {
      return { allowed: false, message: 'El plan actual no permite operar en modo restaurante.' };
    }

    if (this.businessMode === 'FACTURADOR' && plan.allow_invoice_mode === false) {
      return { allowed: false, message: 'El plan actual no permite operar en modo facturador.' };
    }

    const remaining = plan.remaining_authorized_documents ?? plan.remaining_authorized_vouchers;
    if (!this.hasUnlimitedVouchers(plan) && (remaining === null || remaining === undefined || Number(remaining) <= 0)) {
      return { allowed: false, message: 'No quedan comprobantes disponibles en el plan actual.' };
    }

    return { allowed: true };
  }

  canEmit(): boolean {
    const feature: CompanyFeatureKey = this.isEnabled('generic_pos') ? 'generic_pos' : 'direct_invoice';
    return this.validateFeatureUse(feature).allowed && !this.getLiteSetupBlockMessage();
  }

  getPlanBlockMessage(feature: CompanyFeatureKey = 'direct_invoice'): string | null {
    const result = this.validateFeatureUse(feature);
    return result.allowed ? null : result.message || 'Acción no permitida por el plan actual.';
  }

  getLiteSetupBlockMessage(): string | null {
    if (this.features.billing !== true || this.liteSetupReady === true) return null;
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
    if (!this.isEnabled('restaurant') && this.isLiteMode && this.hasRole(userRoles, ['GERENTE', 'CAJERO', 'FACTURACION', 'USUARIO', 'ALL'])) {
      return '/dashboard/main';
    }
    if (this.businessMode === 'FACTURADOR' && this.hasRole(userRoles, ['GERENTE', 'CAJERO'])) {
      return '/dashboard/main';
    }
    if (this.canAccess('restaurant_pos', ['GERENTE', 'CAJERO', 'MESERO'], userRoles)) return '/dashboard/pos';
    if (this.canAccess('direct_invoice', ['GERENTE', 'CAJERO', 'FACTURACION'], userRoles)) return '/dashboard/invoicing';
    if (this.canAccess('kitchen', ['GERENTE', 'COCINA'], userRoles)) return '/dashboard/orders-realtime';
    return '/dashboard/no-access';
  }

  getPosExitRoute(userRoles: unknown): string {
    if (!this.isEnabled('restaurant') && this.isLiteMode && this.canAccess('direct_invoice', ['GERENTE', 'CAJERO', 'FACTURACION'], userRoles)) return '/dashboard/invoicing';
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
    return ['restaurant', 'restaurant_pos', 'generic_pos', 'pos_terminal', 'pos', 'billing', 'api', 'orders', 'tables', 'kitchen', 'cash_register', 'direct_invoice', 'credit_note', 'customers', 'products', 'additional_fields', 'inventory'];
  }

  /** Actualiza o limpia la configuración API sin tocar el resto del contexto. */
  setApiConfiguration(value: any | null): void {
    const next = { ...this.state(), apiConfiguration: this.normalizeApiConfiguration(value) };
    this.state.set(next);
    if (next.loaded) localStorage.setItem(this.storageKey, JSON.stringify(next));
  }

  private emptyFeatures(): CompanyFeatures {
    return this.featureKeys.reduce((result, key) => {
      result[key] = false;
      return result;
    }, {} as CompanyFeatures);
  }

  private get restaurantOnlyFeatures(): CompanyFeatureKey[] {
    return ['restaurant_pos', 'orders', 'tables', 'kitchen'];
  }

  private readStored(): CompanyCapabilitiesConfig {
    try {
      const stored = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
      if (stored?.features) {
        const features = { ...this.emptyFeatures(), ...stored.features } as CompanyFeatures;
        const businessMode = this.resolveBusinessModeFromFeatures(features);
        return {
          businessMode,
          features,
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
          establishments: Array.isArray(stored.establishments) ? stored.establishments : [],
          emissionPoints: Array.isArray(stored.emissionPoints) ? stored.emissionPoints : [],
          sequences: Array.isArray(stored.sequences) ? stored.sequences : [],
          posTerminals: Array.isArray(stored.posTerminals) ? stored.posTerminals : [],
          terminalAccessRequired: stored.terminalAccessRequired === true,
          requiresTerminalSelection: stored.requiresTerminalSelection === true,
          hasTerminalAccess: stored.hasTerminalAccess !== false,
          terminal: stored.terminal ?? null,
          apiConfiguration: this.normalizeApiConfiguration(stored.apiConfiguration),
          loaded: stored.loaded === true
        };
      }
    } catch { }
    return this.defaultState();
  }

  private defaultState(): CompanyCapabilitiesConfig {
    return { businessMode: 'RESTAURANTE', features: this.emptyFeatures(), plan: null, business: null, activeBusiness: null, businesses: [], roles: [], permissions: null, certificateStatus: null, certificateLastError: null, liteSetupReady: null, liteSetupMissing: [], establishments: [], emissionPoints: [], sequences: [], posTerminals: [], terminalAccessRequired: false, requiresTerminalSelection: false, hasTerminalAccess: false, terminal: null, apiConfiguration: null, loaded: false };
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

  private liteDocumentSelectionKey(business: string): string {
    return `lite_document_selection:${business}`;
  }

  private posTerminalStorageKey(business: string): string {
    return `pos_terminal:${business}`;
  }

  private getLiteDocumentSelection(): { establishment: string; emissionPoint: string } {
    const business = this.activeBusinessId;
    if (!business) return { establishment: '', emissionPoint: '' };
    try {
      const saved = JSON.parse(localStorage.getItem(this.liteDocumentSelectionKey(business)) || '{}');
      return {
        establishment: String(saved?.establishment || '').trim(),
        emissionPoint: String(saved?.emissionPoint || '').trim()
      };
    } catch {
      return { establishment: '', emissionPoint: '' };
    }
  }

  /**
   * Solo propone los valores explícitamente marcados por backend (principal /
   * predeterminado), o el único registro activo. Nunca toma arbitrariamente
   * el primer elemento de una lista con varias alternativas.
   */
  private ensureLiteDocumentSelection(preferredEstablishmentId = '', preferredEmissionPointId = ''): void {
    const business = this.activeBusinessId;
    if (!business) return;
    const stored = this.getLiteDocumentSelection();
    const establishments = this.activeEstablishments;
    const establishment = establishments.find((item: any) => this.recordId(item) === stored.establishment)
      || establishments.find((item: any) => this.recordId(item) === preferredEstablishmentId)
      || establishments.find((item: any) => this.toBoolean(item?.is_main))
      || (establishments.length === 1 ? establishments[0] : null);
    if (!establishment) {
      localStorage.removeItem(this.liteDocumentSelectionKey(business));
      return;
    }
    const points = this.activeEmissionPointsFor(establishment);
    const point = points.find((item: any) => this.recordId(item) === stored.emissionPoint)
      || points.find((item: any) => this.recordId(item) === preferredEmissionPointId)
      || points.find((item: any) => this.toBoolean(item?.is_default))
      || (points.length === 1 ? points[0] : null);
    if (!point) {
      localStorage.setItem(this.liteDocumentSelectionKey(business), JSON.stringify({
        establishment: this.recordId(establishment), emissionPoint: ''
      }));
      return;
    }
    localStorage.setItem(this.liteDocumentSelectionKey(business), JSON.stringify({
      establishment: this.recordId(establishment), emissionPoint: this.recordId(point)
    }));
  }

  private belongsToActiveBusiness(record: any): boolean {
    const business = this.activeBusinessId;
    const recordBusiness = String(record?.business || record?.business_name || '').trim();
    return !recordBusiness || !business || recordBusiness === business;
  }

  private isActiveRecord(record: any): boolean {
    return this.normalize(String(record?.status ?? 'Activo')) === 'ACTIVO';
  }

  private recordId(record: any): string {
    return String(record?.name || record?.id || '').trim();
  }

  private extractRecordId(value: unknown): string {
    if (value && typeof value === 'object') return this.recordId(value);
    return String(value || '').trim();
  }

  private normalizeEnvironment(value: unknown): 'Pruebas' | 'Produccion' | '' {
    const normalized = this.normalize(String(value || ''));
    if (normalized.includes('PROD')) return 'Produccion';
    if (normalized.includes('PRUEB') || normalized === 'TEST') return 'Pruebas';
    return '';
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
    return feature === 'direct_invoice' || feature === 'generic_pos' || feature === 'credit_note';
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
        inventory: false,
        restaurant: false,
        pos: false,
        restaurant_pos: false,
        generic_pos: false,
        pos_terminal: false,
        billing: false,
        api: false
      };
    }

    return { ...RESTAURANT_FALLBACK };
  }

  /** Conserva únicamente los datos públicos que la pantalla de integración necesita. */
  private normalizeApiConfiguration(value: any): any | null {
    if (!value || typeof value !== 'object') return null;
    const enabled = this.toBoolean(value.enabled);
    const canView = value.can_view === undefined ? true : this.toBoolean(value.can_view);
    if (!canView) return { enabled, can_view: false, clients: [] };
    const clients = Array.isArray(value.clients)
      ? value.clients.map((client: any) => ({
          name: client?.name,
          client_name: client?.client_name,
          api_key: client?.api_key,
          status: client?.status,
          environment: client?.environment,
          rate_limit: client?.rate_limit,
          modified: client?.modified
        }))
      : [];
    return {
      enabled,
      can_view: true,
      base_url: value.base_url,
      authentication: value.authentication,
      clients
    };
  }

  private resolveBusinessModeFromFeatures(features: CompanyFeatures): BusinessMode {
    if (features.restaurant === true) return 'RESTAURANTE';
    // Billing y API-only usan la infraestructura Lite. La diferencia entre
    // ambos queda determinada por isApiOnlyMode, también basado únicamente
    // en las banderas del contexto.
    if (features.billing === true || features.api === true || features.direct_invoice === true || features.credit_note === true || features.generic_pos === true || features.pos_terminal === true) {
      return 'FACTURADA_LITE';
    }
    return 'RESTAURANTE';
  }

  private hasExplicitBillingFeature(features: unknown): boolean {
    if (!features || typeof features !== 'object') return false;
    const value = features as Partial<Record<CompanyFeatureKey, unknown>>;
    return this.coerceOptionalBoolean(value.billing) === true;
  }

  private normalizeRoles(value: unknown): string[] {
    const roles = Array.isArray(value) ? value : (value ? [value] : []);
    return roles.map(role => this.normalize(String(role))).filter(Boolean);
  }

  private hasAdminRole(roles: string[]): boolean {
    return roles.includes('SYSTEM MANAGER') || roles.includes('ADMINISTRATOR') || roles.includes('ADMINISTRADOR');
  }

  private normalize(value: string): string {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  }
}
