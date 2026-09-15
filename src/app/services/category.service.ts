import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { API_ENDPOINT } from '../core/constants/api.constants';
import { REQUIRE_AUTH } from '../core/interceptor/auth-context';
import { map, throwError } from 'rxjs';
import { CompanyCapabilitiesService } from '../core/services/company-capabilities.service';
import { frappeData, frappeList } from '../core/utils/frappe-response';

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly apiUrl = environment.apiUrl; // Cambia si usás otro backend

  constructor(private http: HttpClient, private capabilities: CompanyCapabilitiesService) {}


  getAll(isactive?: number, limit?: number, offset = 0, search = '', status?: string) {
    const business = this.getLiteBusiness();
    if (!business) return throwError(() => new Error('No hay un negocio seleccionado.'));

    let params = new HttpParams().set('business', business);
    if (isactive !== undefined && isactive !== null) {
      params = params.set('isactive', String(isactive));
    }
    if (limit !== undefined) {
      params = params.set('limit', String(limit)).set('offset', String(offset));
    }
    if (search.trim()) params = params.set('search', search.trim());
    if (status) params = params.set('status', status);

    return this.http.get(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_categorias`, {
      params,
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(map((response: any) => {
      const message = response?.message ?? response ?? {};
      const rawData = message?.data;
      const rows = (Array.isArray(rawData)
        ? rawData
        : (Array.isArray(rawData?.data) ? rawData.data : frappeList<any>(response)))
        .map((category:any) => this.fromLiteCategory(category));
      if (limit === undefined) return rows;
      const totalValue = Number(message?.total ?? message?.total_count ?? message?.count ?? rawData?.total ?? response?.total);
      const total = Number.isFinite(totalValue) && totalValue >= 0 ? totalValue : rows.length;
      const hasNext = message?.has_next ?? message?.hasNext ?? (offset + rows.length < total);
      return {
        ...response,
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

  create(data: any) {
    if (!this.canManageLiteCategories()) return throwError(() => new Error('No tienes permiso para crear categorías.'));
    const business = this.getLiteBusiness();
    if (!business) return throwError(() => new Error('No hay un negocio seleccionado.'));
    return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.create_categoria`, {
      ...this.toLitePayload(data),
      business
    }, { context: new HttpContext().set(REQUIRE_AUTH, true) }).pipe(
      map((response: any) => this.fromLiteCategory(frappeData<any>(response)))
    );
  }

  getByName(name: string) {
    return throwError(() => new Error('La consulta individual de categorías no está disponible.'));
  }

  update(name: string, data: any) {
    if (!this.canManageLiteCategories()) return throwError(() => new Error('No tienes permiso para editar categorías.'));
    const business = this.getLiteBusiness();
    if (!business) return throwError(() => new Error('No hay un negocio seleccionado.'));
    return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.update_categoria`, {
      ...this.toLitePayload(data),
      name,
      business
    }, { context: new HttpContext().set(REQUIRE_AUTH, true) }).pipe(
      map((response: any) => this.fromLiteCategory(frappeData<any>(response)))
    );
  }

  delete(name: string) {
    if (!this.canManageLiteCategories()) return throwError(() => new Error('No tienes permiso para desactivar categorías.'));
    const business = this.getLiteBusiness();
    if (!business) return throwError(() => new Error('No hay un negocio seleccionado.'));
    // El endpoint Lite desactiva la categoría; no se elimina físicamente.
    return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.delete_categoria`, { name, business }, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    }).pipe(map((response: any) => frappeData<any>(response)));
  }

  private getLiteBusiness(): string {
    return String(this.capabilities.activeBusinessId || this.capabilities.businessId || localStorage.getItem('active_business') || localStorage.getItem('businessId') || '').trim();
  }

  private canManageLiteCategories(): boolean {
    return this.capabilities.isEnabled('products');
  }

  private toLitePayload(data: any): any {
    const value = data || {};
    const categoryName = String(value.category_name ?? value.nombre ?? '').trim();
    const description = String(value.description ?? value.descripcion ?? '').trim();
    const active = value.isactive ?? value.isActive ?? (value.status ? String(value.status).toLowerCase() === 'activo' : true);
    return {
      category_name: categoryName,
      nombre: categoryName,
      description,
      descripcion: description,
      status: active === true || active === 1 || active === '1' ? 'Activo' : 'Inactivo',
      isactive: active === true || active === 1 || active === '1' ? 1 : 0
    };
  }

  private fromLiteCategory(category: any): any {
    if (!category || typeof category !== 'object') return category;
    const label = category.category_name ?? category.nombre ?? '';
    const rawActive = category.isactive;
    const active = rawActive === undefined || rawActive === null
      ? String(category.status || '').toLowerCase() === 'activo'
      : rawActive === true || rawActive === 1 || rawActive === '1';
    return {
      ...category,
      category_name: label,
      nombre: category.nombre ?? label,
      description: category.description ?? category.descripcion ?? '',
      descripcion: category.descripcion ?? category.description ?? '',
      isactive: active ? 1 : 0
    };
  }

}
