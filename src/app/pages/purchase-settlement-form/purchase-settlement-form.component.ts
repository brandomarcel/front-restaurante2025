import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { NgxSpinnerComponent, NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { finalize, forkJoin, of } from 'rxjs';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { LiteEmissionResult, liteEmissionMessages } from 'src/app/core/utils/lite-invoice-emission';
import { DecimalInputDirective } from 'src/app/shared/directives/decimal-input.directive';
import { SupplierPickerComponent } from 'src/app/shared/components/supplier-picker/supplier-picker.component';
import { round2 } from 'src/app/core/utils/withholding';
import { LiteSupplier, SupplierIdentificationType } from 'src/app/services/lite-suppliers.service';
import {
  PurchaseSettlementInput, PurchaseSettlementSetup, PurchaseSettlementsService
} from 'src/app/services/purchase-settlements.service';
import { UppercaseInputDirective } from 'src/app/shared/directives/uppercase-input.directive';

/** Tipos de identificación válidos para una liquidación: cédula, pasaporte y exterior (con RUC se pide factura). */
const SETTLEMENT_IDENTIFICATION_TYPES: readonly SupplierIdentificationType[] = ['05', '06', '08'];
/** Pagos en efectivo por encima de este valor no sirven para deducir el gasto (aviso, no bloquea). */
const CASH_LIMIT = 1000;
const CASH_CODE = '01';

/** El descuento de una línea no puede superar cantidad × precio. */
function itemDiscountValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const gross = (Number(group.get('cantidad')?.value) || 0) * (Number(group.get('precio_unitario')?.value) || 0);
    const discount = Number(group.get('descuento')?.value) || 0;
    return discount > round2(gross) + 0.005 ? { descuentoExcedido: true } : null;
  };
}

/**
 * Liquidación de compra (SRI 03): el negocio la emite cuando compra a alguien que no puede darle factura (un
 * agricultor, un artesano, quien presta un servicio ocasional o un extranjero). Mismo flujo que la retención
 * (borrador → emitir). Los totales que se ven aquí son solo una guía: el backend recalcula todo.
 */
@Component({
  selector: 'app-purchase-settlement-form',
  standalone: true,
  imports: [UppercaseInputDirective, CommonModule, RouterModule, ReactiveFormsModule, NgxSpinnerComponent, DecimalInputDirective, SupplierPickerComponent],
  templateUrl: './purchase-settlement-form.component.html'
})
export class PurchaseSettlementFormComponent implements OnInit {
  readonly cashLimit = CASH_LIMIT;
  form: FormGroup;
  settlementName = '';
  supplier: LiteSupplier | null = null;

  setup: PurchaseSettlementSetup | null = null;
  setupLoading = true;
  setupError = '';

  submitting = false;
  submitted = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private svc: PurchaseSettlementsService,
    private spinner: NgxSpinnerService,
    private frappeError: FrappeErrorService,
    public capabilities: CompanyCapabilitiesService
  ) {
    this.form = this.fb.group({
      establishment: ['', Validators.required],
      emission_point: ['', Validators.required],
      environment: [this.defaultEnvironment(), Validators.required],
      forma_pago: [CASH_CODE, Validators.required],
      items: this.fb.array([this.createItemRow()]),
      notes: ['', Validators.maxLength(300)]
    });
  }

  ngOnInit(): void {
    this.settlementName = this.route.snapshot.paramMap.get('id') || '';
    this.load();
    if (!this.settlementName) this.autoSelectLocation();
  }

  get isEditMode(): boolean { return !!this.settlementName; }
  get items(): FormArray { return this.form.get('items') as FormArray; }

  get establishmentOptions(): any[] { return this.capabilities.activeEstablishments; }

  get emissionPointOptions(): any[] {
    const establishment = this.form?.get('establishment')?.value;
    return establishment ? this.capabilities.activeEmissionPointsFor(establishment) : [];
  }

  /** La liquidación tiene su propio consecutivo (SRI 03) por establecimiento, punto y ambiente. */
  get hasActiveSequence(): boolean {
    const value = this.form?.getRawValue();
    if (!value?.establishment || !value?.emission_point) return false;
    return this.capabilities.hasActiveSequence('Liquidacion de Compra', value.establishment, value.emission_point, value.environment);
  }

  get blockMessage(): string { return String(this.setup?.block_message || '').trim(); }

  /** Tipos de identificación que acepta el backend (cédula, pasaporte, exterior). */
  get allowedIdentificationTypes(): readonly SupplierIdentificationType[] {
    const fromSetup = (this.setup?.identification_types || [])
      .map(item => String(item?.code || '') as SupplierIdentificationType)
      .filter(code => code && code !== '04');
    return fromSetup.length ? fromSetup : SETTLEMENT_IDENTIFICATION_TYPES;
  }

  /** Quien tiene RUC debe entregar su factura: no se le emite liquidación. */
  get supplierHasRuc(): boolean {
    return !!this.supplier && !this.allowedIdentificationTypes.includes(this.supplier.identification_type);
  }

  get cashOverLimit(): boolean {
    return this.form.get('forma_pago')?.value === CASH_CODE && this.total > CASH_LIMIT;
  }

  // ---------- Carga ----------

  load(): void {
    this.setupLoading = true;
    this.setupError = '';
    this.spinner.show();
    forkJoin({
      setup: this.svc.getSetup(),
      detail: this.settlementName ? this.svc.getDetail(this.settlementName) : of(null)
    }).pipe(finalize(() => { this.spinner.hide(); this.setupLoading = false; })).subscribe({
      next: ({ setup, detail }) => {
        this.setup = this.normalizeSetup(setup);
        if (detail) {
          if (String(detail?.status || '').trim().toUpperCase() !== 'BORRADOR') {
            toast.error('Solo se pueden editar liquidaciones de compra en borrador.');
            this.router.navigate(['/dashboard/purchase-settlements', this.settlementName]);
            return;
          }
          this.patchFromDetail(detail);
        } else {
          this.applySetupDefaults();
        }
      },
      error: err => {
        this.setupError = this.frappeError.handle(err) || 'No se pudo cargar la configuración de liquidaciones de compra.';
      }
    });
  }

  private normalizeSetup(setup: any): PurchaseSettlementSetup {
    const list = (value: any) => Array.isArray(value) ? value : [];
    return {
      withholding_agent: setup?.withholding_agent === true || setup?.withholding_agent === 1,
      block_message: setup?.block_message || null,
      tax_codes: list(setup?.tax_codes).map((item: any) => ({ ...item, code: String(item?.code ?? ''), rate: Number(item?.rate) || 0 })),
      payment_methods: list(setup?.payment_methods).map((item: any) => ({ ...item, code: String(item?.code ?? '') })),
      identification_types: list(setup?.identification_types).map((item: any) => ({ ...item, code: String(item?.code ?? '') }))
    };
  }

  /** Lo que se compra a un agricultor o artesano suele ir con IVA 0 % (código 0 del SRI). */
  private get defaultTaxCode(): string {
    const codes = this.setup?.tax_codes || [];
    return (codes.find(item => item.code === '0') || codes.find(item => item.rate === 0) || codes[0])?.code || '';
  }

  private applySetupDefaults(): void {
    const defaultCode = this.defaultTaxCode;
    this.items.controls.forEach(row => {
      if (!row.get('tax_code')?.value && defaultCode) row.get('tax_code')?.setValue(defaultCode);
    });
    const methods = this.setup?.payment_methods || [];
    if (methods.length && !methods.some(item => item.code === this.form.get('forma_pago')?.value)) {
      this.form.patchValue({ forma_pago: (methods.find(item => item.code === CASH_CODE) || methods[0]).code });
    }
  }

  /** Preselecciona el primer establecimiento/punto con secuencia de liquidación activa; si no hay, el principal. */
  private autoSelectLocation(): void {
    if (this.form.value.establishment) return;
    const environment = this.form.value.environment;
    for (const establishment of this.establishmentOptions) {
      const establishmentId = this.recordId(establishment);
      const point = this.capabilities.activeEmissionPointsFor(establishmentId)
        .find((item: any) => this.capabilities.hasActiveSequence('Liquidacion de Compra', establishmentId, this.recordId(item), environment));
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
    this.supplier = detail?.supplier?.name ? detail.supplier : null;
    this.form.patchValue({
      establishment: detail?.establishment || '',
      emission_point: detail?.emission_point || '',
      environment: detail?.environment || this.defaultEnvironment(),
      forma_pago: detail?.forma_pago || CASH_CODE,
      notes: detail?.notes || ''
    });
    const items = Array.isArray(detail?.items) ? detail.items : [];
    this.form.setControl('items', this.fb.array(items.length
      ? items.map((item: any) => this.createItemRow({
        descripcion: item?.descripcion || '',
        unidad_medida: item?.unidad_medida || '',
        cantidad: Number(item?.cantidad) || null,
        precio_unitario: item?.precio_unitario === null || item?.precio_unitario === undefined ? null : Number(item.precio_unitario),
        descuento: Number(item?.descuento) || null,
        tax_code: String(item?.tax_code ?? '')
      }))
      : [this.createItemRow({ tax_code: this.defaultTaxCode })]));
  }

  // ---------- Líneas ----------

  createItemRow(value: Partial<{
    descripcion: string; unidad_medida: string; cantidad: number | null; precio_unitario: number | null;
    descuento: number | null; tax_code: string;
  }> = {}): FormGroup {
    return this.fb.group({
      descripcion: [value.descripcion || '', [Validators.required, Validators.maxLength(300)]],
      unidad_medida: [value.unidad_medida || '', Validators.maxLength(30)],
      cantidad: [value.cantidad ?? 1, [Validators.required, Validators.min(0.000001)]],
      precio_unitario: [value.precio_unitario ?? null, [Validators.required, Validators.min(0)]],
      descuento: [value.descuento ?? null, Validators.min(0)],
      tax_code: [value.tax_code || '', Validators.required]
    }, { validators: itemDiscountValidator() });
  }

  addItem(): void {
    this.items.push(this.createItemRow({ tax_code: this.defaultTaxCode }));
  }

  removeItem(index: number): void {
    if (this.items.length <= 1) return;
    this.items.removeAt(index);
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

  // ---------- Cálculos (solo para mostrar; el backend recalcula) ----------

  taxRate(code: unknown): number {
    return this.setup?.tax_codes.find(item => item.code === String(code ?? ''))?.rate ?? 0;
  }

  itemSubtotal(row: AbstractControl): number {
    const gross = (Number(row.get('cantidad')?.value) || 0) * (Number(row.get('precio_unitario')?.value) || 0);
    return round2(gross - (Number(row.get('descuento')?.value) || 0));
  }

  itemIva(row: AbstractControl): number {
    return round2(this.itemSubtotal(row) * this.taxRate(row.get('tax_code')?.value) / 100);
  }

  itemTotal(row: AbstractControl): number {
    return round2(this.itemSubtotal(row) + this.itemIva(row));
  }

  get subtotal(): number {
    return round2(this.items.controls.reduce((sum, row) => sum + this.itemSubtotal(row), 0));
  }

  get totalDiscount(): number {
    return round2(this.items.controls.reduce((sum, row) => sum + (Number(row.get('descuento')?.value) || 0), 0));
  }

  get totalIva(): number {
    return round2(this.items.controls.reduce((sum, row) => sum + this.itemIva(row), 0));
  }

  get total(): number { return round2(this.subtotal + this.totalIva); }

  /** Subtotal e IVA por tarifa, como saldrán en el comprobante. */
  get totalsByRate(): { label: string; base: number; iva: number }[] {
    const groups = new Map<string, { label: string; base: number; iva: number }>();
    this.items.controls.forEach(row => {
      const code = String(row.get('tax_code')?.value ?? '');
      if (!code) return;
      const label = this.setup?.tax_codes.find(item => item.code === code)?.label || code;
      const group = groups.get(code) || { label, base: 0, iva: 0 };
      group.base = round2(group.base + this.itemSubtotal(row));
      group.iva = round2(group.iva + this.itemIva(row));
      groups.set(code, group);
    });
    return Array.from(groups.values());
  }

  // ---------- Validación ----------

  /** Lista de lo que falta, con las reglas del backend adelantadas (el backend decide). */
  get validationSummary(): string[] {
    if (!this.submitted) return [];
    const errors: string[] = [];
    const get = (name: string) => this.form.get(name);

    if (!this.supplier) errors.push('Elige a quién le compraste o regístralo.');
    else if (this.supplierHasRuc) errors.push('Quien tiene RUC debe darte su factura: elige un proveedor con cédula, pasaporte o identificación del exterior.');

    this.items.controls.forEach((row, index) => {
      const label = `Línea ${index + 1}`;
      if (row.get('descripcion')?.errors?.['required']) errors.push(`${label}: escribe qué compraste.`);
      else if (row.get('descripcion')?.errors?.['maxlength']) errors.push(`${label}: la descripción admite hasta 300 caracteres.`);
      if (row.get('cantidad')?.invalid) errors.push(`${label}: la cantidad debe ser mayor que 0.`);
      if (row.get('precio_unitario')?.invalid) errors.push(`${label}: escribe el precio (0 o más).`);
      if (row.get('descuento')?.invalid) errors.push(`${label}: el descuento no puede ser negativo.`);
      else if (row.errors?.['descuentoExcedido']) errors.push(`${label}: el descuento no puede superar cantidad × precio.`);
      if (row.get('tax_code')?.invalid) errors.push(`${label}: elige el IVA.`);
      if (row.get('unidad_medida')?.invalid) errors.push(`${label}: la unidad admite hasta 30 caracteres.`);
    });
    if (this.total <= 0) errors.push('El total de la compra debe ser mayor que 0.');

    if (get('forma_pago')?.invalid) errors.push('Elige la forma de pago.');
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

  private buildPayload(): PurchaseSettlementInput {
    const value = this.form.getRawValue();
    const notes = String(value.notes || '').trim();
    return {
      ...(this.settlementName ? { name: this.settlementName } : {}),
      establishment: value.establishment,
      emission_point: value.emission_point,
      environment: value.environment,
      supplier: String(this.supplier?.name || ''),
      forma_pago: value.forma_pago,
      items: (value.items || []).map((item: any) => {
        const unit = String(item.unidad_medida || '').trim();
        const discount = round2(Number(item.descuento) || 0);
        return {
          descripcion: String(item.descripcion || '').trim(),
          ...(unit ? { unidad_medida: unit } : {}),
          cantidad: Number(item.cantidad) || 0,
          precio_unitario: Number(item.precio_unitario) || 0,
          ...(discount ? { descuento: discount } : {}),
          tax_code: String(item.tax_code)
        };
      }),
      ...(notes ? { notes } : {})
    };
  }

  // ---------- Acciones ----------

  get canSaveDraft(): boolean {
    return !this.submitting && this.capabilities.hasPermission('billing.create');
  }

  get canEmit(): boolean {
    return this.canSaveDraft && !this.blockMessage && !this.supplierHasRuc;
  }

  guardarBorrador(): void {
    if (!this.capabilities.hasPermission('billing.create')) {
      toast.error('No tienes permisos para crear liquidaciones de compra.');
      return;
    }
    if (!this.validate()) return;
    this.submitting = true;
    this.spinner.show();
    this.svc.saveDraft(this.buildPayload()).pipe(finalize(() => { this.spinner.hide(); this.submitting = false; })).subscribe({
      next: (data: any) => {
        toast.success('Borrador guardado.');
        const name = String(data?.name || this.settlementName || '').trim();
        this.router.navigate(name ? ['/dashboard/purchase-settlements', name] : ['/dashboard/purchase-settlements']);
      },
      error: err => toast.error(this.frappeError.handle(err) || 'No se pudo guardar la liquidación de compra.')
    });
  }

  emitir(): void {
    if (!this.capabilities.hasPermission('billing.create')) {
      toast.error('No tienes permisos para emitir liquidaciones de compra.');
      return;
    }
    if (this.blockMessage) {
      toast.error(this.blockMessage);
      return;
    }
    if (!this.validate()) return;
    if (!this.hasActiveSequence) {
      toast.error('Falta la secuencia de Liquidación de compra para este establecimiento, punto de emisión y ambiente. Créala en Configuración ▸ Secuencias.');
      return;
    }
    // Mismo control de emisión que facturas, guías y retenciones (permiso, plan, firma, configuración y cupo).
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
        next: () => this.svc.emitDraft(this.settlementName).pipe(done()).subscribe({
          next: res => this.handleEmitResult(res, this.settlementName),
          error: err => toast.error(this.frappeError.handle(err) || 'No se pudo emitir la liquidación de compra.')
        }),
        error: err => {
          this.spinner.hide();
          this.submitting = false;
          toast.error(this.frappeError.handle(err) || 'No se pudo guardar la liquidación de compra.');
        }
      });
    } else {
      this.svc.createAndEmit(payload).pipe(done()).subscribe({
        next: res => this.handleEmitResult(res, res?.invoiceName || res?.data?.name),
        error: err => toast.error(this.frappeError.handle(err) || 'No se pudo emitir la liquidación de compra.')
      });
    }
  }

  private handleEmitResult(res: any, fallbackName?: string): void {
    const messages = [...liteEmissionMessages(res?.emission), ...liteEmissionMessages(res?.data)].filter(Boolean);
    const state = String(res?.state || '').toUpperCase();
    const name = String(res?.data?.name || fallbackName || this.settlementName || '').trim();
    if (['ERROR', 'PROVIDER_ERROR', 'REJECTED'].includes(state)) {
      toast.error(messages[0] || 'La liquidación de compra no fue autorizada.');
    } else {
      toast.success(messages[0] || 'Liquidación de compra emitida.');
    }
    this.router.navigate(name ? ['/dashboard/purchase-settlements', name] : ['/dashboard/purchase-settlements']);
  }

  cancelar(): void {
    this.router.navigate(this.settlementName ? ['/dashboard/purchase-settlements', this.settlementName] : ['/dashboard/purchase-settlements']);
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
