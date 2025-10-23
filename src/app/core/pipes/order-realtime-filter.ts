// src/app/shared/pipes/order-realtime-filter.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { OrderVM } from 'src/app/services/realtime-orders.service';

@Pipe({ name: 'orderRealtimeFilter', standalone: true })
export class OrderRealtimeFilterPipe implements PipeTransform {
  transform(rows: OrderVM[], term = '', tipo = ''): OrderVM[] {
    if (!rows) return [];
    const t = term.trim().toLowerCase();
    const byTerm = t
      ? rows.filter(o => {
          const c = (o?.customer && (typeof o.customer === 'string'
                  ? o.customer
                  : (o.customer['nombre']))) || '';
          return (
            o.name?.toString().toLowerCase().includes(t) ||
            c?.toLowerCase().includes(t)
          );
        })
      : rows;
    return tipo ? byTerm.filter(o => (o.type || '').toLowerCase() === tipo.toLowerCase()) : byTerm;
  }
}
