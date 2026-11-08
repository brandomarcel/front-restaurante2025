import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { map, Observable, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';

export type PublicMenuKind = 'Imagen' | 'PDF';

export interface PublicMenuFile {
  name: string;
  url: string;
  kind: PublicMenuKind;
  file_name: string;
  file_size: number;
}

/** Configuración de la carta digital de un negocio (pantalla de administración). */
export interface PublicMenuSettings {
  business: string;
  business_name: string;
  logo: string | null;
  enabled: number;
  token: string;
  path: string;
  /** Enlace configurado en el backend (`facturada_app_url`); null si no está configurado. */
  public_url: string | null;
  message: string;
  kind: PublicMenuKind | null;
  files: PublicMenuFile[];
  max_images: number;
}

/** Lo que ve el cliente al escanear el QR (endpoint sin sesión). */
export interface PublicMenu {
  business_name: string;
  logo: string | null;
  message: string;
  kind: PublicMenuKind | null;
  files: { url: string; kind: PublicMenuKind }[];
}

/**
 * Carta digital por QR (solo restaurante): el negocio sube fotos o un PDF de su carta y lo
 * publica con un enlace secreto. La administración exige `restaurant.manage`; `getPublic`
 * es la única llamada sin sesión.
 */
@Injectable({ providedIn: 'root' })
export class PublicMenuService {
  private readonly base = `${environment.apiUrl}/method/facturada_restaurante.api.public_menu`;
  private readonly auth = () => ({ context: new HttpContext().set(REQUIRE_AUTH, true) });

  constructor(private http: HttpClient, private capabilities: CompanyCapabilitiesService) {}

  /**
   * Enlace del QR: el que fija el backend (`facturada_app_url`) o, sin configurar, la base de esta app.
   * `document.baseURI` respeta el `baseHref` (en producción la app vive en `/portal/`).
   */
  publicUrl(settings: Pick<PublicMenuSettings, 'path' | 'public_url'>): string {
    return settings.public_url || new URL(settings.path.replace(/^\//, ''), document.baseURI).toString();
  }

  /** URL absoluta de un archivo público de Frappe (`/files/...`). */
  fileUrl(path: string | null | undefined): string {
    if (!path) return '';
    return /^https?:\/\//.test(path) ? path : `${environment.URL}${path}`;
  }

  getSettings(): Observable<PublicMenuSettings> {
    const business = this.business();
    if (business instanceof Error) return throwError(() => business);
    return this.http.get<any>(`${this.base}.get_menu_settings`, { ...this.auth(), params: new HttpParams().set('business', business) })
      .pipe(map(this.data));
  }

  save(changes: { enabled?: boolean; message?: string }): Observable<PublicMenuSettings> {
    const business = this.business();
    if (business instanceof Error) return throwError(() => business);
    const payload: any = { business };
    if (changes.enabled !== undefined) payload.enabled = changes.enabled ? 1 : 0;
    if (changes.message !== undefined) payload.message = changes.message;
    return this.http.post<any>(`${this.base}.save_menu_settings`, payload, this.auth()).pipe(map(this.data));
  }

  /** Una foto se agrega al final; un PDF reemplaza todo. `replace` confirma borrar lo anterior. */
  upload(file: File, replace = false): Observable<PublicMenuSettings> {
    const business = this.business();
    if (business instanceof Error) return throwError(() => business);
    const form = new FormData();
    form.append('business', business);
    form.append('replace', replace ? '1' : '0');
    form.append('file', file, file.name);
    return this.http.post<any>(`${this.base}.upload_menu_file`, form, this.auth()).pipe(map(this.data));
  }

  remove(fileRow: string): Observable<PublicMenuSettings> {
    const business = this.business();
    if (business instanceof Error) return throwError(() => business);
    return this.http.post<any>(`${this.base}.remove_menu_file`, { business, file_row: fileRow }, this.auth()).pipe(map(this.data));
  }

  move(fileRow: string, direction: 'up' | 'down'): Observable<PublicMenuSettings> {
    const business = this.business();
    if (business instanceof Error) return throwError(() => business);
    return this.http.post<any>(`${this.base}.move_menu_file`, { business, file_row: fileRow, direction }, this.auth()).pipe(map(this.data));
  }

  regenerateLink(): Observable<PublicMenuSettings> {
    const business = this.business();
    if (business instanceof Error) return throwError(() => business);
    return this.http.post<any>(`${this.base}.regenerate_menu_token`, { business }, this.auth()).pipe(map(this.data));
  }

  /** PNG del QR como data URI. */
  getQr(url: string): Observable<string> {
    const business = this.business();
    if (business instanceof Error) return throwError(() => business);
    return this.http.get<any>(`${this.base}.get_menu_qr`, { ...this.auth(), params: new HttpParams().set('business', business).set('url', url) })
      .pipe(map((res: any) => (res?.message?.data ?? res?.data)?.png || ''));
  }

  /** Sin sesión: lo que ve el cliente. Un código inválido o una carta apagada responden 404. */
  getPublic(token: string): Observable<PublicMenu> {
    return this.http.get<any>(`${this.base}.get_public_menu`, { params: new HttpParams().set('token', token), withCredentials: false })
      .pipe(map(this.data));
  }

  private data = (res: any) => res?.message?.data ?? res?.data;

  private business(): string | Error {
    const business = this.capabilities.activeBusinessId || localStorage.getItem('active_business');
    return business ? business : new Error('Selecciona un negocio.');
  }
}
