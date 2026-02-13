import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule, Router } from '@angular/router';
import { EcuadorTimePipe } from 'src/app/core/pipes/ecuador-time-pipe.pipe';
import { InvoicesService } from 'src/app/services/invoices.service';
import { environment } from 'src/environments/environment';
import { toast } from 'ngx-sonner';
import { PrintService } from 'src/app/services/print.service';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { UtilsGlobalService } from 'src/app/services/utils-global.service';
import { firstValueFrom, lastValueFrom } from 'rxjs';
import { AlertService } from 'src/app/core/services/alert.service';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CreditNoteService } from 'src/app/services/credit-note.service';
import { NgxSpinnerComponent, NgxSpinnerService } from 'ngx-spinner';

@Component({
  selector: 'app-invoice-detail-page',
  standalone: true,
  imports: [CommonModule, RouterModule, EcuadorTimePipe, FontAwesomeModule, ReactiveFormsModule, NgxSpinnerComponent],
  templateUrl: './invoice-detail-page.component.html'
})
export class InvoiceDetailPageComponent implements OnInit {
  invoice: any = null;
  motivosAnulacion: any[] = [];
  showMotivoModal = false;
  motivoForm: FormGroup;

  private baseUrl = environment.URL;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private invoicesSvc: InvoicesService,
    private printSvc: PrintService,
    private utilsGlobalSvc: UtilsGlobalService,
    private alertSvc: AlertService,
    private fb: FormBuilder,
    private creditNoteSvc: CreditNoteService,
    private spinner: NgxSpinnerService,
  ) {
    this.motivoForm = this.fb.group({
      motivo: ['', Validators.required],
      otroTexto: [''] // se valida dinámicamente si elige "Otro"
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.fetch(id);
    this.getMotivosAnulacion();

  }

  fetch(id: string) {
    this.spinner.show();
    this.invoicesSvc.getInvoiceDetail(id).subscribe({
      next: (res: any) => {
        console.log('Factura cargada:', res);
        this.invoice = res?.message?.data || res?.data || null;
        this.spinner.hide();
      },
      error: (err) => {
this.spinner.hide();
        console.error(err);
      }
    });
  }

  getMotivosAnulacion() {

    this.utilsGlobalSvc.getMotivosAnulacion().subscribe({
      next: (res: any) => {
        console.log('Motivos cargada:', res);
        this.motivosAnulacion = res?.message || null;

      },
      error: (err) => {


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

  reenviarFactura() {
    this.spinner.show();
    this.invoicesSvc.emit_existing_invoice_v2(this.invoice.name).subscribe({
      next: (res: any) => {
        console.log('emit_existing_invoice_v2:', res);
        toast.success('Factura reenviada');
        const id = this.route.snapshot.paramMap.get('id')!;
        this.fetch(id);

        this.spinner.hide();
      },
      error: (err) => {
        this.spinner.hide();

        console.error(err);
      },
      complete: () => {
        this.spinner.hide();
      }
    });
  }



  // abrir/cerrar
  openMotivo() {
    this.showMotivoModal = true;
    // reset limpio cada vez que se abre
    this.motivoForm.reset({ motivo: '', otroTexto: '' });
  }
  closeMotivo() { this.showMotivoModal = false; }

  // si cambia selección, activa/desactiva validación del campo "otro"
  onMotivoChange() {
    const otroCtrl = this.motivoForm.get('otroTexto')!;
    if (this.motivoForm.value.motivo === 'Otro') {
      otroCtrl.addValidators([Validators.required, Validators.minLength(2)]);
    } else {
      otroCtrl.clearValidators();
      otroCtrl.setValue('');
    }
    otroCtrl.updateValueAndValidity({ emitEvent: false });
  }

  // Confirmar
  onConfirmMotivo() {
    if (this.motivoForm.invalid) {
      this.motivoForm.markAllAsTouched();
      return;
    }

    const { motivo, otroTexto } = this.motivoForm.value;
    // Úsalo como necesites en tu payload:
    const motivoSeleccionado = motivo === 'Otro' ? (otroTexto || '').trim() : motivo;
    console.log('Motivo seleccionado:', motivoSeleccionado);
    console.log('Otro texto:', otroTexto);

    this.anularFactura(motivoSeleccionado);

  }


  async anularFactura(motivo: string) {
    this.spinner.show();

    try {
      const res: any = await lastValueFrom(
        this.creditNoteSvc.emit_credit_note_v2(this.invoice.name, motivo)
      );

      console.log('emit_credit_note_v2:', res);

      toast.success('Nota de crédito creada');

      const id = this.route.snapshot.paramMap.get('id')!;
      this.fetch(id);
      this.closeMotivo();

    } catch (err: any) {
      toast.error(err || 'Error al anular factura');
      this.closeMotivo();

    } finally {
      this.spinner.hide(); // siempre se ejecuta, éxito o error
    }
  }

  // Cerrar con ESC
  @HostListener('document:keydown.escape')
  onEsc() { if (this.showMotivoModal) this.closeMotivo(); }

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
