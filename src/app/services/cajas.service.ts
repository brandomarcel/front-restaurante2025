import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, shareReplay, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { FrappeErrorService } from '../core/services/frappe-error.service';

@Injectable({ providedIn: 'root' })
export class CajasService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient,
    private frappeErrorService: FrappeErrorService
  ) { }

  /** 📦 Obtener categorías (ejemplo que ya tenías) */
  getAllCategorias() {
    const campos = ['name', 'nombre', 'description', 'isactive'];
    return this.http.get(`${this.apiUrl}/resource/categorias?fields=${JSON.stringify(campos)}`, {
      withCredentials: true
    });
  }

  /** 🟢 Verificar si el usuario ya tiene una apertura activa */
  verificarAperturaActiva(usuario: string) {
    const url = `${this.apiUrl}/resource/Apertura de Caja?fields=["name"]&filters=[["usuario","=","${usuario}"],["estado","=","Abierta"]]`;
    return this.http.get<any>(url, { withCredentials: true });
  }

  /** 🟢 Crear apertura de caja */
  crearAperturaCaja(data: any) {
    const url = `${this.apiUrl}/resource/Apertura de Caja`;
    return this.http.post(url, data, { withCredentials: true });
  }

  /** 🔻 Registrar retiro de caja */
  registrarRetiro(data: any) {
    const url = `${this.apiUrl}/resource/Retiro de Caja`;
    return this.http.post(url, data, { withCredentials: true });
  }

  /** 📊 Obtener datos automáticos para el cierre de caja */
  getDatosCierre(usuario: string) {
    const url = `${this.apiUrl}/method/restaurante_app.restaurante_bmarc.doctype.cierre_de_caja.cierre_de_caja.calcular_datos_para_cierre`;
    return this.http.get<any>(`${url}?usuario=${usuario}`, { withCredentials: true }).pipe(
      catchError((e) => throwError(() => this.frappeErrorService.handle(e)))
      ,
      shareReplay(1)
    );
  }

  /** ✅ Crear el cierre de caja */
  crearCierreCaja(data: any) {
    return this.http.post(`${this.apiUrl}/resource/Cierre de Caja`, data, {
      withCredentials: true
    });
  }


  /** Obtener retiros del turno actual */
  getRetirosPorApertura(aperturaId: string) {
    const filters = encodeURIComponent(JSON.stringify([
      ["relacionado_a", "=", aperturaId]
    ]));
    const fields = encodeURIComponent(JSON.stringify(["name", "fecha_hora", "motivo", "monto"]));
    const url = `/api/resource/Retiro de Caja?fields=${fields}&filters=${filters}&order_by=fecha_hora desc`;
    return this.http.get<any>(url, { withCredentials: true });
  }


  eliminarRetiro(name: string) {
    return this.http.delete(`/api/resource/Retiro de Caja/${name}`, {
      withCredentials: true
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

    return this.http.get<any>(url, { withCredentials: true });
  }




}
