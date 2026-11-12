import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { Subject, catchError, debounceTime, distinctUntilChanged, finalize, map, of, switchMap, takeUntil } from 'rxjs';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import {
  LiteSupplier, LiteSuppliersService, SUPPLIER_IDENTIFICATION_TYPES, SupplierIdentificationType, supplierIdentificationLabel
} from 'src/app/services/lite-suppliers.service';
import { UppercaseInputDirective } from 'src/app/shared/directives/uppercase-input.directive';

/** RUC: 13 dígitos terminados en 001. Cédula: 10 dígitos. Pasaporte y exterior: sin formato fijo. */
function supplierIdentificationValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value || '').trim();
    if (!value) return null;
    const type = String(control.parent?.get('identification_type')?.value || '');
    if (type === '04' && !/^\d{10}001$/.test(value)) return { rucInvalido: true };
    if (type === '05' && !/^\d{10}$/.test(value)) return { cedulaInvalida: true };
    return null;
  };
}

/**
 * Proveedor de un comprobante: búsqueda en el servidor por nombre o identificación y alta rápida («Nuevo
 * proveedor») sin salir del formulario. Mismo patrón que `app-pos-customer-picker`. La página que lo usa puede
 * abrir el alta con datos ya puestos (`openNew`), p. ej. el RUC leído de una clave de acceso.
 *
 * Sin entradas extra se comporta como en la retención (alta con RUC, todos los tipos). La liquidación de compra
 * limita el alta a cédula, pasaporte y exterior (`allowedIdentificationTypes`) y propone Cédula.
 */
@Component({
  selector: 'app-supplier-picker',
  standalone: true,
  imports: [UppercaseInputDirective, CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './supplier-picker.component.html'
})
export class SupplierPickerComponent implements OnInit, OnDestroy {
  @Input() supplier: LiteSupplier | null = null;
  @Input() invalid = false;
  /** Tipo propuesto en «Nuevo proveedor». */
  @Input() defaultIdentificationType: SupplierIdentificationType = '04';
  /** Tipos que se ofrecen en «Nuevo proveedor»; vacío = todos. La búsqueda trae todos los proveedores igual. */
  @Input() allowedIdentificationTypes: readonly SupplierIdentificationType[] = [];
  /** Comprobante que recibe el proveedor por correo (texto del aviso «Sin correo»). */
  @Input() documentLabel = 'la retención';
  @Output() supplierChange = new EventEmitter<LiteSupplier | null>();

  readonly identificationLabel = supplierIdentificationLabel;

  searchTerm = '';
  searchOpen = false;
  searchLoading = false;
  results: LiteSupplier[] = [];

  creating = false;
  saving = false;
  submitted = false;
  form: FormGroup;

  private readonly search$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly suppliers: LiteSuppliersService,
    private readonly fb: FormBuilder,
    private readonly frappeError: FrappeErrorService
  ) {
    this.form = this.fb.group({
      identification_type: ['04' as SupplierIdentificationType, Validators.required],
      identification: ['', [Validators.required, Validators.maxLength(20), supplierIdentificationValidator()]],
      supplier_name: ['', [Validators.required, Validators.maxLength(300)]],
      email: ['', Validators.email],
      address: ['', Validators.maxLength(300)],
      related_party: [false]
    });
    this.form.get('identification_type')?.valueChanges.pipe(takeUntil(this.destroy$))
      .subscribe(() => this.form.get('identification')?.updateValueAndValidity());
  }

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap(term => {
        const query = term.trim();
        if (query.length < 2) return of([] as LiteSupplier[]);
        this.searchLoading = true;
        return this.suppliers.search(query, 8).pipe(
          map(res => res.data),
          catchError(() => of([] as LiteSupplier[])),
          finalize(() => this.searchLoading = false)
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe(rows => {
      this.results = rows;
      this.searchOpen = this.searchTerm.trim().length >= 2;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get f() { return this.form.controls; }

  get identificationTypes(): readonly { value: SupplierIdentificationType; label: string }[] {
    const allowed = this.allowedIdentificationTypes || [];
    return allowed.length ? SUPPLIER_IDENTIFICATION_TYPES.filter(type => allowed.includes(type.value)) : SUPPLIER_IDENTIFICATION_TYPES;
  }

  /** El tipo pedido si se ofrece; si no, el tipo por defecto (o el primero permitido). */
  private allowedType(type: SupplierIdentificationType | undefined): SupplierIdentificationType {
    const values = this.identificationTypes.map(item => item.value);
    if (type && values.includes(type)) return type;
    return values.includes(this.defaultIdentificationType) ? this.defaultIdentificationType : (values[0] || '04');
  }

  onSearchChange(term: string): void {
    this.searchTerm = term || '';
    if (this.searchTerm.trim().length < 2) {
      this.results = [];
      this.searchLoading = false;
    }
    this.searchOpen = this.searchTerm.trim().length >= 2;
    this.search$.next(this.searchTerm);
  }

  openSearch(): void {
    this.searchOpen = this.searchTerm.trim().length >= 2;
  }

  closeSearchSoon(): void {
    setTimeout(() => this.searchOpen = false, 150);
  }

  selectFirst(): void {
    if (this.results.length) this.select(this.results[0]);
  }

  select(supplier: LiteSupplier): void {
    this.setSupplier(supplier);
    this.searchTerm = '';
    this.results = [];
    this.searchOpen = false;
    this.creating = false;
  }

  clear(): void {
    this.setSupplier(null);
  }

  /** Abre el alta; si lo escrito en la búsqueda parece una identificación, la usa. */
  openNewFromSearch(): void {
    const term = this.searchTerm.trim();
    const digits = term.replace(/\D/g, '');
    if (digits && digits === term && (digits.length === 10 || digits.length === 13)) {
      this.openNew({ identification: digits, identification_type: this.allowedType(digits.length === 13 ? '04' : '05') });
    } else {
      this.openNew({ supplier_name: term });
    }
  }

  openNew(prefill: Partial<{ identification: string; identification_type: SupplierIdentificationType; supplier_name: string }> = {}): void {
    this.submitted = false;
    this.form.reset({
      identification_type: this.allowedType(prefill.identification_type || this.defaultIdentificationType),
      identification: prefill.identification || '',
      supplier_name: prefill.supplier_name || '',
      email: '',
      address: '',
      related_party: false
    });
    this.creating = true;
    this.searchOpen = false;
  }

  cancelNew(): void {
    this.creating = false;
    this.submitted = false;
  }

  saveNew(): void {
    this.submitted = true;
    if (this.form.invalid || this.saving) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving = true;
    this.suppliers.save({
      identification_type: value.identification_type,
      identification: String(value.identification || '').trim(),
      supplier_name: String(value.supplier_name || '').trim(),
      email: String(value.email || '').trim() || null,
      address: String(value.address || '').trim() || null,
      related_party: !!value.related_party
    }).pipe(finalize(() => this.saving = false)).subscribe({
      next: supplier => {
        if (!supplier?.name) {
          toast.error('El servidor no devolvió el proveedor creado.');
          return;
        }
        toast.success('Proveedor guardado.');
        this.select(supplier);
      },
      error: err => toast.error(this.frappeError.handle(err) || 'No se pudo guardar el proveedor.')
    });
  }

  trackByName = (index: number, supplier: LiteSupplier) => supplier?.name || index;

  private setSupplier(supplier: LiteSupplier | null): void {
    this.supplier = supplier;
    this.supplierChange.emit(supplier);
  }
}
