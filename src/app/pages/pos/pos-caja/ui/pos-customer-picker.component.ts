import { CommonModule } from '@angular/common';
import {
  Component, EventEmitter, HostListener, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges
} from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { Subject, catchError, debounceTime, distinctUntilChanged, finalize, of, switchMap, takeUntil } from 'rxjs';
import { VARIABLE_CONSTANTS } from 'src/app/core/constants/variable.constants';
import { CustomersService } from 'src/app/services/customers.service';
import { FINAL_CONSUMER_IDENTIFICATION, extractApiError } from '../pos-sale.rules';

/**
 * Cliente de la venta: búsqueda por nombre/identificación, Consumidor Final y
 * alta rápida. El cliente elegido pertenece al POS (`customer` / `customerChange`):
 * cuando el POS lo limpia al terminar una venta, este componente se reinicia.
 * La lógica se movió sin cambios desde PosCajaComponent.
 */
@Component({
  selector: 'app-pos-customer-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, FontAwesomeModule],
  templateUrl: './pos-customer-picker.component.html'
})
export class PosCustomerPickerComponent implements OnInit, OnChanges, OnDestroy {
  @Input() customer: any = null;
  @Output() customerChange = new EventEmitter<any>();
  /** El cajero terminó con el cliente: el POS devuelve el foco al escáner. */
  @Output() done = new EventEmitter<void>();

  identificationCustomer = '';
  customerSearchTerm = '';
  isCustomerSearchOpen = false;
  customerSearchLoading = false;
  filteredCustomers: any[] = [];
  showCustomerModal = false;
  submitted = false;
  clienteForm!: FormGroup;
  readonly identificationTypes = VARIABLE_CONSTANTS.IDENTIFICATION_TYPE;

  private readonly customerSearch$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly customersService: CustomersService,
    private readonly fb: FormBuilder,
    private readonly spinner: NgxSpinnerService
  ) {}

  ngOnInit(): void {
    this.initClienteForm();
    this.initCustomerSearch();
  }

  /** Si el POS limpia el cliente (venta terminada), se borra también la búsqueda. */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['customer'] && !changes['customer'].firstChange && !this.customer) {
      this.resetSearch();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.showCustomerModal) this.cerrarModal();
  }

  get f() {
    return this.clienteForm.controls;
  }

  findByIdentificationCustomer(): void {
    const identification = this.identificationCustomer?.trim() || this.customerSearchTerm?.trim();
    if (!identification || (identification.length !== 10 && identification.length !== 13)) {
      toast.warning('La identificacion debe tener 10 o 13 digitos.');
      return;
    }

    this.spinner.show();
    this.customersService.get_cliente_by_identificacion(identification).pipe(
      finalize(() => this.spinner.hide())
    ).subscribe({
      next: (res: any) => {
        const found = res?.data || res?.message?.data || (res?.message && typeof res.message === 'object' ? res.message : res) || null;
        if (found) {
          this.selectCustomer(found);
          return;
        }
        this.setCustomer(null);
        this.openCustomerCreateFromIdentification(identification);
      },
      error: () => {
        this.setCustomer(null);
        this.openCustomerCreateFromIdentification(identification);
      }
    });
  }

  selectFinalConsumer(): void {
    this.identificationCustomer = FINAL_CONSUMER_IDENTIFICATION;
    this.customerSearchTerm = this.identificationCustomer;
    this.findByIdentificationCustomer();
  }

  onCustomerSearchChange(term: string): void {
    this.customerSearchTerm = term || '';
    const digits = this.customerSearchTerm.replace(/\D/g, '');
    this.identificationCustomer = digits.length === this.customerSearchTerm.trim().length ? digits : '';
    if (this.customerSearchTerm.trim().length < 2) {
      this.filteredCustomers = [];
      this.customerSearchLoading = false;
    }
    this.isCustomerSearchOpen = this.customerSearchTerm.trim().length >= 2;
    this.customerSearch$.next(this.customerSearchTerm);
  }

  openCustomerSearch(): void {
    this.isCustomerSearchOpen = this.customerSearchTerm.trim().length >= 2;
    if (this.isCustomerSearchOpen && this.filteredCustomers.length === 0) {
      this.customerSearch$.next(this.customerSearchTerm);
    }
  }

  closeCustomerSearchSoon(): void {
    setTimeout(() => {
      this.isCustomerSearchOpen = false;
    }, 150);
  }

  openCustomerModalFromSearch(): void {
    const digits = this.customerSearchTerm.trim().replace(/\D/g, '');
    if (digits.length === 10 || digits.length === 13) {
      this.clienteForm.patchValue({
        num_identificacion: digits,
        tipo_identificacion: digits.length === 10 ? '05 - Cedula' : '04 - RUC'
      }, { emitEvent: false });
      this.clienteForm.get('num_identificacion')?.updateValueAndValidity();
    }
    this.showCustomerModal = true;
    this.isCustomerSearchOpen = false;
  }

  searchCustomerFromInput(): void {
    const term = this.customerSearchTerm.trim();
    if (!term) {
      toast.warning('Escribe nombre, cedula, RUC, telefono o correo del cliente.');
      return;
    }
    if (this.filteredCustomers.length === 1) {
      this.selectCustomer(this.filteredCustomers[0]);
      return;
    }
    const digits = term.replace(/\D/g, '');
    if ((digits.length === 10 || digits.length === 13) && digits === term) {
      this.identificationCustomer = digits;
      this.findByIdentificationCustomer();
      return;
    }
    if (this.filteredCustomers.length > 1) {
      this.isCustomerSearchOpen = true;
      return;
    }
    this.searchCustomerSuggestionsNow(term);
  }

  selectFirstCustomerSuggestion(): void {
    if (this.filteredCustomers.length) {
      this.selectCustomer(this.filteredCustomers[0]);
      return;
    }
    this.searchCustomerFromInput();
  }

  selectCustomer(customer: any): void {
    this.setCustomer(customer);
    this.identificationCustomer = customer?.num_identificacion || '';
    this.customerSearchTerm = this.formatCustomerSearchLabel(customer);
    this.filteredCustomers = [];
    this.isCustomerSearchOpen = false;
    // Cliente listo: el cajero sigue con los productos.
    this.done.emit();
  }

  clearCustomerSelection(): void {
    this.resetSearch();
    this.setCustomer(null);
  }

  guardarCliente(): void {
    this.submitted = true;
    if (this.clienteForm.invalid) return;

    this.spinner.show();
    this.customersService.create(this.clienteForm.getRawValue()).pipe(
      finalize(() => this.spinner.hide())
    ).subscribe({
      next: (res: any) => {
        toast.success('Cliente creado exitosamente.');
        const created = Array.isArray(res) ? res[0] : (res?.data || res?.message?.data || res?.message || res);
        this.setCustomer(created);
        this.identificationCustomer = created?.num_identificacion || '';
        this.customerSearchTerm = this.formatCustomerSearchLabel(created);
        this.cerrarModal();
      },
      error: (err) => toast.error(extractApiError(err) || 'Error al crear el cliente.')
    });
  }

  cerrarModal(): void {
    this.showCustomerModal = false;
    this.submitted = false;
    this.clienteForm.reset({
      nombre: '',
      num_identificacion: '',
      tipo_identificacion: '05 - Cédula',
      correo: '',
      telefono: '',
      direccion: ''
    });
    this.done.emit();
  }

  getMaxLength(): number {
    const tipo = this.clienteForm?.get('tipo_identificacion')?.value;
    return String(tipo)?.slice(0, 2) === '05' ? 10 : 13;
  }

  trackByCustomerId = (index: number, c: any) => c?.name || c?.num_identificacion || index;

  private setCustomer(customer: any): void {
    this.customer = customer;
    this.customerChange.emit(customer);
  }

  private resetSearch(): void {
    this.identificationCustomer = '';
    this.customerSearchTerm = '';
    this.filteredCustomers = [];
    this.isCustomerSearchOpen = false;
  }

  private identificacionLengthValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const tipo = this.clienteForm?.get('tipo_identificacion')?.value;
      const valor = `${control.value || ''}`;
      if (!valor) return null;
      if (String(tipo).slice(0, 2) === '05' && valor.length !== 10) return { cedulaInvalida: true };
      if (String(tipo).slice(0, 2) === '04' && valor.length !== 13) return { rucInvalido: true };
      return null;
    };
  }

  private initClienteForm(): void {
    this.clienteForm = this.fb.group({
      nombre: ['', [Validators.required]],
      num_identificacion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(13)]],
      tipo_identificacion: ['05 - Cédula', [Validators.required]],
      correo: ['', [Validators.required, Validators.email]],
      telefono: ['', [Validators.required]],
      direccion: ['', [Validators.required]]
    });
    this.clienteForm.get('tipo_identificacion')?.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.clienteForm.patchValue({ num_identificacion: '' });
      this.clienteForm.get('num_identificacion')?.updateValueAndValidity();
    });
    this.clienteForm.get('num_identificacion')?.setValidators([
      Validators.required,
      this.identificacionLengthValidator()
    ]);
  }

  private initCustomerSearch(): void {
    this.customerSearch$.pipe(
      debounceTime(250),
      distinctUntilChanged(),
      switchMap((term: string) => {
        const query = term.trim();
        if (query.length < 2) return of([]);
        this.customerSearchLoading = true;
        return this.customersService.searchClientes(query, 8).pipe(
          catchError(() => of([])),
          finalize(() => this.customerSearchLoading = false)
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe((customers: any[]) => {
      this.filteredCustomers = customers;
      this.isCustomerSearchOpen = this.customerSearchTerm.trim().length >= 2;
    });
  }

  private searchCustomerSuggestionsNow(term: string): void {
    if (term.trim().length < 2) {
      toast.warning('Escribe al menos 2 caracteres para buscar.');
      return;
    }
    this.customerSearchLoading = true;
    this.customersService.searchClientes(term, 8).pipe(
      finalize(() => this.customerSearchLoading = false),
      catchError(() => of([]))
    ).subscribe((customers: any[]) => {
      this.filteredCustomers = customers;
      if (customers.length === 1) {
        this.selectCustomer(customers[0]);
        return;
      }
      this.isCustomerSearchOpen = true;
      if (!customers.length) toast.info('No hay coincidencias. Si es cliente nuevo, usa el boton +.');
    });
  }

  private openCustomerCreateFromIdentification(identification: string): void {
    const tipoIdentificacion = identification.length === 10 ? '05 - Cedula' : '04 - RUC';
    this.clienteForm.patchValue({
      num_identificacion: identification,
      tipo_identificacion: tipoIdentificacion
    }, { emitEvent: false });
    this.clienteForm.get('num_identificacion')?.updateValueAndValidity();
    this.showCustomerModal = true;
    toast.error('Cliente no encontrado con esa identificacion.');
  }

  private formatCustomerSearchLabel(customer: any): string {
    const name = customer?.nombre || 'Cliente';
    const identification = customer?.num_identificacion ? ` - ${customer.num_identificacion}` : '';
    return `${name}${identification}`;
  }
}
