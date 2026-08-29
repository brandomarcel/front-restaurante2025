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
import { AdditionalFieldPayload, normalizeAdditionalFields } from 'src/app/core/models/additional-field';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { roundMoney } from 'src/app/shared/utils/payment.utils';

@Component({
  selector: 'app-invoice-detail-page',
  standalone: true,
  imports: [CommonModule, RouterModule, EcuadorTimePipe, FontAwesomeModule, ReactiveFormsModule, NgxSpinnerComponent],
  templateUrl: './invoice-detail-page.component.html'
})
export class InvoiceDetailPageComponent implements OnInit {
  invoice: any = null;
  additionalFields: AdditionalFieldPayload[] = [];
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
    private capabilities: CompanyCapabilitiesService,
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
        if (this.invoice && !Array.isArray(this.invoice.payments)) {
          this.invoice.payments = res?.message?.payments || res?.message?.doc?.payments || res?.payments || [];
        }
        this.additionalFields = normalizeAdditionalFields(
          this.invoice?.additionalFields ??
          this.invoice?.additional_fields ??
          res?.message?.additionalFields ??
          res?.message?.additional_fields
        );
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
        this.motivosAnulacion = res?.message || [];

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
    const planBlockMessage = this.capabilities.getPlanBlockMessage('direct_invoice');
    if (planBlockMessage) {
      toast.error(planBlockMessage);
      return;
    }

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
    const planBlockMessage = this.capabilities.getPlanBlockMessage('credit_note');
    if (planBlockMessage) {
      toast.error(planBlockMessage);
      return;
    }

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

  get invoiceItems(): any[] {
    return Array.isArray(this.invoice?.items) ? this.invoice.items : [];
  }

  get invoiceNumber(): string {
    return this.invoice?.sri?.number || this.invoice?.name || '—';
  }

  get invoiceStatusRaw(): string {
    return String(this.invoice?.sri?.status || this.invoice?.status || '').trim();
  }

  get canAnnul(): boolean {
    return this.invoiceStatusRaw === 'AUTORIZADO' && this.capabilities.validateFeatureUse('credit_note').allowed;
  }

  get canResend(): boolean {
    return !!this.invoice && this.invoiceStatusRaw !== 'AUTORIZADO' && this.capabilities.validateFeatureUse('direct_invoice').allowed;
  }

  get canSeeAdditionalFields(): boolean {
    return this.capabilities.isEnabled('additional_fields');
  }

  get invoicePayments(): any[] {
    const rawPayments =
      this.invoice?.payments ??
      this.invoice?.doc?.payments ??
      this.invoice?.sales_invoice?.payments ??
      [];

    if (!Array.isArray(rawPayments)) return [];

    return rawPayments
      .map((payment: any) => ({
        payment_method: String(
          payment?.payment_method ||
          payment?.formas_de_pago ||
          payment?.method ||
          payment?.name ||
          ''
        ).trim(),
        forma_pago: String(payment?.forma_pago || payment?.codigo || '').trim(),
        monto: roundMoney(payment?.monto ?? payment?.amount ?? payment?.paid_amount)
      }))
      .filter((payment: any) => payment.payment_method || payment.forma_pago || payment.monto > 0);
  }

  itemSubtotal(item: any): number {
    const quantity = Number(item?.quantity || 0);
    const price = Number(item?.price || 0);
    return Number(item?.subtotal ?? (quantity * price));
  }

  itemTotal(item: any): number {
    const subtotal = this.itemSubtotal(item);
    const taxRate = Number(item?.tax_rate || 0);
    return Number(item?.total ?? (subtotal + (subtotal * (taxRate / 100))));
  }

  get sriStatus(): string {
    return this.getSriStatusLabel(this.invoiceStatusRaw);
  }

  getSriStatusLabel(status: string | undefined | null): string {
    const value = String(status || '').trim();
    if (value === 'AUTORIZADO') return 'AUTORIZADO';
    if (value === 'Rejected') return 'Rechazada';
    if (value === 'Error' || value === 'ERROR') return 'Error';
    if (value === 'Queued') return 'En cola';
    if (value === 'Processing') return 'En proceso';
    if (value === 'Draft') return 'Borrador';
    return value || '—';
  }

  getSriStatusBadge(status: string | undefined | null): string {
    const value = String(status || '').trim();
    if (value === 'AUTORIZADO') return 'badge-green';
    if (value === 'Rejected' || value === 'Error' || value === 'ERROR' || value === 'ANULADA') return 'badge-red';
    return 'badge-yellow';
  }
}
