// src/app/pages/invoice-detail-page/invoice-detail-page.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { EcuadorTimePipe } from 'src/app/core/pipes/ecuador-time-pipe.pipe';
import { InvoicesService } from 'src/app/services/invoices.service';
import { environment } from 'src/environments/environment';
import { toast } from 'ngx-sonner';
import { PrintService } from 'src/app/services/print.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-invoice-detail-page',
  standalone: true,
  imports: [CommonModule, RouterModule, EcuadorTimePipe,FontAwesomeModule],
  templateUrl: './invoice-detail-page.component.html'
})
export class InvoiceDetailPageComponent implements OnInit {
  invoice: any = null;
  loading = true;
  error = '';

  private baseUrl = environment.URL;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private invoicesSvc: InvoicesService,
    private printSvc: PrintService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.fetch(id);
  }

  fetch(id: string) {
    this.loading = true; this.error = '';
    this.invoicesSvc.getInvoiceDetail(id).subscribe({
      next: (res: any) => {
      console.log('Factura cargada:', res);
        this.invoice = res?.message?.data || res?.data || null;
        this.loading = false;
        if (!this.invoice) this.error = 'Factura no encontrada';
      },
      error: (err) => {
        this.loading = false;
        this.error = 'No se pudo cargar la factura';
        console.error(err);
      }
    });
  }

  goBack() {
    if (history.length > 2) history.back();
    else this.router.navigate(['/dashboard/invoices']);
  }

    getFacturaPdf(): void {
    const inv = this.invoice?.sri?.invoice;
    if (!inv) {
      toast.error('Factura no disponible');
      return;
    }
    const url = this.baseUrl + this.printSvc.getFacturaPdf(inv);
    const w = window.open(url, '_blank'); if (!w) toast.error('No se pudo abrir la impresión');
  }

  get sriStatus(): string {
    const st = this.invoice?.sri?.status;
    return st === 'AUTORIZADO' ? 'AUTORIZADO' :
           st === 'Rejected' ? 'Rechazada' :
           st === 'Error' ? 'Error' :
           st === 'Queued' ? 'En cola' :
           st === 'Processing' ? 'En proceso' :
           st === 'Draft' ? 'Borrador' : (st || '—');
  }
}
