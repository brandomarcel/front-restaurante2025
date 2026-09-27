import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { ProductsService } from 'src/app/services/products.service';
import { BarcodeScanInputComponent } from 'src/app/shared/components/barcode-scan-input/barcode-scan-input.component';

interface StockLookupRow {
  item: string;
  codigo: string;
  nombre: string;
  stockByWarehouse: Record<string, number>;
  total: number;
}

@Component({
  selector: 'app-stock-lookup',
  standalone: true,
  imports: [CommonModule, FormsModule, BarcodeScanInputComponent],
  templateUrl: './stock-lookup.component.html'
})
export class StockLookupComponent {
  search = '';
  loading = false;
  searched = false;
  rows: StockLookupRow[] = [];

  constructor(
    private readonly productsService: ProductsService,
    public readonly capabilities: CompanyCapabilitiesService
  ) {}

  get isWarehouseMode(): boolean {
    return this.capabilities.isWarehouseMode;
  }

  get warehouses(): any[] {
    return this.capabilities.activeWarehouses;
  }

  warehouseLabel(warehouse: any): string {
    return warehouse?.warehouse_name || warehouse?.name || '—';
  }

  /** El scanner solo entrega el código leído (modo "emit"); la búsqueda multi-bodega es siempre la misma, ya sea tipeada o escaneada. */
  onScan(code: string): void {
    this.search = code;
    this.buscar();
  }

  buscar(): void {
    const term = this.search.trim();
    if (!term || !this.warehouses.length) {
      this.rows = [];
      this.searched = false;
      return;
    }

    this.loading = true;
    this.searched = true;

    // Una consulta por bodega: `get_productos` siempre devuelve el stock de
    // la bodega que se le indique, nunca "todas a la vez" (mismo principio
    // que el resto de Inventario). Se combinan los resultados por producto.
    const requests = this.warehouses.reduce((acc: Record<string, any>, warehouse: any) => {
      const warehouseId = String(warehouse?.name || '');
      if (!warehouseId) return acc;
      acc[warehouseId] = this.productsService.getAll(1, 50, 0, term, undefined, undefined, false, true, warehouseId).pipe(
        catchError(() => of([]))
      );
      return acc;
    }, {});

    forkJoin(requests).pipe(
      finalize(() => this.loading = false)
    ).subscribe((resultsByWarehouse: Record<string, any>) => {
      const rowsByItem = new Map<string, StockLookupRow>();
      Object.entries(resultsByWarehouse).forEach(([warehouseId, result]: [string, any]) => {
        const list = Array.isArray(result) ? result : (result?.message?.data || []);
        list.forEach((product: any) => {
          const key = String(product?.name || product?.codigo || '');
          if (!key) return;
          const stock = Number(product?.stock_actual ?? product?.current_stock ?? 0) || 0;
          const row: StockLookupRow = rowsByItem.get(key) || {
            item: key,
            codigo: product?.codigo || '',
            nombre: product?.nombre || product?.name || key,
            stockByWarehouse: {},
            total: 0
          };
          row.stockByWarehouse[warehouseId] = stock;
          rowsByItem.set(key, row);
        });
      });
      this.rows = Array.from(rowsByItem.values())
        .map((row) => ({ ...row, total: Object.values(row.stockByWarehouse).reduce((sum, value) => sum + value, 0) }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre));
    });
  }

  stockFor(row: StockLookupRow, warehouse: any): number {
    return row.stockByWarehouse[String(warehouse?.name || '')] ?? 0;
  }

  limpiar(): void {
    this.search = '';
    this.rows = [];
    this.searched = false;
  }
}
