import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, shareReplay, tap, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';

@Injectable({ providedIn: 'root' })
export class CajasService {
  private readonly apiUrl = environment.apiUrl;
  private readonly restaurantApi = `${environment.apiUrl}/method/facturada_restaurante.api.frontend`;

  constructor(private http: HttpClient,
    private frappeErrorService: FrappeErrorService,
    private capabilities: CompanyCapabilitiesService
  ) { }


  getAllCategorias() {
    if (!this.capabilities.isEnabled('cash_register')) {
      return throwError(() => new Error('Caja no está habilitada para este negocio.'));
    }

    const campos = ['name', 'nombre', 'description', 'isactive'];
    return this.http.get(`${this.apiUrl}/resource/categorias?fields=${JSON.stringify(campos)}`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }


  verificarAperturaActiva(_usuario = '') {
    const accessError = this.cashAccessError();
    if (accessError) return throwError(() => accessError);
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    return this.http.get<any>(`${this.restaurantApi}.get_current_cash_opening`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params: new HttpParams().set('business', business)
    }).pipe(map((response: any) => this.normalizeCurrentOpening(response)));
  }


  // crearAperturaCaja(data: any) {
  //   const url = `${this.apiUrl}/resource/Apertura de Caja`;
  //   return this.http.post(url, data, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  // }

  create_apertura_de_caja(data: any) {
    return this.postRestaurant('open_cash_register', data);
  }

  // registrarRetiro(data: any) {
  //   const url = `${this.apiUrl}/resource/Retiro de Caja`;
  //   return this.http.post(url, data, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  // }

  create_retiro_de_caja(data: any) {
    return this.postRestaurant('create_retiro_de_caja', data);
  }

  getDatosCierre(usuario: string):Observable<any> {
    return this.verificarAperturaActiva(usuario).pipe(
      catchError((e) => throwError(() => this.frappeErrorService.handle(e)))
      ,
      shareReplay(1)
    );
  }

  create_cierre_de_caja(data: any) {
    return this.postRestaurant('close_cash_register', data);
  }

  // crearCierreCaja(data: any) {
  //   return this.http.post(`${this.apiUrl}/resource/Cierre de Caja`, data, {
  //     context: new HttpContext().set(REQUIRE_AUTH, true)
  //   });
  // }


  /** Obtener retiros del turno actual */
  getCashWithdrawals() {
    const accessError = this.cashAccessError();
    if (accessError) return throwError(() => accessError);
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    return this.http.get<any>(`${this.restaurantApi}.get_cash_withdrawals`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params: new HttpParams().set('business', business)
    });
  }

  /** Historial administrativo de aperturas, retiros y cierres del negocio. */
  getCashRegisterHistory() {
    if (!this.capabilities.hasPermission('*') && !this.capabilities.hasPermission('restaurant.manage')) {
      return throwError(() => new Error('Solo un gerente o administrador puede consultar toda la gestión de caja'));
    }
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    return this.http.get<any>(`${this.restaurantApi}.get_cash_register_history`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params: new HttpParams().set('business', business)
    });
  }

  /**
   * Reporte oficial de cierres de caja publicado por Frappe Query Report.
   * El negocio siempre se toma del contexto activo; el caller no puede
   * consultar accidentalmente información de otra empresa.
   */
  getCashClosingsReport(filters: {
    user?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
    limit?: number;
  } = {}) {
    const accessError = this.cashClosingsReportAccessError();
    if (accessError) return throwError(() => accessError);
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    const reportFilters = {
      business,
      user: String(filters.user || ''),
      status: String(filters.status || ''),
      from_date: String(filters.from_date || ''),
      to_date: String(filters.to_date || ''),
      limit: Number(filters.limit || 100)
    };
    const params = new HttpParams()
      .set('report_name', 'FacturADA Restaurant Cash Closings')
      .set('filters', JSON.stringify(reportFilters))
      .set('ignore_prepared_report', '1');
    return this.http.get<any>(`${this.apiUrl}/method/frappe.desk.query_report.run`, {
      params,
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  /** Exporta el mismo reporte usando el exportador nativo de Frappe. */
  exportCashClosingsReport(filters: {
    user?: string;
    status?: string;
    from_date?: string;
    to_date?: string;
  } = {}) {
    const accessError = this.cashClosingsReportAccessError();
    if (accessError) return throwError(() => accessError);
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    const reportFilters = {
      business,
      user: String(filters.user || ''),
      status: String(filters.status || ''),
      from_date: String(filters.from_date || ''),
      to_date: String(filters.to_date || '')
    };
    return this.http.post(`${this.apiUrl}/method/frappe.desk.query_report.export_query`, {
      report_name: 'FacturADA Restaurant Cash Closings',
      filters: JSON.stringify(reportFilters),
      file_format_type: 'Excel',
      include_filters: 1
    }, {
      responseType: 'blob',
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  getRetirosPorApertura(_aperturaId?: string) {
    return this.getCashWithdrawals();
  }


  eliminarRetiro(name: string) {
    return throwError(() => new Error('El contrato nuevo no permite eliminar retiros de caja.'));
  }


  /** 📄 Obtener reporte de cierres de caja */
  obtenerReporteCierres(usuario?: string, desde?: string, hasta?: string) {
    return throwError(() => new Error('El reporte de cierres debe consumirse desde el reporte nuevo de restaurante.'));
  }

  private activeBusinessOrError(): string | Error {
    const business = this.capabilities.activeBusinessId || localStorage.getItem('active_business') || localStorage.getItem('businessId');
    return business ? business : new Error('Selecciona un negocio para operar caja.');
  }

  private postRestaurant(method: string, data: any) {
    const accessError = this.cashAccessError();
    if (accessError) return throwError(() => accessError);
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    const payload = { ...(data || {}), business };
    return this.http.post<any>(`${this.restaurantApi}.${method}`, payload, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(
      tap(() => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('facturada:restaurant-data-changed'));
        }
      })
    );
  }

  /** Caja solo está disponible con la capacidad POS/caja y el permiso del negocio. */
  private cashAccessError(): Error | null {
    const featureEnabled = this.capabilities.isEnabled('restaurant_pos')
      && this.capabilities.isEnabled('cash_register');
    if (!featureEnabled) return new Error('La función pos no está habilitada para este negocio.');
    if (!this.capabilities.hasPermission('restaurant.cash.manage')) {
      return new Error('El rol del usuario no permite realizar esta operación.');
    }
    return null;
  }

  private cashClosingsReportAccessError(): Error | null {
    const features = this.capabilities.features;
    const featureEnabled = features.restaurant === true
      && features.restaurant_pos === true
      && features.cash_register === true;
    if (!featureEnabled) return new Error('Este reporte no está habilitado para este negocio.');
    if (!this.capabilities.hasPermission('*') && !this.capabilities.hasPermission('restaurant.manage')) {
      return new Error('No tienes permiso para consultar este reporte.');
    }
    return null;
  }

  private normalizeCurrentOpening(response: any): any {
    const body = response?.message ?? response ?? {};
    const dataValue = body?.data ?? response?.data;
    const raw = Array.isArray(dataValue) ? dataValue[0] : (dataValue ?? body);
    const candidate = raw?.cash_opening ?? raw?.apertura ?? raw?.opening
      ?? (raw?.name ? raw : null);
    // Algunos contratos devuelven `cash_opening: {}` cuando no hay turno.
    // Un objeto vacío no representa una apertura válida.
    const opening = this.hasOpeningRecord(candidate) ? candidate : null;
    const status = String(opening?.status ?? opening?.estado ?? raw?.status ?? '').trim().toLowerCase();
    const activeOpening = opening && status !== 'cerrada' && status !== 'closed' ? opening : null;
    const payments = raw?.payments ?? raw?.detalle ?? activeOpening?.payments ?? {};
    const normalized = {
      ...(typeof raw === 'object' ? raw : {}),
      cash_opening: activeOpening,
      apertura: activeOpening,
      opening: activeOpening,
      // Conservamos la última apertura aunque ya esté cerrada para que la
      // pantalla pueda diferenciar "Cerrada" de "Sin apertura activa".
      last_cash_opening: opening,
      opening_status: opening?.status ?? opening?.estado ?? raw?.status ?? null,
      is_open: !!activeOpening,
      expected_cash_available: raw?.expected_cash !== undefined
        || raw?.efectivo_esperado !== undefined
        || raw?.efectivo_sistema !== undefined,
      monto_apertura: raw?.monto_apertura ?? raw?.opening_amount ?? activeOpening?.monto_apertura ?? activeOpening?.opening_amount ?? 0,
      efectivo_sistema: raw?.efectivo_sistema ?? raw?.system_cash ?? activeOpening?.efectivo_sistema ?? 0,
      efectivo_real: raw?.efectivo_real ?? raw?.cash_counted ?? activeOpening?.efectivo_real ?? 0,
      total_retiros: raw?.total_retiros ?? raw?.total_withdrawals ?? activeOpening?.total_retiros ?? 0,
      diferencia: raw?.diferencia ?? raw?.difference ?? activeOpening?.diferencia ?? 0,
      expected_cash: raw?.expected_cash ?? raw?.efectivo_esperado ?? activeOpening?.expected_cash ?? 0,
      payments,
      payment_totals: raw?.payment_totals ?? activeOpening?.payment_totals ?? []
    };
    return {
      ...response,
      data: activeOpening ? [activeOpening] : [],
      message: {
        ...(typeof body === 'object' ? body : {}),
        ...normalized,
        data: normalized,
        detalle: payments
      }
    };
  }

  private hasOpeningRecord(value: any): boolean {
    if (typeof value === 'string') return value.trim().length > 0;
    if (!value || typeof value !== 'object') return false;
    return Boolean(String(value.name || value.cash_opening || value.apertura || '').trim());
  }




}
