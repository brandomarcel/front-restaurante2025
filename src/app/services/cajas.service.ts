import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, shareReplay, throwError } from 'rxjs';
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


  verificarAperturaActiva(usuario: string) {
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    return this.http.get<any>(`${this.restaurantApi}.get_current_cash_opening`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params: new HttpParams().set('business', business).set('usuario', usuario || '')
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
    return this.postRestaurant('create_cash_withdrawal', data);
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
  getRetirosPorApertura(aperturaId: string) {
    return this.verificarAperturaActiva('');
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
    const business = this.activeBusinessOrError();
    if (business instanceof Error) return throwError(() => business);
    return this.http.post<any>(`${this.restaurantApi}.${method}`, { ...(data || {}), business }, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  private normalizeCurrentOpening(response: any): any {
    const body = response?.message ?? response ?? {};
    const data = body?.data ?? body;
    const opening = data?.apertura ?? data?.cash_opening ?? data?.opening
      ?? (data?.name ? data : null);
    const payments = data?.payments ?? data?.detalle ?? {};
    return {
      ...response,
      data: opening ? [opening] : [],
      message: {
        ...(typeof body === 'object' ? body : {}),
        ...data,
        apertura: opening,
        monto_apertura: data?.monto_apertura ?? opening?.monto_apertura ?? 0,
        efectivo_sistema: data?.efectivo_sistema ?? 0,
        efectivo_real: data?.efectivo_real ?? 0,
        total_retiros: data?.total_retiros ?? 0,
        diferencia: data?.diferencia ?? 0,
        payments,
        detalle: payments
      }
    };
  }




}
