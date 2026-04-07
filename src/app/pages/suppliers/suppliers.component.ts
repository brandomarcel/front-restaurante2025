import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { toast } from 'ngx-sonner';
import { AlertService } from 'src/app/core/services/alert.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import {
  CreateProveedorPayload,
  Supplier,
  SupplierIdentificationType,
  UpdateProveedorPayload,
} from 'src/app/models/supplier';
import { SuppliersService } from 'src/app/services/suppliers.service';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';

type SupplierModalMode = 'create' | 'edit' | 'view';
type SupplierStatusFilter = '' | '1' | '0';

@Component({
  selector: 'app-suppliers',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgxPaginationModule, ButtonComponent],
  templateUrl: './suppliers.component.html',
  styleUrl: './suppliers.component.css'
})
export class SuppliersComponent implements OnInit {
  readonly identificationTypes: Array<{ label: string; value: SupplierIdentificationType }> = [
    { label: 'RUC', value: '04 - RUC' },
    { label: 'Cedula', value: '05 - Cedula' },
    { label: 'Pasaporte', value: '06 - Pasaporte' },
    { label: 'Identificacion del exterior', value: '07 - Identificacion del exterior' },
  ];

  suppliers: Supplier[] = [];
  filteredSuppliersList: Supplier[] = [];

  searchTerm = '';
  identificationSearch = '';
  estadoFiltro: SupplierStatusFilter = '1';

  isLoadingList = false;
  listError = '';
  hasLoadedList = false;
  isLookingUpByIdentification = false;
  identificationLookupError = '';

  mostrarModal = false;
  modalMode: SupplierModalMode = 'create';
  proveedorEditando: Supplier | null = null;
  proveedorForm!: FormGroup;
  submitted = false;
  isSavingSupplier = false;
  isLoadingSupplierDetail = false;

  page = 1;
  pageSize = 10;

  constructor(
    private suppliersService: SuppliersService,
    private fb: FormBuilder,
    private alertService: AlertService,
    private frappeErrorService: FrappeErrorService,
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.cargarProveedores();
  }

  get f() {
    return this.proveedorForm.controls;
  }

  get activeCount(): number {
    return this.suppliers.filter((item) => this.toBool(item.isactive)).length;
  }

  get inactiveCount(): number {
    return this.suppliers.length - this.activeCount;
  }

  get creditCount(): number {
    return this.suppliers.filter((item) => Number(item.plazo_credito_dias || 0) > 0).length;
  }

  get isViewMode(): boolean {
    return this.modalMode === 'view';
  }

  get modalTitle(): string {
    switch (this.modalMode) {
      case 'edit':
        return 'Editar proveedor';
      case 'view':
        return 'Detalle del proveedor';
      default:
        return 'Nuevo proveedor';
    }
  }

  get modalDescription(): string {
    switch (this.modalMode) {
      case 'edit':
        return 'Actualiza datos fiscales, contacto y condiciones comerciales del proveedor.';
      case 'view':
        return 'Consulta la informacion registrada para reutilizarla luego en compras y recepcion.';
      default:
        return 'Registra informacion fiscal, contacto y condiciones comerciales de compra.';
    }
  }

  initForm(): void {
    this.proveedorForm = this.fb.group({
      name: [''],
      nombre: ['', Validators.required],
      nombre_comercial: [''],
      contacto_principal: [''],
      telefono: [''],
      direccion: [''],
      tipo_identificacion: ['04 - RUC', Validators.required],
      num_identificacion: ['', Validators.required],
      correo: ['', Validators.email],
      website: [''],
      plazo_credito_dias: [0, Validators.min(0)],
      notas: [''],
      isactive: [true],
    });

    this.f['num_identificacion'].addValidators(this.identificacionLengthValidator());
    this.f['tipo_identificacion'].valueChanges.subscribe(() => {
      this.f['num_identificacion'].updateValueAndValidity({ emitEvent: false });
    });
  }

  cargarProveedores(): void {
    this.isLoadingList = true;
    this.listError = '';

    this.suppliersService.getProveedores({
      isactive: this.estadoFiltro === '' ? undefined : Number(this.estadoFiltro),
      search: this.searchTerm || undefined,
    }).subscribe({
      next: (res: any) => {
        this.suppliers = this.extractList(res);
        this.filteredSuppliersList = [...this.suppliers];
        this.hasLoadedList = true;
        this.page = 1;
      },
      error: (error) => {
        this.suppliers = [];
        this.filteredSuppliersList = [];
        this.hasLoadedList = true;
        this.listError = this.frappeErrorService.handle(error);
      },
      complete: () => {
        this.isLoadingList = false;
      }
    });
  }

  aplicarFiltros(): void {
    this.cargarProveedores();
  }

  limpiarFiltros(): void {
    this.searchTerm = '';
    this.identificationSearch = '';
    this.identificationLookupError = '';
    this.estadoFiltro = '1';
    this.cargarProveedores();
  }

  buscarPorIdentificacion(): void {
    const identification = String(this.identificationSearch || '').trim();
    if (!identification) {
      this.identificationLookupError = 'Ingresa una identificacion para buscar.';
      return;
    }

    this.isLookingUpByIdentification = true;
    this.identificationLookupError = '';

    this.suppliersService.getProveedorByIdentificacion(identification).subscribe({
      next: (res: any) => {
        const supplier = this.extractItem(res);
        if (!supplier) {
          this.identificationLookupError = 'No se encontro un proveedor con esa identificacion.';
          return;
        }

        this.identificationLookupError = '';
        this.abrirModalDetalle(supplier);
      },
      error: (error) => {
        this.identificationLookupError = this.frappeErrorService.handle(error);
      },
      complete: () => {
        this.isLookingUpByIdentification = false;
      }
    });
  }

  abrirModalCrear(): void {
    this.modalMode = 'create';
    this.proveedorEditando = null;
    this.submitted = false;
    this.isLoadingSupplierDetail = false;
    this.isSavingSupplier = false;
    this.proveedorForm.enable({ emitEvent: false });
    this.proveedorForm.reset(this.defaultFormValue());
    this.mostrarModal = true;
  }

  abrirModalEditar(supplier: Supplier): void {
    this.openSupplierById(supplier.name, 'edit');
  }

  abrirModalDetalle(supplier: Supplier): void {
    this.openSupplierById(supplier.name, 'view');
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.modalMode = 'create';
    this.proveedorEditando = null;
    this.submitted = false;
    this.isSavingSupplier = false;
    this.isLoadingSupplierDetail = false;
    this.proveedorForm.enable({ emitEvent: false });
    this.proveedorForm.reset(this.defaultFormValue());
  }

  guardarProveedor(): void {
    if (this.isViewMode || this.isSavingSupplier) {
      return;
    }

    this.submitted = true;
    if (this.proveedorForm.invalid) {
      this.proveedorForm.markAllAsTouched();
      return;
    }

    const payload = this.buildPayload();
    this.isSavingSupplier = true;

    const request = this.modalMode === 'edit' && this.proveedorEditando?.name
      ? this.suppliersService.updateProveedor({
        name: this.proveedorEditando.name,
        ...payload,
      } as UpdateProveedorPayload)
      : this.suppliersService.createProveedor(payload as CreateProveedorPayload);

    request.subscribe({
      next: () => {
        toast.success(this.modalMode === 'edit' ? 'Proveedor actualizado' : 'Proveedor creado');
        this.cerrarModal();
        this.cargarProveedores();
      },
      error: (error) => {
        this.isSavingSupplier = false;
        this.alertService.error(this.frappeErrorService.handle(error));
      },
      complete: () => {
        this.isSavingSupplier = false;
      }
    });
  }

  getPlazoCreditoLabel(supplier: Supplier): string {
    const days = Number(supplier.plazo_credito_dias || 0);
    return days > 0 ? `${days} dias` : 'Contado';
  }

  getStatusTone(supplier: Supplier): string {
    return this.toBool(supplier.isactive) ? 'badge-green' : 'badge-red';
  }

  getStatusLabel(supplier: Supplier): string {
    return this.toBool(supplier.isactive) ? 'Activo' : 'Inactivo';
  }

  getMaxLength(): number | null {
    const tipo = String(this.f['tipo_identificacion']?.value || '');
    switch (tipo) {
      case '05 - Cedula':
        return 10;
      case '04 - RUC':
        return 13;
      default:
        return null;
    }
  }

  trackByName = (_: number, item: Supplier) => item?.name || item?.num_identificacion || _;

  private openSupplierById(name: string, mode: SupplierModalMode): void {
    this.mostrarModal = true;
    this.modalMode = mode;
    this.proveedorEditando = null;
    this.submitted = false;
    this.isSavingSupplier = false;
    this.isLoadingSupplierDetail = true;
    this.proveedorForm.reset(this.defaultFormValue());

    if (mode === 'view') {
      this.proveedorForm.disable({ emitEvent: false });
    } else {
      this.proveedorForm.enable({ emitEvent: false });
    }

    this.suppliersService.getProveedorById(name).subscribe({
      next: (res: any) => {
        const supplier = this.extractItem(res);
        if (!supplier) {
          this.alertService.error('No se pudo cargar el detalle del proveedor.');
          this.cerrarModal();
          return;
        }

        this.proveedorEditando = supplier;
        this.proveedorForm.patchValue(this.toFormValue(supplier));

        if (mode === 'view') {
          this.proveedorForm.disable({ emitEvent: false });
        } else {
          this.proveedorForm.enable({ emitEvent: false });
        }
      },
      error: (error) => {
        this.alertService.error(this.frappeErrorService.handle(error));
        this.cerrarModal();
      },
      complete: () => {
        this.isLoadingSupplierDetail = false;
      }
    });
  }

  private buildPayload(): Partial<CreateProveedorPayload> {
    const raw = this.proveedorForm.getRawValue();

    return this.compactPayload({
      nombre: this.cleanText(raw.nombre),
      nombre_comercial: this.cleanText(raw.nombre_comercial),
      contacto_principal: this.cleanText(raw.contacto_principal),
      telefono: this.cleanText(raw.telefono),
      direccion: this.cleanText(raw.direccion),
      tipo_identificacion: raw.tipo_identificacion || undefined,
      num_identificacion: this.cleanText(raw.num_identificacion),
      correo: this.cleanText(raw.correo)?.toLowerCase(),
      website: this.cleanText(raw.website),
      plazo_credito_dias: raw.plazo_credito_dias === '' || raw.plazo_credito_dias === null
        ? undefined
        : Number(raw.plazo_credito_dias || 0),
      notas: this.cleanText(raw.notas),
      isactive: !!raw.isactive,
    });
  }

  private compactPayload(payload: Record<string, any>): Record<string, any> {
    return Object.entries(payload).reduce((acc, [key, value]) => {
      if (value === undefined || value === null || value === '') {
        return acc;
      }

      acc[key] = value;
      return acc;
    }, {} as Record<string, any>);
  }

  private cleanText(value: any): string {
    return String(value ?? '').trim();
  }

  private toFormValue(supplier: Supplier) {
    return {
      name: supplier.name || '',
      nombre: supplier.nombre || '',
      nombre_comercial: supplier.nombre_comercial || '',
      contacto_principal: supplier.contacto_principal || '',
      telefono: supplier.telefono || '',
      direccion: supplier.direccion || '',
      tipo_identificacion: supplier.tipo_identificacion || '04 - RUC',
      num_identificacion: supplier.num_identificacion || '',
      correo: supplier.correo || '',
      website: supplier.website || '',
      plazo_credito_dias: Number(supplier.plazo_credito_dias || 0),
      notas: supplier.notas || '',
      isactive: this.toBool(supplier.isactive),
    };
  }

  private defaultFormValue() {
    return {
      name: '',
      nombre: '',
      nombre_comercial: '',
      contacto_principal: '',
      telefono: '',
      direccion: '',
      tipo_identificacion: '04 - RUC',
      num_identificacion: '',
      correo: '',
      website: '',
      plazo_credito_dias: 0,
      notas: '',
      isactive: true,
    };
  }

  private toBool(value: number | boolean | undefined): boolean {
    return value === true || value === 1 || value === '1' as any;
  }

  private identificacionLengthValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const tipo = String(this.proveedorForm?.get('tipo_identificacion')?.value || '');
      const valor = String(control.value || '').trim();

      if (!valor) {
        return null;
      }

      if (tipo === '05 - Cedula' && valor.length !== 10) {
        return { cedulaInvalida: true };
      }

      if (tipo === '04 - RUC' && valor.length !== 13) {
        return { rucInvalido: true };
      }

      return null;
    };
  }

  private extractList(res: any): Supplier[] {
    const candidates = [
      res?.message?.data,
      res?.data,
      res?.message?.suppliers,
      res?.suppliers,
      res?.message,
    ];

    const list = candidates.find((item) => Array.isArray(item));
    return Array.isArray(list) ? list : [];
  }

  private extractItem(res: any): Supplier | null {
    const candidates = [
      res?.message?.data,
      res?.data,
      res?.message?.supplier,
      res?.supplier,
      res?.message,
    ];

    for (const item of candidates) {
      if (Array.isArray(item) && item.length) {
        return item[0] as Supplier;
      }

      if (item && typeof item === 'object' && !Array.isArray(item) && item.name) {
        return item as Supplier;
      }
    }

    return null;
  }
}
