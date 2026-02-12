import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, shareReplay, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { FrappeErrorService } from '../core/services/frappe-error.service';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';

@Injectable({ providedIn: 'root' })
export class CajasService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient,
    private frappeErrorService: FrappeErrorService
  ) { }


  getAllCategorias() {
    const campos = ['name', 'nombre', 'description', 'isactive'];
    return this.http.get(`${this.apiUrl}/resource/categorias?fields=${JSON.stringify(campos)}`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }


  verificarAperturaActiva(usuario: string) {
    const url = `${this.apiUrl}/resource/Apertura de Caja?fields=["name"]&filters=[["usuario","=","${usuario}"],["estado","=","Abierta"]]`;
    return this.http.get<any>(url, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }


  crearAperturaCaja(data: any) {
    const url = `${this.apiUrl}/resource/Apertura de Caja`;
    return this.http.post(url, data, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }

  registrarRetiro(data: any) {
    const url = `${this.apiUrl}/resource/Retiro de Caja`;
    return this.http.post(url, data, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }

  getDatosCierre(usuario: string):Observable<any> {
    const url = `${this.apiUrl}/method/restaurante_app.restaurante_bmarc.doctype.cierre_de_caja.cierre_de_caja.calcular_datos_para_cierre`;
    return this.http.get<any>(`${url}?usuario=${usuario}`, { context: new HttpContext().set(REQUIRE_AUTH, true) }).pipe(
      catchError((e) => throwError(() => this.frappeErrorService.handle(e)))
      ,
      shareReplay(1)
    );
  }


  crearCierreCaja(data: any) {
    return this.http.post(`${this.apiUrl}/resource/Cierre de Caja`, data, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }


  /** Obtener retiros del turno actual */
  getRetirosPorApertura(aperturaId: string) {
    const filters = encodeURIComponent(JSON.stringify([
      ["relacionado_a", "=", aperturaId]
    ]));
    const fields = encodeURIComponent(JSON.stringify(["name", "fecha_hora", "motivo", "monto"]));
    const url = `/api/resource/Retiro de Caja?fields=${fields}&filters=${filters}&order_by=fecha_hora desc`;
    return this.http.get<any>(url, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }


  eliminarRetiro(name: string) {
    return this.http.delete(`/api/resource/Retiro de Caja/${name}`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }


  /** 📄 Obtener reporte de cierres de caja */
  obtenerReporteCierres(usuario?: string, desde?: string, hasta?: string) {
    let params: any = {};
    if (usuario) params.usuario = usuario;
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;

    const query = new URLSearchParams(params).toString();
    const url = `${this.apiUrl}/method/restaurante_app.restaurante_bmarc.doctype.cierre_de_caja.cierre_de_caja.obtener_reporte_cierres?${query}`;

    return this.http.get<any>(url, { context: new HttpContext().set(REQUIRE_AUTH, true) });
  }




}
