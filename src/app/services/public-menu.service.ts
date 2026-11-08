import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { map, Observable, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';

export type PublicMenuKind = 'Imagen' | 'PDF';
/** Cómo se llama en pantalla: «Carta» para un restaurante, «Catalogo» para los demás negocios (lo decide el backend). */
export type PublicMenuType = 'Carta' | 'Catalogo';

/** Palabras de la carta o del catálogo, con su género, para no repetir condiciones en cada texto. */
export interface MenuWords {
  /** «Carta digital» / «Catálogo digital» */
  title: string;
  /** «carta» / «catálogo» */
  noun: string;
  /** «la carta» / «el catálogo» */
  the: string;
  /** «de la carta» / «del catálogo» */
  ofThe: string;
  /** «publicada» / «publicado» */
  published: string;
  /** «Sin publicar» es igual para ambos; «Publicada» / «Publicado» */
  Published: string;
  /** «retirada» / «retirado» */
  withdrawn: string;
  /** «la» / «lo» (pronombre) */
  pronoun: string;
  /** Dónde va el QR: «en las mesas» / «en tu local» */
  qrPlace: string;
  /** Para el nombre del archivo del QR: «carta» / «catalogo» */
  slug: string;
}

export function menuWords(type: PublicMenuType | null | undefined): MenuWords {
  return type === 'Catalogo'
    ? { title: 'Catálogo digital', noun: 'catálogo', the: 'el catálogo', ofThe: 'del catálogo', published: 'publicado', Published: 'Publicado', withdrawn: 'retirado', pronoun: 'lo', qrPlace: 'en tu local', slug: 'catalogo' }
    : { title: 'Carta digital', noun: 'carta', the: 'la carta', ofThe: 'de la carta', published: 'publicada', Published: 'Publicada', withdrawn: 'retirada', pronoun: 'la', qrPlace: 'en las mesas', slug: 'carta' };
}

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
  /** Ausente en un backend anterior: se deduce de la función `restaurant` (`wordsFor`). */
  menu_type?: PublicMenuType;
}

/** Lo que ve el cliente al escanear el QR (endpoint sin sesión). */
export interface PublicMenu {
  business_name: string;
  logo: string | null;
  message: string;
  kind: PublicMenuKind | null;
  files: { url: string; kind: PublicMenuKind }[];
  /** Ausente en un backend anterior: se asume «Carta» (antes solo existía para restaurantes). */
  menu_type?: PublicMenuType;
}

/**
 * Carta (restaurante) o catálogo (otros negocios) digital por QR, función `digital_menu` en todos los
 * planes: el negocio sube fotos o un PDF y lo publica con un enlace secreto. La administración exige
 * `products.manage` (Administrador y Gerente); `getPublic`
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

  /** Palabras para la pantalla de administración; sin `menu_type` del backend, según la función `restaurant`. */
  wordsFor(settings: Pick<PublicMenuSettings, 'menu_type'> | null): MenuWords {
    return menuWords(settings?.menu_type ?? (this.capabilities.isEnabled('restaurant') ? 'Carta' : 'Catalogo'));
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
