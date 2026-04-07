import { Injectable } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { Supplier, SupplierPayload } from '../models/supplier';

@Injectable({ providedIn: 'root' })
export class SuppliersService {
  private readonly storageKey = 'facturada.suppliers.mock.v1';
  private readonly requestDelay = 120;

  getAll(isactive?: number): Observable<{ message: { data: Supplier[] } }> {
    const suppliers = this.filterByStatus(this.load(), isactive);
    return of({ message: { data: suppliers } }).pipe(delay(this.requestDelay));
  }

  create(data: SupplierPayload): Observable<{ message: Supplier }> {
    const suppliers = this.load();
    const supplier = this.normalizeSupplier({
      ...data,
      name: this.nextName(suppliers),
      codigo: data.codigo?.trim() || this.nextCode(suppliers),
      isactive: data.isactive ?? true,
    });

    const next = [supplier, ...suppliers];
    this.save(next);
    return of({ message: supplier }).pipe(delay(this.requestDelay));
  }

  update(data: SupplierPayload & { name: string }): Observable<{ message: Supplier }> {
    const suppliers = this.load();
    const index = suppliers.findIndex((item) => item.name === data.name);
    const current = index >= 0 ? suppliers[index] : null;

    const updated = this.normalizeSupplier({
      ...current,
      ...data,
      name: data.name,
      codigo: data.codigo?.trim() || current?.codigo || this.nextCode(suppliers),
    });

    const next = index >= 0
      ? suppliers.map((item) => item.name === data.name ? updated : item)
      : [updated, ...suppliers];

    this.save(next);
    return of({ message: updated }).pipe(delay(this.requestDelay));
  }

  delete(name: string): Observable<{ message: { name: string } }> {
    const next = this.load().filter((item) => item.name !== name);
    this.save(next);
    return of({ message: { name } }).pipe(delay(this.requestDelay));
  }

  private load(): Supplier[] {
    if (typeof localStorage === 'undefined') {
      return this.seedData();
    }

    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      const seed = this.seedData();
      this.save(seed);
      return seed;
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((item) => this.normalizeSupplier(item)) : this.seedData();
    } catch {
      return this.seedData();
    }
  }

  private save(suppliers: Supplier[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.storageKey, JSON.stringify(suppliers));
  }

  private filterByStatus(suppliers: Supplier[], isactive?: number): Supplier[] {
    const list = suppliers.map((item) => ({ ...item }));
    if (isactive === undefined || isactive === null) {
      return list;
    }

    const active = isactive === 1;
    return list.filter((item) => !!item.isactive === active);
  }

  private normalizeSupplier(data: SupplierPayload): Supplier {
    return {
      name: (data.name || '').trim(),
      codigo: (data.codigo || '').trim().toUpperCase(),
      razon_social: (data.razon_social || '').trim().toUpperCase(),
      nombre_comercial: (data.nombre_comercial || '').trim().toUpperCase(),
      tipo_identificacion: data.tipo_identificacion || '04 - RUC',
      num_identificacion: (data.num_identificacion || '').trim(),
      contacto_principal: (data.contacto_principal || '').trim(),
      correo: (data.correo || '').trim().toLowerCase(),
      telefono: (data.telefono || '').trim(),
      direccion: (data.direccion || '').trim().toUpperCase(),
      dias_credito: Number(data.dias_credito || 0),
      observacion: (data.observacion || '').trim(),
      isactive: !!data.isactive,
    };
  }

  private nextName(suppliers: Supplier[]): string {
    return `SUP-${String(suppliers.length + 1).padStart(3, '0')}`;
  }

  private nextCode(suppliers: Supplier[]): string {
    return `PRV-${String(suppliers.length + 1).padStart(3, '0')}`;
  }

  private seedData(): Supplier[] {
    return [
      this.normalizeSupplier({
        name: 'SUP-001',
        codigo: 'PRV-001',
        razon_social: 'DISTRIBUIDORA COSTA MAR',
        nombre_comercial: 'COSTA MAR INSUMOS',
        tipo_identificacion: '04 - RUC',
        num_identificacion: '0993254789001',
        contacto_principal: 'Andrea Zambrano',
        correo: 'compras@costamar.ec',
        telefono: '0987654321',
        direccion: 'Av. Principal 123, Guayaquil',
        dias_credito: 15,
        observacion: 'Proveedor frecuente de mariscos y congelados.',
        isactive: true,
      }),
      this.normalizeSupplier({
        name: 'SUP-002',
        codigo: 'PRV-002',
        razon_social: 'LACTEOS SIERRA FRESCA',
        nombre_comercial: 'SIERRA FRESCA',
        tipo_identificacion: '04 - RUC',
        num_identificacion: '1792045678001',
        contacto_principal: 'Carlos Mena',
        correo: 'ventas@sierrafresca.ec',
        telefono: '0991122334',
        direccion: 'Parque industrial norte, Quito',
        dias_credito: 8,
        observacion: 'Entrega productos refrigerados en horario matutino.',
        isactive: true,
      }),
      this.normalizeSupplier({
        name: 'SUP-003',
        codigo: 'PRV-003',
        razon_social: 'INSUMOS DEL CHEF S.A.',
        nombre_comercial: 'CHEF MARKET',
        tipo_identificacion: '04 - RUC',
        num_identificacion: '1792987654001',
        contacto_principal: 'Lucia Herrera',
        correo: 'atencion@chefmarket.ec',
        telefono: '0977001100',
        direccion: 'Km 6 via Daule, Bodega 4',
        dias_credito: 0,
        observacion: 'Compras varias de secos, empaques y desechables.',
        isactive: false,
      }),
    ];
  }
}
