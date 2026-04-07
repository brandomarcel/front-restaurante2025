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
import { NgxSpinnerService } from 'ngx-spinner';
import { VARIABLE_CONSTANTS } from 'src/app/core/constants/variable.constants';
import { AlertService } from 'src/app/core/services/alert.service';
import { Supplier } from 'src/app/models/supplier';
import { SuppliersService } from 'src/app/services/suppliers.service';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';

@Component({
  selector: 'app-suppliers',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgxPaginationModule, ButtonComponent],
  templateUrl: './suppliers.component.html',
  styleUrl: './suppliers.component.css'
})
export class SuppliersComponent implements OnInit {
  identificationTypes = VARIABLE_CONSTANTS.IDENTIFICATION_TYPE.filter((item) => item.value !== '07 - Consumidor Final');

  suppliers: Supplier[] = [];
  filteredSuppliersList: Supplier[] = [];

  private _searchTerm = '';
  get searchTerm() { return this._searchTerm; }
  set searchTerm(value: string) {
    this._searchTerm = value || '';
    this.actualizarProveedoresFiltrados();
  }

  estadoFiltro: '' | 'activos' | 'inactivos' = '';

  mostrarModal = false;
  proveedorEditando: Supplier | null = null;
  submitted = false;
  proveedorForm!: FormGroup;

  page = 1;
  pageSize = VARIABLE_CONSTANTS.PAGE_SIZE || 10;

  constructor(
    private suppliersService: SuppliersService,
    private fb: FormBuilder,
    private spinner: NgxSpinnerService,
    private alertService: AlertService
  ) { }

  ngOnInit(): void {
    this.cargarProveedores();
    this.initForm();
  }

  get activeCount(): number {
    return this.suppliers.filter((item) => !!item.isactive).length;
  }

  get inactiveCount(): number {
    return this.suppliers.length - this.activeCount;
  }

  get creditCount(): number {
    return this.suppliers.filter((item) => Number(item.dias_credito || 0) > 0).length;
  }

  initForm(): void {
    this.proveedorForm = this.fb.group({
      name: [''],
      codigo: [''],
      razon_social: ['', Validators.required],
      nombre_comercial: [''],
      tipo_identificacion: ['04 - RUC', Validators.required],
      num_identificacion: ['', Validators.required],
      contacto_principal: [''],
      correo: ['', Validators.email],
      telefono: ['', Validators.required],
      direccion: ['', Validators.required],
      dias_credito: [0, [Validators.min(0), Validators.max(365)]],
      observacion: [''],
      isactive: [true],
    });

    this.f['num_identificacion'].addValidators(this.identificacionLengthValidator());
    this.f['tipo_identificacion'].valueChanges.subscribe(() => {
      this.f['num_identificacion'].updateValueAndValidity({ emitEvent: false });
    });
  }

  get f() {
    return this.proveedorForm.controls;
  }

  cargarProveedores(): void {
    this.spinner.show();
    this.suppliersService.getAll().subscribe({
      next: (res) => {
        this.suppliers = res.message?.data || [];
        this.actualizarProveedoresFiltrados();
      },
      error: () => {
        this.alertService.error('No se pudieron cargar los proveedores.');
      },
      complete: () => {
        this.spinner.hide();
      }
    });
  }

  actualizarProveedoresFiltrados(): void {
    const term = (this._searchTerm || '').toLowerCase();

    this.filteredSuppliersList = (this.suppliers || []).filter((supplier) => {
      const matchesSearch =
        (supplier.razon_social || '').toLowerCase().includes(term) ||
        (supplier.nombre_comercial || '').toLowerCase().includes(term) ||
        (supplier.contacto_principal || '').toLowerCase().includes(term) ||
        (supplier.num_identificacion || '').toLowerCase().includes(term) ||
        (supplier.codigo || '').toLowerCase().includes(term);

      const matchesStatus =
        this.estadoFiltro === ''
          ? true
          : this.estadoFiltro === 'activos'
            ? !!supplier.isactive
            : !supplier.isactive;

      return matchesSearch && matchesStatus;
    }).sort((a, b) => (a.razon_social || '').localeCompare(b.razon_social || ''));

    if (this.page > 1 && (this.filteredSuppliersList.length || 0) <= ((this.page - 1) * this.pageSize)) {
      this.page = 1;
    }
  }

  limpiarFiltros(): void {
    this._searchTerm = '';
    this.estadoFiltro = '';
    this.page = 1;
    this.actualizarProveedoresFiltrados();
  }

  abrirModal(proveedor: Supplier | null = null): void {
    this.mostrarModal = true;
    this.submitted = false;
    this.proveedorEditando = proveedor;

    this.initForm();

    if (proveedor) {
      this.proveedorForm.patchValue({
        name: proveedor.name,
        codigo: proveedor.codigo,
        razon_social: proveedor.razon_social,
        nombre_comercial: proveedor.nombre_comercial,
        tipo_identificacion: proveedor.tipo_identificacion,
        num_identificacion: proveedor.num_identificacion,
        contacto_principal: proveedor.contacto_principal,
        correo: proveedor.correo,
        telefono: proveedor.telefono,
        direccion: proveedor.direccion,
        dias_credito: proveedor.dias_credito,
        observacion: proveedor.observacion,
        isactive: proveedor.isactive,
      });
    }
  }

  cerrarModal(): void {
    this.mostrarModal = false;
    this.proveedorEditando = null;
    this.submitted = false;
    this.proveedorForm.reset({
      name: '',
      codigo: '',
      razon_social: '',
      nombre_comercial: '',
      tipo_identificacion: '04 - RUC',
      num_identificacion: '',
      contacto_principal: '',
      correo: '',
      telefono: '',
      direccion: '',
      dias_credito: 0,
      observacion: '',
      isactive: true,
    });
  }

  guardarProveedor(): void {
    this.submitted = true;
    if (this.proveedorForm.invalid) {
      this.proveedorForm.markAllAsTouched();
      return;
    }

    const payload = this.proveedorForm.getRawValue();
    const request = this.proveedorEditando
      ? this.suppliersService.update(payload)
      : this.suppliersService.create(payload);

    this.spinner.show();
    request.subscribe({
      next: () => {
        toast.success(this.proveedorEditando ? 'Proveedor actualizado' : 'Proveedor creado');
        this.cerrarModal();
        this.cargarProveedores();
      },
      error: () => {
        this.spinner.hide();
        this.alertService.error('No se pudo guardar el proveedor.');
      }
    });
  }

  eliminarProveedor(name: string): void {
    this.alertService.confirm('Se eliminara el proveedor seleccionado.', 'Confirmar').then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.spinner.show();
      this.suppliersService.delete(name).subscribe({
        next: () => {
          toast.success('Proveedor eliminado');
          this.cargarProveedores();
        },
        error: () => {
          this.spinner.hide();
          this.alertService.error('No se pudo eliminar el proveedor.');
        }
      });
    });
  }

  identificacionLengthValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const tipo = this.proveedorForm?.get('tipo_identificacion')?.value || '';
      const valor: string = control.value || '';

      if (!valor) {
        return null;
      }

      if (tipo.slice(0, 2) === '05' && valor.length !== 10) {
        return { cedulaInvalida: true };
      }

      if (tipo.slice(0, 2) === '04' && valor.length !== 13) {
        return { rucInvalido: true };
      }

      return null;
    };
  }

  getMaxLength(): number {
    const tipo = this.proveedorForm?.get('tipo_identificacion')?.value || '';
    return tipo.slice(0, 2) === '05' ? 10 : 13;
  }

  trackByName = (_: number, item: Supplier) => item?.name || item?.codigo || _;
}
