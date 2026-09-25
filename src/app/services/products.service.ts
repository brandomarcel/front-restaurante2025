import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { map, throwError, timeout } from 'rxjs';
import { frappeData, frappeList } from '../core/utils/frappe-response';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  constructor(private http: HttpClient, private capabilities: CompanyCapabilitiesService) {}

  // getAll() {
  //   const campos = ['name', 'nombre', 'precio', 'descripcion', 'categoria', 'tax','isactive','is_out_of_stock'];

  //   return this.http.get(`${environment.apiUrl}/resource/Producto?fields=${JSON.stringify(campos)}&limit_page_length=1000&order_by=categoria asc`, {
  //     
  //   });
  // }

  getAll(
    isactive: number | null = 1,
    limit?: number,
    offset = 0,
    search = '',
    status?: string,
    category?: string,
    onlyLowStock = false,
    /** Pantallas de inventario/stock: trae las variantes activas en vez del producto agrupador (que nunca tiene stock propio). El catálogo de Productos nunca debe mandar esto. */
    flattenVariants = false
  ) {
      let params = new HttpParams();

      if (isactive !== undefined && isactive !== null) {
        params = params.set('isactive', isactive.toString());
      }
      if (limit !== undefined) {
        params = params.set('limit', String(limit)).set('offset', String(offset));
      }
      if (search.trim()) params = params.set('search', search.trim());
      if (status) params = params.set('status', status);
      if (category) params = params.set('category', category);
      if (onlyLowStock) params = params.set('only_low_stock', '1');
      if (flattenVariants) params = params.set('flatten_variants', '1');
      params = this.withLiteBusiness(params);
      const url = `${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_productos`;

      const request$ = this.http.get(url, {
        context: new HttpContext().set(REQUIRE_AUTH, true),
        params,
      });
      return request$.pipe(map((res: any) => {
        const message = res?.message ?? res ?? {};
        const rawData = message?.data;
        const rows = (Array.isArray(rawData)
          ? rawData
          : (Array.isArray(rawData?.data) ? rawData.data : frappeList<any>(res)))
          .map((item:any) => this.fromLiteProduct(item));
        if (limit === undefined) return rows;
        const totalValue = Number(message?.total ?? message?.total_count ?? message?.count ?? rawData?.total ?? res?.total);
        const total = Number.isFinite(totalValue) && totalValue >= 0 ? totalValue : rows.length;
        const hasNext = message?.has_next ?? message?.hasNext ?? (offset + rows.length < total);
        return {
          ...res,
          message: {
            ...message,
            data: rows,
            total,
            limit: Number(message?.limit ?? limit),
            offset: Number(message?.offset ?? offset),
            has_next: Boolean(hasNext)
          }
        };
      }));
    }

  /**
   * Variantes de un producto principal (`get_producto_variantes`). Se lee de
   * `response.message.data` con la misma paginación que `getAll`. Si el
   * producto no tiene variantes, el backend devuelve `total: 0` y el llamador
   * trata al producto como uno simple (sin romper compatibilidad).
   */
  getVariantes(productId: string, limit = 100, offset = 0) {
    let params = new HttpParams()
      .set('product_id', productId)
      .set('limit', String(limit))
      .set('offset', String(offset));
    params = this.withLiteBusiness(params);
    const url = `${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_producto_variantes`;

    return this.http.get(url, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params,
    })
    .pipe(
      // Si el endpoint no responde, la petición quedaría pendiente para
      // siempre y la pantalla se vería "colgada" en el estado de carga. Con
      // el timeout, el llamador siempre recibe un error y puede mostrarlo.
      timeout(20000),
      map((res: any) => {
        console.log('getVariantes response:', res);
        // La respuesta cruda de Frappe trae los datos en `message.data`; acá
        // se "aplana" a `{ data, total, limit, offset, has_next }` para que
        // el llamador nunca tenga que conocer ese anidamiento.
        const message = res?.message ?? res ?? {};
        const rawData = message?.data;
        const rows = (Array.isArray(rawData) ? rawData : frappeList<any>(res))
          .map((item: any) => this.fromLiteProduct(item));
        const totalValue = Number(message?.total ?? rows.length);
        return {
          data: rows,
          total: Number.isFinite(totalValue) && totalValue >= 0 ? totalValue : rows.length,
          limit: Number(message?.limit ?? limit),
          offset: Number(message?.offset ?? offset),
          has_next: Boolean(message?.has_next ?? (offset + rows.length < totalValue))
        };
      })
    );
  }

  searchProductos(search: string, limit = 10) {
    const params = new HttpParams()
      .set('search', String(search || '').trim())
      .set('limit', String(limit));
    const requestParams = this.withLiteBusiness(params);
    const url = `${this.apiUrl}${API_ENDPOINT.FacturadaLite}.search_productos`;

    return this.http.get(url, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params: requestParams
    }).pipe(map((res: any) => frappeList<any>(res).map((item) => this.fromLiteProduct(item))));
  }


  getById(id: number) {
    let params = new HttpParams().set('product_id', String(id));
    params = this.withLiteBusiness(params);
    return this.http.get<any>(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_producto_by_id`, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params,
    }).pipe(map((res: any) => this.fromLiteProduct(frappeData<any>(res))));
  }

  create(data: any) {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para crear el producto.'));
    const url = `${this.apiUrl}${API_ENDPOINT.FacturadaLite}.create_producto`;
    const payload = { ...this.toLiteProductPayload(data, true), business };
    return this.http.post(url, payload, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
    }).pipe(map((res: any) => this.fromLiteProduct(frappeData<any>(res))));
  }

  /** Sube la imagen después de crear el Item. FormData deja que el navegador
   * establezca automáticamente el boundary multipart; no se fija Content-Type.
   */
  uploadImage(item: string, file: File) {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para cargar la imagen del producto.'));
    const itemName = String(item || '').trim();
    if (!itemName) return throwError(() => new Error('No se recibió el nombre del producto para cargar la imagen.'));
    const formData = new FormData();
    formData.append('business', business);
    formData.append('item', itemName);
    formData.append('file', file, file.name);
    return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLiteUpload}`, formData, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(map((res: any) => {
      // El endpoint puede devolver el Item completo o únicamente los campos
      // actualizados. No normalizamos los campos faltantes para no sobrescribir
      // el nombre/precio del producto recién creado con su ID interno.
      const product = frappeData<any>(res) || {};
      const image = product.image ?? product.imagen ?? '';
      return {
        ...product,
        image,
        image_url: this.resolveImageUrl(product.image_url || image)
      };
    }));
  }


  update(name: string, data: any) {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para editar el producto.'));
    const payload = { name, ...data };
    const litePayload = { ...this.toLiteProductPayload(payload, false), business };
    return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.update_producto`, litePayload, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
    }).pipe(map((res: any) => this.fromLiteProduct(frappeData<any>(res))));
  }


  delete(name: string) {
    let params = new HttpParams().set('name', name);
    params = this.withLiteBusiness(params);
    return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.delete_producto`, {}, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
      params
    }).pipe(map((res: any) => frappeData<any>(res)));
  }

  /**
   * Crea una variante concreta de un producto principal. El payload sigue
   * exactamente el contrato de `create_producto` para variantes (item_name,
   * item_code, variant_of, is_variant, attributes, standard_rate, tax_rate,
   * track_stock) y no pasa por `toLiteProductPayload`: esa función traduce
   * nombres en español (categoria/descripcion/iva) pensados para el
   * formulario clásico y renombraría/perdería campos ya nativos del contrato.
   */
  createVariante(payload: any) {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para crear la variante.'));
    const url = `${this.apiUrl}${API_ENDPOINT.FacturadaLite}.create_producto`;
    return this.http.post(url, { ...payload, business }, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
    }).pipe(map((res: any) => this.fromLiteProduct(frappeData<any>(res))));
  }

  updateVariante(name: string, payload: any) {
    const business = this.activeBusiness();
    if (!business) return throwError(() => new Error('Selecciona un negocio para editar la variante.'));
    return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.update_producto`, { name, ...payload, business }, {
      context: new HttpContext().set(REQUIRE_AUTH, true),
    }).pipe(map((res: any) => this.fromLiteProduct(frappeData<any>(res))));
  }

  private toLiteProductPayload(data: any, isCreate = false): any {
    const payload = { ...(data || {}) };
    payload.tipo = payload.tipo || 'Producto';
    payload.unidad = payload.unidad ?? payload.unidad_inventario ?? 'Unidad';
    // El contrato Lite utiliza los nombres de API en inglés. Conservamos los
    // aliases del formulario para no romper el modo restaurante.
    payload.category = payload.category ?? payload.categoria ?? '';
    payload.description = payload.description ?? payload.descripcion ?? '';
    payload.iva = this.parseTaxRate(payload.iva ?? payload.tax_value ?? payload.tax ?? 0);
    payload.track_stock = payload.track_stock ?? payload.maneja_stock ?? payload.controlar_inventario ?? 0;
    payload.minimum_stock = Number(payload.minimum_stock ?? payload.stock_minimo ?? 0) || 0;
    // La existencia actual solo cambia mediante create_stock_movement.
    if (isCreate) payload.current_stock = 0;

    if (payload.isactive !== undefined && payload.status === undefined) {
      payload.status = payload.isactive === true || payload.isactive === 1 || payload.isactive === '1' ? 'Activo' : 'Inactivo';
    }

    delete payload.tax;
    delete payload.tax_id;
    delete payload.tax_value;
    delete payload.categoria;
    delete payload.descripcion;
    delete payload.isactive;
    delete payload.controlar_inventario;
    delete payload.unidad_inventario;
    delete payload.stock_actual;
    if (!isCreate) delete payload.current_stock;
    delete payload.stock_inicial;
    delete payload.stock_objetivo;
    delete payload.stock_ajuste;
    delete payload.stock_minimo;
    delete payload.permitir_stock_negativo;
    delete payload.is_out_of_stock;

    return payload;
  }

  private fromLiteProduct(product: any): any {
    if (!product || typeof product !== 'object') return product;
    const status = String(product.status || '').toLowerCase();
    const taxValue = Number(product.tax_value ?? product.iva ?? product.tax_rate ?? 0) || 0;
    const stock = Number(product.stock_actual ?? product.current_stock ?? product.stock ?? 0) || 0;
    const managesStock = product.track_stock ?? product.controlar_inventario ?? product.maneja_stock ?? product.manage_stock ?? product.manages_stock;
    const minimumStock = Number(product.minimum_stock ?? product.stock_minimo ?? product.min_stock ?? 0) || 0;

    const image = product.image ?? product.imagen ?? '';
    const imageUrl = this.resolveImageUrl(product.image_url || image);
    return {
      ...product,
      nombre: product.nombre ?? product.item_name ?? product.name,
      descripcion: product.descripcion ?? product.description ?? '',
      category: product.category ?? product.categoria ?? '',
      categoria: product.categoria ?? product.category ?? '',
      precio: Number(product.precio ?? product.standard_rate ?? product.rate ?? product.price ?? 0) || 0,
      tax_value: taxValue,
      tax: product.tax ?? product.tax_id ?? (taxValue ? `IVA-${taxValue}` : null),
      codigo: product.codigo ?? product.item_code ?? product.name,
      isactive: product.isactive ?? (status ? status === 'activo' : true),
      controlar_inventario: managesStock,
      track_stock: managesStock,
      unidad_inventario: product.unidad_inventario ?? product.unidad ?? product.stock_uom ?? 'und',
      stock_minimo: minimumStock,
      minimum_stock: minimumStock,
      stock_actual: stock,
      current_stock: product.current_stock ?? stock,
      stock: product.stock ?? stock,
      is_out_of_stock: product.is_out_of_stock ?? (managesStock ? stock <= 0 : false),
      is_low_stock: product.is_low_stock ?? (managesStock ? stock <= minimumStock : false),
      variant_count: Number(product.variant_count ?? 0) || 0,
      image,
      image_url: imageUrl
    };
  }

  private resolveImageUrl(value: unknown): string {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw;
    const base = String(environment.URL || '').replace(/\/$/, '');
    return raw.startsWith('/') ? `${base}${raw}` : `${base}/${raw}`;
  }

  private parseTaxRate(value: any): number {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const direct = Number(value);
    if (Number.isFinite(direct)) return direct;
    const match = String(value || '').match(/\d+(\.\d+)?/);
    return match ? Number(match[0]) : 0;
  }

  private activeBusiness(): string | undefined {
    return this.capabilities.activeBusinessId
      || this.capabilities.businessId
      || localStorage.getItem('active_business')
      || localStorage.getItem('businessId')
      || undefined;
  }

  private withLiteBusiness(params: HttpParams): HttpParams {
    const business = this.activeBusiness();
    return business ? params.set('business', business) : params;
  }
}
