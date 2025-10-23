import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { NgxSpinnerService } from 'ngx-spinner';
import { EcuadorTimePipe } from '../../core/pipes/ecuador-time-pipe.pipe';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { Router, RouterModule } from '@angular/router';
import { InvoicesService } from 'src/app/services/invoices.service';
import { PrintService } from 'src/app/services/print.service';
import { environment } from 'src/environments/environment';
import { toast } from 'ngx-sonner';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxPaginationModule, EcuadorTimePipe, ButtonComponent,RouterModule],
  templateUrl: './invoices.component.html',
  styleUrls: ['./invoices.component.css']
})
export class InvoicesComponent implements OnInit {
  invoices: any[] = [];
  invoicesFiltradas: any[] = [];
  page = 1;
  pageSize = 10;
  total = 0;
  totalPages = 1;

  _search = '';
  conOrdenFiltro: '' | 'con' | 'sin' = ''; // filtro por enlace a orden

  mostrarModal = false;
  invoiceSelected: any | null = null;
  activeTab: 'info' | 'sri' | 'items' = 'info';

  private url = environment.URL; // si usas URL (como en orders); si usas apiUrl para imprimir, ajusta

  constructor(
    private svc: InvoicesService,           // o InvoicesService
    private spinner: NgxSpinnerService,
    private router: Router,
    private printService: PrintService
  ) {}
  ngOnInit(): void {
    this.loadInvoices();
  }

  loadInvoices(): void {
    this.spinner.show();
    const offset = (this.page - 1) * this.pageSize;
    this.svc.getAllInvoices(this.pageSize, offset).subscribe({
      next: (res: any) => {
        const msg = res.message || res; // depende de tu proxy
        this.invoices = msg.data || [];
        this.total = msg.total || 0;
        this.totalPages = Math.ceil(this.total / this.pageSize) || 1;
        this.aplicarFiltros();
        this.spinner.hide();
      },
      error: (err: any) => {
        this.spinner.hide();
        console.error('Error al cargar facturas:', err);
      }
    });
  }

  get search(): string { return this._search; }
  set search(v: string) {
    this._search = v || '';
    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    const term = (this._search || '').toLowerCase();
    let lista = Array.isArray(this.invoices) ? [...this.invoices] : [];

    lista = lista.filter(inv => {
      const byText = [
        inv?.name,
        inv?.sri?.number,
        inv?.sri?.access_key,
        inv?.customer?.fullName,
        inv?.customer?.num_identificacion,
        inv?.sri?.status
      ].map(x => (x ?? '').toString().toLowerCase()).some(x => x.includes(term));

      const hasOrder = !!inv?.order;
      const byOrden =
        this.conOrdenFiltro === '' ? true :
        this.conOrdenFiltro === 'con' ? hasOrder :
        !hasOrder;

      return byText && byOrden;
    });

    this.invoicesFiltradas = lista;
  }

  limpiarFiltros(): void {
    this._search = '';
    this.conOrdenFiltro = '';
    this.aplicarFiltros();
  }

  nextPage(): void { if (this.page < this.totalPages) { this.page++; this.loadInvoices(); } }
  prevPage(): void { if (this.page > 1) { this.page--; this.loadInvoices(); } }

 // Abrir/Cerrar modal
  openInvoiceDetail(inv: any) {
    this.invoiceSelected = inv || null;
    this.activeTab = 'info';
    this.mostrarModal = true;
  }
  closeModal() { this.mostrarModal = false; }

  // PDF de factura (usa tu PrintService)
  getFacturaPdf() {
    if (!this.invoiceSelected?.sri?.invoice) {
      toast.error('Factura no disponible');
      return;
    }
    const url = this.url + this.printService.getFacturaPdf(this.invoiceSelected.sri.invoice);
    const w = window.open(url, '_blank');
    if (!w) toast.error('No se pudo abrir la ventana de impresión');
  }

  // Reenviar/Regenerar factura (opcional, si tienes endpoint)
  reenviarFactura() {
    // TODO: reemplaza por tu servicio real si lo tienes
    toast.info('Implementa el servicio para reenviar/regenerar la factura');
    // p.ej:
    // this.spinner.show();
    // this.svc.reenviarFactura(this.invoiceSelected.name).subscribe({
    //   next: () => { this.spinner.hide(); toast.success('Factura reenviada'); this.loadInvoices(); this.closeModal(); },
    //   error: () => { this.spinner.hide(); toast.error('No se pudo reenviar'); }
    // });
  }

  irAOrden(orderName: string) {
    if (!orderName) return;
    this.router.navigate(['/orders'], { queryParams: { id: orderName } });
  }
}
