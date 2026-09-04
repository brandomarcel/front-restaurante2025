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

  private urlBase: string = '';
  constructor(private http: HttpClient, private capabilities: CompanyCapabilitiesService) { 
        this.urlBase = this.apiUrl + API_ENDPOINT.Categoria;
  }


  getAll(isactive?: number) {
    if (this.capabilities.isLiteMode) {
      const business = this.getLiteBusiness();
      if (!business) return throwError(() => new Error('No hay un negocio Lite seleccionado.'));

      let params = new HttpParams().set('business', business);
      if (isactive !== undefined && isactive !== null) {
        params = params.set('isactive', String(isactive));
      }

      return this.http.get(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.get_categorias`, {
        params,
        context: new HttpContext().set(REQUIRE_AUTH, true)
      }).pipe(map((response: any) => frappeList<any>(response).map((category) => this.fromLiteCategory(category))));
    }

    let params = new HttpParams();

    if (isactive !== undefined && isactive !== null) {
      params = params.set('isactive', isactive.toString());
    }

    return this.http.get(`${this.urlBase}.get_categorias`, {
      params,
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  create(data: any) {
    if (this.capabilities.isLiteMode) {
      if (!this.canManageLiteCategories()) return throwError(() => new Error('No tienes permiso products.manage para crear categorías.'));
      const business = this.getLiteBusiness();
      if (!business) return throwError(() => new Error('No hay un negocio Lite seleccionado.'));
      return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.create_categoria`, {
        ...this.toLitePayload(data),
        business
      }, { context: new HttpContext().set(REQUIRE_AUTH, true) }).pipe(
        map((response: any) => this.fromLiteCategory(frappeData<any>(response)))
      );
    }

    return this.http.post(`${environment.apiUrl}/resource/categorias`, data, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  getByName(name: string) {
    if (this.capabilities.isLiteMode) {
      return throwError(() => new Error('La consulta individual de categorías no está disponible en Lite.'));
    }

    return this.http.get(`${environment.apiUrl}/resource/categorias/${name}`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  update(name: string, data: any) {
    if (this.capabilities.isLiteMode) {
      if (!this.canManageLiteCategories()) return throwError(() => new Error('No tienes permiso products.manage para editar categorías.'));
      const business = this.getLiteBusiness();
      if (!business) return throwError(() => new Error('No hay un negocio Lite seleccionado.'));
      return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.update_categoria`, {
        ...this.toLitePayload(data),
        name,
        business
      }, { context: new HttpContext().set(REQUIRE_AUTH, true) }).pipe(
        map((response: any) => this.fromLiteCategory(frappeData<any>(response)))
      );
    }

    return this.http.put(`${environment.apiUrl}/resource/categorias/${name}`, data, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
  }

  delete(name: string) {
    if (this.capabilities.isLiteMode) {
      if (!this.canManageLiteCategories()) return throwError(() => new Error('No tienes permiso products.manage para desactivar categorías.'));
      const business = this.getLiteBusiness();
      if (!business) return throwError(() => new Error('No hay un negocio Lite seleccionado.'));
      // El endpoint Lite desactiva la categoría; no se elimina físicamente.
      return this.http.post(`${this.apiUrl}${API_ENDPOINT.FacturadaLite}.delete_categoria`, { name, business }, {
        context: new HttpContext().set(REQUIRE_AUTH, true)
      }).pipe(map((response: any) => frappeData<any>(response)));
    }

    return this.http.delete(`${environment.apiUrl}/resource/categorias/${name}`, {
      context: new HttpContext().set(REQUIRE_AUTH, true)
    });
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
