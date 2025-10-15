import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { EcuadorTimePipe } from 'src/app/core/pipes/ecuador-time-pipe.pipe';
import { InvoicesService } from 'src/app/services/invoices.service';
import { environment } from 'src/environments/environment';
import { toast } from 'ngx-sonner';
import { PrintService } from 'src/app/services/print.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { CreditNoteService } from 'src/app/services/credit-note.service';
@Component({
  selector: 'app-credit-note-detail-page',
  standalone: true,
  imports: [CommonModule,
    RouterModule,
    // EcuadorTimePipe,
    FontAwesomeModule],
  templateUrl: './credit-note-detail-page.component.html',
  styleUrl: './credit-note-detail-page.component.css'
})
export class CreditNoteDetailPageComponent implements OnInit {
  invoice: any = null;
  loading = true;
  error = '';

  private baseUrl = environment.URL;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private invoicesSvc: CreditNoteService,
    private printSvc: PrintService,
  ) { }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.fetch(id);
  }

  fetch(id: string) {
    this.loading = true; this.error = '';
    this.invoicesSvc.getCreditNoteDetail(id).subscribe({

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
      toast.error('Nota de Credito no disponible');
      return;
    }
    const url = this.baseUrl + this.printSvc.getCreditNotePdf(inv);
    const w = window.open(url, '_blank'); if (!w) toast.error('No se pudo abrir la impresión');
  }

  // reenviarFactura() {
  //   this.invoicesSvc.emit_existing_invoice_v2(this.invoice.name).subscribe({
  //     next: (res: any) => {
  //       console.log('emit_existing_invoice_v2:', res);
  //       const id = this.route.snapshot.paramMap.get('id')!;
  //       this.fetch(id);

  //       this.loading = false;

  //     },
  //     error: (err) => {
  //       this.loading = false;
  //       this.error = 'No se pudo cargar la factura';
  //       console.error(err);
  //     }
  //   });
  // }

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
