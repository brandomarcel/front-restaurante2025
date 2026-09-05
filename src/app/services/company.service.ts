// company.service.ts
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, EMPTY, map, Observable, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeData } from '../core/utils/frappe-response';

export interface CompanyInfo {
  name?: string;                 // En Frappe suele ser string
  business?: string;
  businessname?: string;
  ambiente?: 'PRUEBAS' | 'PRODUCCION';
  ruc?: string;
  address?: string;
  phone?: string;
  email?: string;
  business_mode?: 'RESTAURANTE' | 'FACTURADOR' | string;
  establishmentcode?: string;
  emissionpoint?: string;
  invoiceseq_prod?: number;
  invoiceseq_pruebas?: number;

  ncseq_pruebas?: number;
  ncseq_prod?: number;
  logo?: string;                 // file_url en Frappe
  urlfirma?: string;   // file_url del .p12
  certificate_reference?: string;
  has_certificate_password?: boolean | number | string;
  certificate_valid_from?: string;
  certificate_valid_to?: string;
  certificate_serial?: string;
  certificate_subject?: string;
  certificate_issuer?: string;
  certificate_status?: string;
  certificate_last_error?: string;
  clave?: string;      // Password (Frappe lo cifra en el servidor)
  enable_provider_ruc?: boolean | number;
  provider_ruc?: string;
  service_base_url?: string;
  obligado_a_llevar_contabilidad?: 'SI' | 'NO' | string;
  business_name?: string;
  legal_name?: string;
  trade_name?: string;
  main_address?: string;
  environment?: string;
  establishment_code?: string;
  establishment_name?: string;
  emission_point_code?: string;
  emission_point_name?: string;
  current_number?: number;
  software_provider_ruc?: string;
  ready?: boolean;
  missing?: string[];
  establishments?: any[];
  emission_points?: any[];
  sequences?: any[];
  tax_profile?: any;
  tax_context?: any;
  features?: Record<string, boolean>;
  plan?: any;
}

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  private urlBase: string = '';
  constructor(private http: HttpClient,
    private frappeErr: FrappeErrorService,
    private capabilities: CompanyCapabilitiesService,
  ) {
    this.urlBase = this.apiUrl + API_ENDPOINT.AnalyzeFirma;
  }

  getAll(fields: string[] = ['*'], business?: string) {
    return this.getLiteSetup(business).pipe(
      map((response: any) => ({ message: { data: [this.extractCompanyFromContext(response)] } }))
    );
  }

  get_empresa(business?: string) {
    return this.getLiteContext(business);
  }

  getOne(name: string) {
    return this.getLiteSetup(name).pipe(
      map((response: any) => this.extractCompanyFromContext(response))
    );
  }

  create(data: CompanyInfo) {
    if (this.capabilities.isLiteMode) {
      return throwError(() => new Error('La configuración de empresa Lite es solo lectura desde el frontend.'));
    }

    return this.http.post(`${this.apiUrl}/resource/Company`, data, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }

  update(id: string, data: Partial<CompanyInfo>) {
    if (this.capabilities.isLiteMode) {
      return throwError(() => new Error('La configuración de empresa Lite es solo lectura desde el frontend.'));
    }

    const updatePayload = { ...(data || {}) } as Record<string, any>;
    // El RUC identifica legalmente a la empresa y no es editable.
    delete updatePayload['ruc'];
    return this.http.put(`${this.apiUrl}/resource/Company/${encodeURIComponent(id)}`, updatePayload, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }

  delete(id: string) {
    if (this.capabilities.isLiteMode) {
      return throwError(() => new Error('La configuración de empresa Lite es solo lectura desde el frontend.'));
    }

    return this.http.delete(`${this.apiUrl}/resource/Company/${encodeURIComponent(id)}`, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }

  /** Sube y adjunta el logo al doc Company, y actualiza el campo 'logo' */
  uploadLogo(file: File, companyId: string) {
    if (this.capabilities.isLiteMode) {
      return this.uploadLiteLogo(companyId || this.capabilities.businessId || '', file);
    }

    const form = new FormData();
    form.append('file', file);
    form.append('is_private', '0');            // 1 si quieres privado
    form.append('doctype', 'Company');
    form.append('docname', String(companyId)); // 🔴 obligatorio
    form.append('fieldname', 'logo');

    return this.http.post(`${this.apiUrl}/method/upload_file`, form, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }
  /** Sube y adjunta la FIRMA (.p12) al doc Company, y setea el campo 'urlfirma' */
  uploadFirma(file: File, companyId: string) {
    if (this.capabilities.isLiteMode) {
      const form = new FormData();
      form.append('file', file);
      form.append('is_private', '1');
      form.append('file_name', `firma_${companyId || this.capabilities.businessId || 'lite'}_${Date.now()}.p12`);
      return this.http.post(`${this.apiUrl}/method/upload_file`, form, { context: new HttpContext().set(REQUIRE_AUTH, true) });
    }

    const form = new FormData();
    form.append('file', file);
    form.append('is_private', '0');
    form.append('doctype', 'Company');
    form.append('docname', String(companyId));
    form.append('fieldname', 'urlfirma');
    // Fuerza nombre único para evitar caché/reuso por nombre en cargas consecutivas.
    form.append('file_name', `firma_${companyId}_${Date.now()}.p12`);

    return this.http.post(`${this.apiUrl}/method/upload_file`, form, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }

  analyzeFirma(password: string, companyId?: string, company_ruc?: string, file_url?: string, save_to_company = 1) {
    if (this.capabilities.isLiteMode) {
      return throwError(() => new Error('La validación de firma no está disponible en FacturADA Lite.'));
    }

    const payload: any = { password, save_to_company };
    if (companyId) payload.company = companyId;
    if (company_ruc) payload.company_ruc = company_ruc;
    if (file_url) payload.file_url = file_url;

    // Ajusta el path al del método Python que te pasé
    return this.http.post(
      `${this.urlBase}.analyze_company_firma`,
      payload,
      { context: new HttpContext().set(REQUIRE_AUTH, true) }).pipe(
            catchError((error) => {
              const msg = this.frappeErr.handle(error) || 'Error al crear la orden.';
              toast.error(msg);
              return EMPTY;
            })
          );

  }

  getLiteContext(business?: string) {
    const selectedBusiness = business || this.capabilities.activeBusinessId || localStorage.getItem('active_business') || localStorage.getItem('businessId') || '';
    if (!selectedBusiness) {
      return throwError(() => new Error('__LITE_BUSINESS_SELECTION_REQUIRED__'));
    }
    const params = new HttpParams().set('business', selectedBusiness);
    return this.http.get(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_user_context`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params
    }).pipe(
      map((response: any) => {
        if (!this.isLiteContext(response)) {
          throw new Error('__NOT_FACTURADA_LITE_CONTEXT__');
        }
        // Mantener sincronizado el negocio activo, rol y permisos cada vez
        // que se recarga el contexto (incluido un cambio de negocio).
        this.capabilities.setFromResponse(response);
        // get_user_context no es un listado: su contrato expone el contexto
        // directamente en `response.message`, no en `response.message.data`.
        return response?.message ?? response;
      }),
      catchError((error: any) => {
        if (error?.status === 403 && !this.isPermissionError(error)) {
          localStorage.removeItem('active_business');
          localStorage.removeItem('businessId');
          this.capabilities.clear();
        }
        return throwError(() => error);
      })
    );
  }

  getLiteSetup(business?: string) {
    let params = new HttpParams();
    const selectedBusiness = business || this.capabilities.activeBusinessId || localStorage.getItem('active_business') || localStorage.getItem('businessId') || '';
    if (!selectedBusiness) return throwError(() => new Error('__LITE_BUSINESS_SELECTION_REQUIRED__'));
    params = params.set('business', selectedBusiness);

    return this.http.get(`${this.apiUrl}${API_ENDPOINT.FacturadaLiteSetup}.get_lite_setup`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params
    }).pipe(map((response: any) => frappeData<any>(response)));
  }

  saveLiteSetup(payload: any) {
    const body = { ...(payload || {}) };
    // El RUC se define al crear el negocio; nunca se actualiza desde este flujo.
    delete body.ruc;
    if (this.capabilities.isLiteMode && !body.business) {
      const business = this.capabilities.businessId || localStorage.getItem('businessId');
      if (business) body.business = business;
    }
    return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLiteSetup}.save_lite_setup`, body, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(map((response: any) => frappeData<any>(response)));
  }

  uploadLiteCertificate(business: string, certificateFile: File, certificatePassword: string) {
    const formData = new FormData();
    formData.append('business', business);
    formData.append('file', certificateFile, certificateFile.name);
    formData.append('certificate_password', certificatePassword);

    return this.http.post(
      `${this.apiUrl}${API_ENDPOINT.FacturadaLiteSetup}.upload_lite_certificate`,
      formData,
      {
        withCredentials: true,
        context: new HttpContext().set(REQUIRE_AUTH, true)
      }
    ).pipe(map((response: any) => frappeData<any>(response)));
  }

  uploadLiteLogo(business: string, logoFile: File) {
    const formData = new FormData();
    formData.append('business', business);
    formData.append('file', logoFile, logoFile.name);

    return this.http.post(
      `${this.apiUrl}${API_ENDPOINT.FacturadaLiteSetup}.upload_lite_logo`,
      formData,
      {
        withCredentials: true,
        context: new HttpContext().set(REQUIRE_AUTH, true)
      }
    ).pipe(map((response: any) => frappeData<any>(response)));
  }

  /** Normaliza exclusivamente la respuesta nueva de get_lite_setup. */
  normalizeLiteSetup(response: any): CompanyInfo {
    return this.extractCompanyFromContext(response) as CompanyInfo;
  }

  private extractCompanyFromContext(response: any): any {
    const message = frappeData<any>(response) || {};
    const rawBusiness = message?.business;
    const rawCompany = rawBusiness && typeof rawBusiness === 'object'
      ? rawBusiness
      : (message?.company ?? message?.empresa ?? message?.data ?? message);
    const companyCandidate = Array.isArray(rawCompany) ? (rawCompany[0] ?? {}) : rawCompany;
    const nestedBusiness = companyCandidate?.business && typeof companyCandidate.business === 'object'
      ? companyCandidate.business
      : (companyCandidate?.company && typeof companyCandidate.company === 'object' ? companyCandidate.company : null);
    const company = companyCandidate && typeof companyCandidate === 'object'
      ? {
          ...(companyCandidate || {}),
          ...(nestedBusiness || {}),
          tax_profile: companyCandidate.tax_profile ?? nestedBusiness?.tax_profile,
          name: companyCandidate.name ?? nestedBusiness?.name ?? (typeof rawBusiness === 'string' ? rawBusiness : undefined)
      }
      : { name: typeof rawBusiness === 'string' ? rawBusiness : String(companyCandidate || '') };
    // get_lite_setup mantiene catálogos separados para establecimiento,
    // punto de emisión y secuencia. Normalízalos al modelo que consume el
    // formulario para que una configuración existente se muestre completa.
    const establishment = Array.isArray(message?.establishments)
      ? (message.establishments[0] || {})
      : (message?.establishment && typeof message.establishment === 'object' ? message.establishment : {});
    const emissionPoint = Array.isArray(message?.emission_points)
      ? (message.emission_points[0] || {})
      : (message?.emission_point && typeof message.emission_point === 'object' ? message.emission_point : {});
    const sequence = Array.isArray(message?.sequences)
      ? (message.sequences[0] || {})
      : (message?.sequence && typeof message.sequence === 'object' ? message.sequence : {});
    const taxProfile = message?.tax_profile && typeof message.tax_profile === 'object' ? message.tax_profile : {};
    return {
      ...(company || {}),
      name: company?.name ?? company?.business ?? message?.business,
      // En el modelo Lite los datos tributarios son la fuente de verdad para
      // la facturación; business solo contiene la identidad del negocio.
      business_name: company?.business_name ?? message?.business_name ?? company?.businessname,
      businessname: taxProfile?.legal_name ?? company?.businessname ?? company?.business_name
        ?? company?.trade_name ?? company?.legal_name ?? message?.business_name ?? message?.trade_name ?? message?.legal_name,
      legal_name: taxProfile?.legal_name ?? company?.legal_name ?? message?.legal_name,
      trade_name: taxProfile?.trade_name ?? company?.trade_name ?? message?.trade_name,
      ruc: taxProfile?.ruc ?? company?.ruc ?? message?.ruc,
      phone: taxProfile?.phone || company?.phone || message?.phone,
      email: taxProfile?.email || company?.email || message?.email,
      // En el modelo Lite el ambiente de emisión vive en
      // tax_profile.environment; `ambiente` queda solo como alias legado.
      ambiente: taxProfile?.environment ?? taxProfile?.ambiente ?? company?.environment ?? company?.ambiente ?? message?.environment,
      environment: taxProfile?.environment ?? taxProfile?.ambiente ?? company?.environment ?? message?.environment,
      address: taxProfile?.main_address ?? taxProfile?.address ?? company?.address ?? company?.main_address ?? message?.address ?? message?.main_address,
      main_address: taxProfile?.main_address ?? company?.main_address ?? message?.main_address,
      establishmentcode: company?.establishmentcode ?? company?.establishment_code ?? message?.establishment_code
        ?? establishment?.code ?? establishment?.establishment_code ?? establishment?.establishmentcode,
      establishment_name: company?.establishment_name ?? message?.establishment_name
        ?? establishment?.name ?? establishment?.establishment_name ?? 'Matriz',
      emissionpoint: company?.emissionpoint ?? company?.emission_point_code ?? message?.emission_point_code
        ?? emissionPoint?.code ?? emissionPoint?.emission_point_code ?? emissionPoint?.emissionpoint,
      emission_point_name: company?.emission_point_name ?? message?.emission_point_name
        ?? emissionPoint?.name ?? emissionPoint?.emission_point_name ?? 'Caja 001',
      provider_ruc: taxProfile?.provider_ruc ?? taxProfile?.software_provider_ruc
        ?? company?.provider_ruc ?? company?.software_provider_ruc ?? message?.software_provider_ruc,
      logo: company?.logo ?? nestedBusiness?.logo ?? message?.logo,
      urlfirma: company?.urlfirma ?? company?.certificate_reference ?? company?.tax_profile?.certificate_reference ?? message?.certificate_reference ?? message?.tax_profile?.certificate_reference,
      certificate_reference: company?.certificate_reference ?? company?.tax_profile?.certificate_reference ?? message?.certificate_reference ?? message?.tax_profile?.certificate_reference,
      has_certificate_password: company?.has_certificate_password ?? company?.tax_profile?.has_certificate_password ?? message?.has_certificate_password ?? message?.tax_profile?.has_certificate_password,
      certificate_valid_from: company?.certificate_valid_from ?? company?.tax_profile?.certificate_valid_from ?? message?.certificate_valid_from ?? message?.tax_profile?.certificate_valid_from,
      certificate_valid_to: company?.certificate_valid_to ?? company?.tax_profile?.certificate_valid_to ?? message?.certificate_valid_to ?? message?.tax_profile?.certificate_valid_to,
      certificate_serial: company?.certificate_serial ?? company?.tax_profile?.certificate_serial ?? message?.certificate_serial ?? message?.tax_profile?.certificate_serial,
      certificate_subject: company?.certificate_subject ?? company?.tax_profile?.certificate_subject ?? message?.certificate_subject ?? message?.tax_profile?.certificate_subject,
      certificate_issuer: company?.certificate_issuer ?? company?.tax_profile?.certificate_issuer ?? message?.certificate_issuer ?? message?.tax_profile?.certificate_issuer,
      certificate_status: company?.certificate_status ?? company?.tax_profile?.certificate_status ?? message?.certificate_status ?? message?.tax_profile?.certificate_status,
      certificate_last_error: company?.certificate_last_error ?? company?.tax_profile?.certificate_last_error ?? message?.certificate_last_error ?? message?.tax_profile?.certificate_last_error,
      service_base_url: taxProfile?.service_base_url ?? company?.service_base_url ?? message?.service_base_url,
      obligado_a_llevar_contabilidad: taxProfile?.obliged_accounting ?? taxProfile?.obligado_a_llevar_contabilidad
        ?? company?.obligado_a_llevar_contabilidad ?? message?.obligado_a_llevar_contabilidad,
      invoiceseq_pruebas: company?.invoiceseq_pruebas ?? company?.current_number ?? message?.current_number
        ?? sequence?.current_number ?? sequence?.currentNumber ?? sequence?.next_number,
      current_number: company?.current_number ?? message?.current_number
        ?? sequence?.current_number ?? sequence?.currentNumber ?? sequence?.next_number,
      features: message?.features ?? company?.features,
      plan: message?.plan ?? company?.plan,
      establishments: message?.establishments ?? company?.establishments,
      emission_points: message?.emission_points ?? company?.emission_points,
      sequences: message?.sequences ?? company?.sequences,
      tax_context: message?.tax_context ?? company?.tax_context,
      ready: message?.ready ?? company?.ready,
      missing: message?.missing ?? company?.missing,
      business_mode: company?.business_mode ?? company?.businessMode ?? message?.business_mode ?? message?.businessMode ?? message?.mode ?? message?.app_mode ?? 'FACTURADA_LITE'
    };
  }

  private isLiteContext(response: any): boolean {
    // get_user_context usa response.message directamente; solo los listados
    // de Lite usan response.message.data.
    const message = response?.message && typeof response.message === 'object' ? response.message : response || {};
    const rawBusiness = message?.business;
    const company = rawBusiness && typeof rawBusiness === 'object'
      ? rawBusiness
      : (message?.company ?? message?.empresa ?? message?.data ?? message);
    const mode = String(
      message?.business_mode ??
      message?.businessMode ??
      message?.mode ??
      message?.app_mode ??
      company?.business_mode ??
      company?.businessMode ??
      company?.mode ??
      company?.app_mode ??
      ''
    ).toUpperCase();

    const businessModel = String(company?.business_model ?? company?.businessModel ?? '').toUpperCase();
    if (mode.includes('LITE') || businessModel.includes('FACTURACION SIMPLE')) return true;

    // El mismo contexto se utiliza también para FacturADA Restaurante. No se
    // debe rechazar por no ser Lite si el backend ya entregó un negocio válido.
    if (typeof rawBusiness === 'string' && rawBusiness.trim()) return true;
    if (company && typeof company === 'object' && (company.name || company.business)) return true;

    const features = message?.features ?? company?.features;
    if (!features || typeof features !== 'object') return false;

    // Solo aceptamos banderas explícitas del contrato nuevo; nunca deducimos
    // el modo por la ausencia de órdenes, mesas o caja.
    return this.toBool(features.billing) || this.toBool(features.restaurant);
  }

  private isPermissionError(error: any): boolean {
    const payload = error?.error;
    const raw = [
      typeof payload === 'string' ? payload : undefined,
      payload?.exc_type,
      payload?.exception,
      payload?.exc,
      payload?._server_messages,
      payload?.message
    ].filter(Boolean).join(' ');
    return /permissionerror|permission denied|not permitted|not allowed|rol del usuario no permite/i.test(raw);
  }

  private toBool(value: any): boolean {
    return value === true || value === 1 || String(value).trim() === '1' || String(value).toUpperCase().trim() === 'TRUE';
  }

}
