import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { EcuadorTimePipe } from 'src/app/core/pipes/ecuador-time-pipe.pipe';
import { PrintService } from 'src/app/services/print.service';
import { environment } from 'src/environments/environment';
import { toast } from 'ngx-sonner';
import { InvoicesService } from 'src/app/services/invoices.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-order-detail-page',
  standalone: true,
  imports: [CommonModule, RouterModule, EcuadorTimePipe,RouterModule,FontAwesomeModule],
  templateUrl: './order-detail-page.component.html'
})
export class OrderDetailPageComponent implements OnInit {
  loading = true;
  error = '';
  order: any | null = null;
  activeTab: 'info' | 'sri' | 'items' = 'info';

  private baseUrl = environment.URL; // ajusta si usas otra key

  constructor(
    private route: ActivatedRoute,
    private ordersSvc: InvoicesService,
    private printSvc: PrintService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.fetch(id);
  }

  fetch(id: string) {
    this.loading = true; this.error = ''; this.order = null;
    this.ordersSvc.getOrderDetail(id).subscribe({
      next: (res: any) => {
        this.order = (res?.message?.data || res?.data);
        this.loading = false;
        if (!this.order) this.error = 'Orden no encontrada';
      },
      error: (err) => {
        this.loading = false;
        this.error = 'No se pudo cargar la orden';
        console.error(err);
      }
    });
  }

  // Acciones
  getComandaPdf() {
    const url = this.baseUrl + this.printSvc.getComandaPdf(this.order.name);
    const w = window.open(url, '_blank'); if (!w) toast.error('No se pudo abrir la impresión');
  }
  getNotaVentaPdf() {
    const url = this.baseUrl + this.printSvc.getNotaVentaPdf(this.order.name);
    const w = window.open(url, '_blank'); if (!w) toast.error('No se pudo abrir la impresión');
  }
  getFacturaPdf(): void {
    const inv = this.order?.sri?.invoice;
    if (!inv) {
      toast.error('Factura no disponible');
      return;
    }
    const url = this.baseUrl + this.printSvc.getFacturaPdf(inv);
    const w = window.open(url, '_blank'); if (!w) toast.error('No se pudo abrir la impresión');
  }

  
  reenviarFactura() {
    // si ya tienes endpoint en OrdersService:
    // this.ordersSvc.validar_y_generar_factura(this.order.name)...
    toast.info('Conecta aquí tu servicio para reenviar/regenerar la factura');
  }

  get sriStatus(): string {
    const st = this.order?.sri?.status;
    return st === 'AUTORIZADO' ? 'AUTORIZADO' :
           st === 'Rejected' ? 'Rechazada' :
           st === 'Error' ? 'Error' :
           st === 'Queued' ? 'En cola' :
           st === 'Processing' ? 'En proceso' :
           st === 'Draft' ? 'Borrador' :
           (st || 'Sin factura');
  }

  goBack() {
  // si hay historial, vuelve; si no, navega a la lista
  if (window.history.length > 2) {
    history.back();
  } else {
    this.router.navigate(['/orders']);
  }
}
goToInvoice(invName?: string) {
  if (!invName) return;
  this.router.navigate(['/invoices', invName]);
}


facturarDesdeOrden(order:any){
  console.log('facturarDesdeOrden', order);
this.router.navigate(['/dashboard/invoicing', order.name]);

}


}
