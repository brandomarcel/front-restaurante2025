import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { NgxSpinnerComponent, NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { Subscription, catchError, finalize, forkJoin, of } from 'rxjs';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { LiteEmissionResult, liteEmissionMessages } from 'src/app/core/utils/lite-invoice-emission';
import { DecimalInputDirective } from 'src/app/shared/directives/decimal-input.directive';
import { SupplierPickerComponent } from 'src/app/shared/components/supplier-picker/supplier-picker.component';
import { isoLocalDate } from 'src/app/shared/utils/date-presets';
import { WITHHOLDING_DAYS_LIMIT, daysBetween, round2 } from 'src/app/core/utils/withholding';
import { LiteSupplier } from 'src/app/services/lite-suppliers.service';
import {
  AccessKeyLookup, IncomeConcept, WithholdingInput, WithholdingSetup, WithholdingTaxType, WithholdingsService
} from 'src/app/services/withholdings.service';

const ACCESS_KEY_LENGTH = 49;
const DOCUMENT_NUMBER = /^\d{3}-\d{3}-\d{9}$/;
const RENTA_CODE = /^[A-Z0-9]{3,5}$/;
/** Documento sustento «Liquidación de compra» (SRI 03): su clave lleva el RUC del propio negocio, no el del proveedor. */
const SETTLEMENT_DOC_CODE = '03';
/** Concepto de renta que se propone sobre una liquidación de compra (su % sale del catálogo `income_concepts`). */
const SETTLEMENT_RENTA_CODE = '311';

/** Clave de acceso o autorización del sustento: vacía, o 10, 37 o 49 dígitos. */
function authorizationValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value || '').trim();
    if (!value) return null;
    return /^\d+$/.test(value) && [10, 37, 49].includes(value.length) ? null : { autorizacionInvalida: true };
  };
}

function notFutureValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value || '').slice(0, 10);
    return value && value > isoLocalDate(new Date()) ? { fechaFutura: true } : null;
  };
}

/** Renta pide código de concepto (3 a 5 letras o números); IVA lo pone el backend. */
function retentionRowValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    if (group.get('tax_type')?.value !== 'Renta') return null;
    const code = String(group.get('codigo_retencion')?.value || '').trim().toUpperCase();
    if (!code) return { codigoRequerido: true };
    return RENTA_CODE.test(code) ? null : { codigoInvalido: true };
  };
}

/**
 * Comprobante de retención (SRI 07): lo que el negocio le retiene a un proveedor sobre una factura que recibió.
 * Mismo flujo que la guía de remisión (borrador → emitir). Los totales que se ven aquí son solo una guía: el
 * backend recalcula IVA y valores retenidos.
 */
@Component({
  selector: 'app-withholding-form',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, NgxSpinnerComponent, DecimalInputDirective, SupplierPickerComponent],
  templateUrl: './withholding-form.component.html'
})
export class WithholdingFormComponent implements OnInit {
  @ViewChild(SupplierPickerComponent) supplierPicker?: SupplierPickerComponent;

  readonly daysLimit = WITHHOLDING_DAYS_LIMIT;
  form: FormGroup;
  withholdingName = '';
  /** `?liquidacion=<name>`: la retención nueva se arma sobre esa liquidación de compra autorizada. */
  settlementSource = '';
  supplier: LiteSupplier | null = null;

  setup: WithholdingSetup | null = null;
  setupLoading = true;
  setupError = '';

  submitting = false;
  submitted = false;

  /** Lectura de la clave de acceso de la factura del proveedor. */
  keyLookupLoading = false;
  keyWarnings: string[] = [];
  keyNotice = '';
  /** RUC leído de la clave: avisa si el proveedor elegido es otro. */
  keyRuc = '';
  private lastLookedUpKey = '';
  private keyLookup?: Subscription;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private svc: WithholdingsService,
    private spinner: NgxSpinnerService,
    private frappeError: FrappeErrorService,
    public capabilities: CompanyCapabilitiesService,
    destroyRef: DestroyRef
  ) {
    this.form = this.fb.group({
      establishment: ['', Validators.required],
      emission_point: ['', Validators.required],
      environment: [this.defaultEnvironment(), Validators.required],
      num_aut_doc_sustento: ['', authorizationValidator()],
      cod_sustento: ['01', Validators.required],
      cod_doc_sustento: ['01', Validators.required],
      num_doc_sustento: ['', [Validators.required, Validators.pattern(DOCUMENT_NUMBER)]],
      fecha_emision_doc_sustento: ['', [Validators.required, notFutureValidator()]],
      forma_pago: ['20', Validators.required],
      taxes: this.fb.array([this.createTaxRow()]),
      retentions: this.fb.array([]),
      notes: ['', Validators.maxLength(300)]
    });

    const keySub = this.form.get('num_aut_doc_sustento')!.valueChanges.subscribe(value => this.onAccessKeyChange(value));
    // Las bases que el usuario no tocó siguen a la factura (renta = subtotal, IVA = IVA de la factura).
    const formSub = this.form.valueChanges.subscribe(() => this.syncDefaultBases());
    destroyRef.onDestroy(() => { keySub.unsubscribe(); formSub.unsubscribe(); this.keyLookup?.unsubscribe(); });
  }

  ngOnInit(): void {
    this.withholdingName = this.route.snapshot.paramMap.get('id') || '';
    this.settlementSource = this.withholdingName ? '' : (this.route.snapshot.queryParamMap?.get('liquidacion') || '').trim();
    this.load();
    if (!this.withholdingName) this.autoSelectLocation();
  }

  get isEditMode(): boolean { return !!this.withholdingName; }
  get taxes(): FormArray { return this.form.get('taxes') as FormArray; }
  get retentions(): FormArray { return this.form.get('retentions') as FormArray; }

  get establishmentOptions(): any[] { return this.capabilities.activeEstablishments; }

  get emissionPointOptions(): any[] {
    const establishment = this.form?.get('establishment')?.value;
    return establishment ? this.capabilities.activeEmissionPointsFor(establishment) : [];
  }

  /** La retención tiene su propio consecutivo (SRI 07) por establecimiento, punto y ambiente. */
  get hasActiveSequence(): boolean {
    const value = this.form?.getRawValue();
    if (!value?.establishment || !value?.emission_point) return false;
    return this.capabilities.hasActiveSequence('Comprobante de Retencion', value.establishment, value.emission_point, value.environment);
  }

  get isWithholdingAgent(): boolean { return this.setup?.withholding_agent === true; }
  get blockMessage(): string { return String(this.setup?.block_message || '').trim(); }
  get canEditTaxProfile(): boolean { return this.capabilities.hasPermission('business.settings.manage'); }

  // ---------- Carga ----------

  load(): void {
    this.setupLoading = true;
    this.setupError = '';
    this.spinner.show();
    forkJoin({
      setup: this.svc.getSetup(),
      detail: this.withholdingName ? this.svc.getDetail(this.withholdingName) : of(null),
      // Si la liquidación no se puede leer, el formulario abre vacío con un aviso.
      settlement: this.settlementSource
        ? this.svc.getPurchaseSettlement(this.settlementSource).pipe(catchError(err => {
          toast.error(this.frappeError.handle(err) || 'No se pudo leer la liquidación de compra.');
          return of(null);
        }))
        : of(null)
    }).pipe(finalize(() => { this.spinner.hide(); this.setupLoading = false; })).subscribe({
      next: ({ setup, detail, settlement }) => {
        this.setup = this.normalizeSetup(setup);
        if (settlement) {
          this.patchFromSettlement(settlement);
        } else if (detail) {
          if (String(detail?.status || '').trim().toUpperCase() !== 'BORRADOR') {
            toast.error('Solo se pueden editar retenciones en borrador.');
            this.router.navigate(['/dashboard/withholdings', this.withholdingName]);
            return;
          }
          this.patchFromDetail(detail);
        } else {
          this.applySetupDefaults();
        }
      },
      error: err => {
        this.setupError = this.frappeError.handle(err) || 'No se pudo cargar la configuración de retenciones.';
      }
    });
  }

  private normalizeSetup(setup: any): WithholdingSetup {
    const list = (value: any) => Array.isArray(value) ? value : [];
    return {
      withholding_agent: setup?.withholding_agent === true || setup?.withholding_agent === 1,
      block_message: setup?.block_message || null,
      support_codes: list(setup?.support_codes),
      document_types: list(setup?.document_types),
      tax_codes: list(setup?.tax_codes).map((item: any) => ({ ...item, code: String(item?.code ?? ''), rate: Number(item?.rate) || 0 })),
      vat_withholding_rates: list(setup?.vat_withholding_rates).map(Number).filter(Number.isFinite),
      payment_methods: list(setup?.payment_methods),
      income_concepts: list(setup?.income_concepts).map((item: any) => ({
        code: String(item?.code ?? '').toUpperCase(), form_103: String(item?.form_103 ?? ''), label: String(item?.label ?? ''),
        percentage: Number(item?.percentage) || 0, variable: item?.variable === true || item?.variable === 1
      }))
    };
  }

  /** Primera fila de la factura: IVA 15 % (código 4 del SRI) si existe. */
  private get defaultTaxCode(): string {
    const codes = this.setup?.tax_codes || [];
    return (codes.find(item => item.code === '4') || codes.find(item => item.rate === 15) || codes[0])?.code || '';
  }

  private applySetupDefaults(): void {
    const defaultCode = this.defaultTaxCode;
    this.taxes.controls.forEach(row => {
      if (!row.get('tax_code')?.value && defaultCode) row.get('tax_code')?.setValue(defaultCode);
    });
    if (!this.retentions.length) this.addRetention('Renta');
  }

  /** Preselecciona el primer establecimiento/punto con secuencia de retención activa; si no hay, el principal. */
  private autoSelectLocation(): void {
    if (this.form.value.establishment) return;
    const environment = this.form.value.environment;
    for (const establishment of this.establishmentOptions) {
      const establishmentId = this.recordId(establishment);
      const point = this.capabilities.activeEmissionPointsFor(establishmentId)
        .find((item: any) => this.capabilities.hasActiveSequence('Comprobante de Retencion', establishmentId, this.recordId(item), environment));
      if (point) {
        this.form.patchValue({ establishment: establishmentId, emission_point: this.recordId(point) });
        return;
      }
    }
    const main = this.establishmentOptions.find((item: any) => item?.is_main) || (this.establishmentOptions.length === 1 ? this.establishmentOptions[0] : null);
    if (!main) return;
    this.form.patchValue({ establishment: this.recordId(main) });
    const points = this.emissionPointOptions;
    const point = points.find((item: any) => item?.is_default) || (points.length === 1 ? points[0] : null);
    if (point) this.form.patchValue({ emission_point: this.recordId(point) });
  }

  private patchFromDetail(detail: any): void {
    const support = detail?.support || {};
    this.supplier = detail?.supplier?.name ? detail.supplier : null;
    this.lastLookedUpKey = String(support?.num_aut_doc_sustento || '');
    this.form.patchValue({
      establishment: detail?.establishment || '',
      emission_point: detail?.emission_point || '',
      environment: detail?.environment || this.defaultEnvironment(),
      num_aut_doc_sustento: support?.num_aut_doc_sustento || '',
      cod_sustento: support?.cod_sustento || '01',
      cod_doc_sustento: support?.cod_doc_sustento || '01',
      num_doc_sustento: support?.num_doc_sustento || '',
      fecha_emision_doc_sustento: String(support?.fecha_emision_doc_sustento || '').slice(0, 10),
      forma_pago: support?.forma_pago || '20',
      notes: detail?.notes || ''
    }, { emitEvent: false });

    const taxes = Array.isArray(support?.taxes) ? support.taxes : [];
    this.form.setControl('taxes', this.fb.array(taxes.length
      ? taxes.map((tax: any) => this.createTaxRow(String(tax?.tax_code ?? ''), Number(tax?.base_imponible) || 0))
      : [this.createTaxRow(this.defaultTaxCode)]), { emitEvent: false });

    const retentions = Array.isArray(detail?.retentions) ? detail.retentions : [];
    this.form.setControl('retentions', this.fb.array(retentions.map((row: any) => {
      const group = this.createRetentionRow(row?.tax_type === 'IVA' ? 'IVA' : 'Renta', Number(row?.base_imponible) || 0);
      // 0 % es un porcentaje válido (332 y rendimientos exentos): solo un valor vacío o no numérico queda sin porcentaje.
      const savedPercent = row?.porcentaje === null || row?.porcentaje === undefined || row?.porcentaje === ''
        ? NaN : Number(row.porcentaje);
      group.patchValue({ codigo_retencion: row?.codigo_retencion || '',
        porcentaje: Number.isFinite(savedPercent) ? savedPercent : null });
      // Una base guardada es decisión del usuario: no se recalcula sola.
      group.get('base_imponible')?.markAsDirty();
      return group;
    })), { emitEvent: false });
  }

  /**
   * Retención sobre una liquidación de compra autorizada: sustento 03 con su número, fecha y clave, el proveedor de la
   * liquidación, las bases por tarifa y las retenciones de siempre (renta 311 sobre la base y 100 % del IVA).
   */
  private patchFromSettlement(settlement: any): void {
    const status = String(settlement?.status || '').trim().toUpperCase();
    const electronic = settlement?.electronic || {};
    if (!['AUTORIZADA', 'AUTORIZADO'].includes(status) || !electronic?.document_number) {
      this.applySetupDefaults();
      this.keyWarnings = [status === 'ANULADA'
        ? 'La liquidación de compra está anulada en el SRI: no se puede retener sobre ella.'
        : 'La liquidación de compra todavía no está autorizada: emítela antes de crear su retención.'];
      return;
    }
    if (this.setup && !this.setup.document_types.some(item => item.code === SETTLEMENT_DOC_CODE)) {
      this.setup.document_types = [...this.setup.document_types, { code: SETTLEMENT_DOC_CODE, label: 'Liquidación de compra' }];
    }
    const accessKey = String(electronic?.access_key || '').trim();
    const paymentMethod = String(settlement?.forma_pago || '');
    // La clave ya se conoce: no se vuelve a leer (su RUC es el del negocio, no el del proveedor).
    this.lastLookedUpKey = accessKey;
    this.supplier = settlement?.supplier?.name ? settlement.supplier : null;
    // Mismo sustento que la compra que la contabilidad crea de la liquidación (facturada_erpnext.lite_documents):
    // 01 si tiene IVA (crédito tributario), 02 si no; así el comprobante y el ATS dicen lo mismo.
    const settlementIva = round2(Number(settlement?.total_iva) || 0);
    const support = settlementIva > 0 ? '01' : '02';
    this.form.patchValue({
      cod_doc_sustento: SETTLEMENT_DOC_CODE,
      ...(this.setup?.support_codes.some(item => String(item?.code) === support) ? { cod_sustento: support } : {}),
      num_doc_sustento: String(electronic.document_number),
      fecha_emision_doc_sustento: String(settlement?.posting_date || '').slice(0, 10),
      num_aut_doc_sustento: accessKey,
      ...(paymentMethod && this.setup?.payment_methods.some(item => item.code === paymentMethod) ? { forma_pago: paymentMethod } : {})
    }, { emitEvent: false });

    const taxes = (Array.isArray(settlement?.taxes) ? settlement.taxes : [])
      .filter((tax: any) => String(tax?.tax_code ?? '') !== '');
    this.form.setControl('taxes', this.fb.array(taxes.length
      ? taxes.map((tax: any) => this.createTaxRow(String(tax.tax_code), round2(Number(tax?.base_imponible) || 0)))
      : [this.createTaxRow(this.defaultTaxCode)]), { emitEvent: false });

    const retentions: FormGroup[] = [];
    const subtotal = round2(Number(settlement?.total_sin_impuestos) || 0);
    if (subtotal > 0) {
      const renta = this.createRetentionRow('Renta', subtotal);
      // El código pone su porcentaje vigente del catálogo (hoy 3 %).
      renta.get('codigo_retencion')?.setValue(SETTLEMENT_RENTA_CODE);
      retentions.push(renta);
    }
    if (settlementIva > 0) {
      const ivaRow = this.createRetentionRow('IVA', settlementIva);
      ivaRow.get('porcentaje')?.setValue(100);
      retentions.push(ivaRow);
    }
    this.form.setControl('retentions', this.fb.array(retentions), { emitEvent: false });
    this.keyNotice = `Datos de la liquidación de compra ${electronic.document_number} ya puestos. Revisa los porcentajes con tu contador.`;
  }

  // ---------- Filas ----------

  createTaxRow(taxCode = '', base: number | null = null): FormGroup {
    return this.fb.group({
      tax_code: [taxCode, Validators.required],
      base_imponible: [base, [Validators.required, Validators.min(0)]]
    });
  }

  createRetentionRow(type: WithholdingTaxType, base: number): FormGroup {
    // 0 % es válido: hay conceptos de renta sin retención (332 y rendimientos exentos).
    const group = this.fb.group({
      tax_type: [type],
      codigo_retencion: [''],
      porcentaje: [null as number | null, [Validators.required, Validators.min(0), Validators.max(100)]],
      base_imponible: [base, [Validators.required, Validators.min(0.01)]]
    }, { validators: retentionRowValidator() });
    // Al elegir un concepto del catálogo se pone su porcentaje vigente.
    group.get('codigo_retencion')?.valueChanges.subscribe(code => {
      const concept = this.incomeConcept(code);
      if (concept && group.get('tax_type')?.value === 'Renta' && Number(group.get('porcentaje')?.value) !== concept.percentage) {
        group.get('porcentaje')?.setValue(concept.percentage);
      }
    });
    return group;
  }

  incomeConcept(code: unknown): IncomeConcept | undefined {
    const value = String(code ?? '').trim().toUpperCase();
    return value ? this.setup?.income_concepts?.find(item => item.code === value) : undefined;
  }

  /** Porcentaje vigente si el de la fila no coincide con el del catálogo (y el concepto no es variable). */
  conceptMismatch(row: AbstractControl): IncomeConcept | null {
    if (row.get('tax_type')?.value !== 'Renta') return null;
    const concept = this.incomeConcept(row.get('codigo_retencion')?.value);
    const value = row.get('porcentaje')?.value;
    if (!concept || concept.variable || value === null || value === '') return null;
    return Math.abs(Number(value) - concept.percentage) > 0.001 ? concept : null;
  }

  addTax(): void {
    this.taxes.push(this.createTaxRow(this.defaultTaxCode));
  }

  removeTax(index: number): void {
    if (this.taxes.length <= 1) return;
    this.taxes.removeAt(index);
  }

  addRetention(type: WithholdingTaxType): void {
    this.retentions.push(this.createRetentionRow(type, this.defaultBaseFor(type)));
  }

  removeRetention(index: number): void {
    this.retentions.removeAt(index);
  }

  private defaultBaseFor(type: WithholdingTaxType): number {
    return type === 'IVA' ? this.totalIva : this.subtotal;
  }

  private syncDefaultBases(): void {
    this.retentions.controls.forEach(row => {
      const base = row.get('base_imponible');
      if (!base || base.dirty) return;
      const expected = this.defaultBaseFor(row.get('tax_type')?.value);
      if (Number(base.value) !== expected) base.setValue(expected, { emitEvent: false });
    });
  }

  // ---------- Cálculos (solo para mostrar; el backend recalcula) ----------

  taxRate(code: unknown): number {
    return this.setup?.tax_codes.find(item => item.code === String(code ?? ''))?.rate ?? 0;
  }

  taxRowIva(row: AbstractControl): number {
    return round2((Number(row.get('base_imponible')?.value) || 0) * this.taxRate(row.get('tax_code')?.value) / 100);
  }

  get subtotal(): number {
    return round2(this.taxes.controls.reduce((sum, row) => sum + (Number(row.get('base_imponible')?.value) || 0), 0));
  }

  get totalIva(): number {
    return round2(this.taxes.controls.reduce((sum, row) => sum + this.taxRowIva(row), 0));
  }

  get invoiceTotal(): number { return round2(this.subtotal + this.totalIva); }

  retentionValue(row: AbstractControl): number {
    return round2((Number(row.get('base_imponible')?.value) || 0) * (Number(row.get('porcentaje')?.value) || 0) / 100);
  }

  private retentionSum(type: WithholdingTaxType, field: 'value' | 'base'): number {
    return round2(this.retentions.controls
      .filter(row => row.get('tax_type')?.value === type)
      .reduce((sum, row) => sum + (field === 'value' ? this.retentionValue(row) : Number(row.get('base_imponible')?.value) || 0), 0));
  }

  get totalRenta(): number { return this.retentionSum('Renta', 'value'); }
  get totalIvaRetenido(): number { return this.retentionSum('IVA', 'value'); }
  get totalRetenido(): number { return round2(this.totalRenta + this.totalIvaRetenido); }

  /** Días desde la factura del proveedor hasta hoy (la retención se emite con la fecha de hoy). */
  get daysSinceSupport(): number | null {
    return daysBetween(this.form.get('fecha_emision_doc_sustento')?.value, isoLocalDate(new Date()));
  }

  get isLate(): boolean {
    const days = this.daysSinceSupport;
    return days !== null && days > WITHHOLDING_DAYS_LIMIT;
  }

  /**
   * El proveedor elegido no es el emisor de la clave de acceso. No aplica a una liquidación de compra (03): su clave
   * la emite el propio negocio (el backend tampoco lo valida).
   */
  get supplierMismatch(): boolean {
    if (this.form.get('cod_doc_sustento')?.value === SETTLEMENT_DOC_CODE) return false;
    return !!this.keyRuc && !!this.supplier && String(this.supplier.identification || '').trim() !== this.keyRuc;
  }

  // ---------- Clave de acceso ----------

  private onAccessKeyChange(raw: unknown): void {
    const value = String(raw ?? '');
    const digits = value.replace(/\D/g, '');
    // Al pegar suelen venir espacios o guiones: se quitan para que la clave quede limpia.
    if (digits !== value && /^[\d\s.-]+$/.test(value)) {
      this.form.get('num_aut_doc_sustento')?.setValue(digits, { emitEvent: false });
    }
    if (digits.length !== ACCESS_KEY_LENGTH) {
      this.keyLookup?.unsubscribe();
      this.keyLookupLoading = false;
      if (!digits) { this.keyWarnings = []; this.keyNotice = ''; this.keyRuc = ''; }
      return;
    }
    if (digits === this.lastLookedUpKey) return;
    this.lookupAccessKey(digits);
  }

  lookupAccessKey(accessKey: string): void {
    this.keyLookup?.unsubscribe();
    this.lastLookedUpKey = accessKey;
    this.keyWarnings = [];
    this.keyNotice = '';
    this.keyLookupLoading = true;
    this.keyLookup = this.svc.lookupAccessKey(accessKey).pipe(finalize(() => this.keyLookupLoading = false)).subscribe({
      next: result => this.applyLookup(result),
      error: err => {
        this.lastLookedUpKey = '';
        this.keyWarnings = [this.frappeError.handle(err) || 'No se pudo leer la clave de acceso. Puedes llenar los datos a mano.'];
      }
    });
  }

  private applyLookup(result: AccessKeyLookup): void {
    if (!result?.valid) {
      this.keyRuc = '';
      this.keyWarnings = [result?.message || 'Esta clave de acceso no es válida. Revisa los 49 dígitos.'];
      return;
    }
    const warnings: string[] = [];
    if (result.test_environment) {
      warnings.push('Esta clave es de una factura de pruebas del SRI: no sirve como sustento de una retención real.');
    }
    if (result.message) warnings.push(result.message);
    this.keyWarnings = warnings;
    this.keyRuc = String(result.ruc || '').trim();

    this.form.patchValue({
      ...(result.document_type ? { cod_doc_sustento: result.document_type } : {}),
      ...(result.number ? { num_doc_sustento: result.number } : {}),
      ...(result.issue_date ? { fecha_emision_doc_sustento: String(result.issue_date).slice(0, 10) } : {})
    });

    // Liquidación de compra: el RUC de la clave es el del propio negocio; el proveedor se elige aparte.
    if (result.document_type === SETTLEMENT_DOC_CODE) {
      this.keyRuc = '';
      this.keyNotice = 'Es una liquidación de compra tuya: elige el proveedor a quien le compraste.';
      return;
    }

    if (result.supplier?.name) {
      this.supplierPicker?.cancelNew();
      if (this.supplier?.name !== result.supplier.name) {
        this.supplier = result.supplier;
        this.keyNotice = `Proveedor elegido por el RUC de la clave: ${result.supplier.supplier_name}.`;
      } else {
        this.keyNotice = 'Datos de la factura completados desde la clave de acceso.';
      }
      return;
    }
    if (this.keyRuc && String(this.supplier?.identification || '').trim() === this.keyRuc) return;
    // El RUC no está entre los proveedores: se abre el alta con el RUC ya puesto.
    this.supplier = null;
    this.keyNotice = this.keyRuc
      ? `El RUC ${this.keyRuc} todavía no está entre tus proveedores: completa su nombre y guárdalo.`
      : 'Datos de la factura completados desde la clave de acceso.';
    if (this.keyRuc) {
      // El selector se vuelve a dibujar al quitar el proveedor; se abre el alta en el siguiente ciclo.
      setTimeout(() => this.supplierPicker?.openNew({ identification: this.keyRuc, identification_type: '04' }));
    }
  }

  onSupplierChange(supplier: LiteSupplier | null): void {
    this.supplier = supplier;
  }

  onEstablishmentChange(): void {
    this.form.patchValue({ emission_point: '' });
    if (this.emissionPointOptions.length === 1) {
      this.form.patchValue({ emission_point: this.recordId(this.emissionPointOptions[0]) });
    }
  }

  // ---------- Validación ----------

  /** Lista de lo que falta, con las reglas del backend adelantadas (el backend decide). */
  get validationSummary(): string[] {
    if (!this.submitted) return [];
    const errors: string[] = [];
    const get = (name: string) => this.form.get(name);

    if (!this.supplier) errors.push('Elige el proveedor o regístralo.');
    if (get('num_aut_doc_sustento')?.invalid) errors.push('La clave de acceso o autorización debe tener 49, 37 o 10 dígitos.');
    if (get('cod_sustento')?.invalid) errors.push('Elige el sustento tributario.');
    if (get('cod_doc_sustento')?.invalid) errors.push('Elige el tipo de documento del proveedor.');
    if (get('num_doc_sustento')?.errors?.['required']) errors.push('Escribe el número de la factura del proveedor.');
    else if (get('num_doc_sustento')?.errors?.['pattern']) errors.push('El número de la factura va así: 001-001-000000123.');
    if (get('fecha_emision_doc_sustento')?.errors?.['required']) errors.push('Escribe la fecha de la factura del proveedor.');
    else if (get('fecha_emision_doc_sustento')?.errors?.['fechaFutura']) errors.push('La fecha de la factura del proveedor no puede ser posterior a hoy.');
    if (get('forma_pago')?.invalid) errors.push('Elige la forma de pago.');

    this.taxes.controls.forEach((row, index) => {
      if (row.get('tax_code')?.invalid) errors.push(`Valores de la factura, fila ${index + 1}: elige la tarifa.`);
      if (row.get('base_imponible')?.invalid) errors.push(`Valores de la factura, fila ${index + 1}: escribe la base (0 o más).`);
    });
    if (this.subtotal <= 0) errors.push('Escribe el valor de la factura del proveedor (sin IVA).');

    if (!this.retentions.length) errors.push('Agrega al menos una retención.');
    const rates = this.setup?.vat_withholding_rates || [];
    this.retentions.controls.forEach((row, index) => {
      const label = `Retención ${index + 1} (${row.get('tax_type')?.value})`;
      if (row.errors?.['codigoRequerido']) errors.push(`${label}: escribe el código del concepto (por ejemplo 312).`);
      else if (row.errors?.['codigoInvalido']) errors.push(`${label}: el código tiene de 3 a 5 letras o números.`);
      if (row.get('porcentaje')?.invalid) errors.push(`${label}: escribe el porcentaje.`);
      const concept = this.conceptMismatch(row);
      if (concept) errors.push(`${label}: el código ${concept.code} se retiene al ${concept.percentage} % (porcentaje vigente del SRI).`);
      else if (row.get('tax_type')?.value === 'IVA' && rates.length && !rates.includes(Number(row.get('porcentaje')?.value))) {
        errors.push(`${label}: el porcentaje debe ser ${rates.join(', ')} %.`);
      }
      if (row.get('base_imponible')?.invalid) errors.push(`${label}: la base debe ser mayor que 0.`);
    });
    if (this.retentionSum('IVA', 'base') > this.totalIva + 0.005) {
      errors.push('La base de las retenciones de IVA no puede superar el IVA de la factura.');
    }
    if (this.retentionSum('Renta', 'base') > this.subtotal + 0.005) {
      errors.push('La base de las retenciones de renta no puede superar el valor sin IVA de la factura.');
    }

    if (get('notes')?.invalid) errors.push('La nota admite hasta 300 caracteres.');
    if (get('establishment')?.invalid) errors.push('Elige el establecimiento.');
    if (get('emission_point')?.invalid) errors.push('Elige el punto de emisión.');
    return errors;
  }

  private validate(): boolean {
    this.submitted = true;
    this.form.markAllAsTouched();
    const errors = this.validationSummary;
    if (errors.length) {
      toast.error(errors[0]);
      return false;
    }
    return true;
  }

  private buildPayload(): WithholdingInput {
    const value = this.form.getRawValue();
    const authorization = String(value.num_aut_doc_sustento || '').trim();
    const notes = String(value.notes || '').trim();
    return {
      ...(this.withholdingName ? { name: this.withholdingName } : {}),
      establishment: value.establishment,
      emission_point: value.emission_point,
      environment: value.environment,
      supplier: String(this.supplier?.name || ''),
      support: {
        cod_sustento: value.cod_sustento,
        cod_doc_sustento: value.cod_doc_sustento,
        num_doc_sustento: String(value.num_doc_sustento || '').trim(),
        fecha_emision_doc_sustento: value.fecha_emision_doc_sustento,
        ...(authorization ? { num_aut_doc_sustento: authorization } : {}),
        forma_pago: value.forma_pago,
        taxes: (value.taxes || []).map((tax: any) => ({
          tax_code: String(tax.tax_code),
          base_imponible: round2(Number(tax.base_imponible) || 0)
        }))
      },
      retentions: (value.retentions || []).map((row: any) => ({
        tax_type: row.tax_type,
        ...(row.tax_type === 'Renta' ? { codigo_retencion: String(row.codigo_retencion || '').trim().toUpperCase() } : {}),
        base_imponible: round2(Number(row.base_imponible) || 0),
        porcentaje: Number(row.porcentaje) || 0
      })),
      ...(notes ? { notes } : {})
    };
  }

  // ---------- Acciones ----------

  get canSaveDraft(): boolean {
    return this.isWithholdingAgent && !this.submitting && this.capabilities.hasPermission('billing.create');
  }

  get canEmit(): boolean {
    return this.canSaveDraft && !this.blockMessage;
  }

  guardarBorrador(): void {
    if (!this.capabilities.hasPermission('billing.create')) {
      toast.error('No tienes permisos para crear retenciones.');
      return;
    }
    if (!this.isWithholdingAgent || !this.validate()) return;
    this.submitting = true;
    this.spinner.show();
    this.svc.saveDraft(this.buildPayload()).pipe(finalize(() => { this.spinner.hide(); this.submitting = false; })).subscribe({
      next: (data: any) => {
        toast.success('Borrador guardado.');
        const name = String(data?.name || this.withholdingName || '').trim();
        this.router.navigate(name ? ['/dashboard/withholdings', name] : ['/dashboard/withholdings']);
      },
      error: err => toast.error(this.frappeError.handle(err) || 'No se pudo guardar la retención.')
    });
  }

  emitir(): void {
    if (!this.capabilities.hasPermission('billing.create')) {
      toast.error('No tienes permisos para emitir retenciones.');
      return;
    }
    if (this.blockMessage) {
      toast.error(this.blockMessage);
      return;
    }
    if (!this.isWithholdingAgent || !this.validate()) return;
    if (!this.hasActiveSequence) {
      toast.error('Falta la secuencia de Retención para este establecimiento, punto de emisión y ambiente. Créala en Configuración ▸ Secuencias.');
      return;
    }
    // Mismo control de emisión que facturas y guías (permiso, plan, firma, configuración y cupo).
    const blockMessage = this.capabilities.getEmissionBlockMessage({ feature: 'billing' });
    if (blockMessage) {
      toast.error(blockMessage);
      return;
    }
    this.submitting = true;
    this.spinner.show();
    const payload = this.buildPayload();
    const done = () => finalize<LiteEmissionResult>(() => { this.spinner.hide(); this.submitting = false; });

    if (this.isEditMode) {
      // Primero se guardan los cambios del borrador y solo entonces se emite (nunca se reintenta solo).
      this.svc.saveDraft(payload).subscribe({
        next: () => this.svc.emitDraft(this.withholdingName).pipe(done()).subscribe({
          next: res => this.handleEmitResult(res, this.withholdingName),
          error: err => toast.error(this.frappeError.handle(err) || 'No se pudo emitir la retención.')
        }),
        error: err => {
          this.spinner.hide();
          this.submitting = false;
          toast.error(this.frappeError.handle(err) || 'No se pudo guardar la retención.');
        }
      });
    } else {
      this.svc.createAndEmit(payload).pipe(done()).subscribe({
        next: res => this.handleEmitResult(res, res?.invoiceName || res?.data?.name),
        error: err => toast.error(this.frappeError.handle(err) || 'No se pudo emitir la retención.')
      });
    }
  }

  private handleEmitResult(res: any, fallbackName?: string): void {
    const messages = [...liteEmissionMessages(res?.emission), ...liteEmissionMessages(res?.data)].filter(Boolean);
    const state = String(res?.state || '').toUpperCase();
    const name = String(res?.data?.name || fallbackName || this.withholdingName || '').trim();
    if (['ERROR', 'PROVIDER_ERROR', 'REJECTED'].includes(state)) {
      toast.error(messages[0] || 'La retención no fue autorizada.');
    } else {
      toast.success(messages[0] || 'Retención emitida.');
    }
    this.router.navigate(name ? ['/dashboard/withholdings', name] : ['/dashboard/withholdings']);
  }

  cancelar(): void {
    this.router.navigate(this.withholdingName ? ['/dashboard/withholdings', this.withholdingName] : ['/dashboard/withholdings']);
  }

  trackByIndex = (index: number) => index;

  private recordId(record: any): string {
    return String(record?.name ?? '').trim();
  }

  private defaultEnvironment(): 'Pruebas' | 'Produccion' {
    const value = String(
      this.capabilities.business?.environment || this.capabilities.business?.ambiente || ''
    ).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
    return value.includes('PROD') ? 'Produccion' : 'Pruebas';
  }
}
