import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CustomersService } from 'src/app/services/customers.service';
import { AlertService } from '../../core/services/alert.service';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { IconActionButtonComponent } from 'src/app/shared/components/icon-action-button/icon-action-button.component';
import { VARIABLE_CONSTANTS } from 'src/app/core/constants/variable.constants';
import { AppPaginationComponent } from 'src/app/shared/components/pagination/app-pagination.component';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';

@Component({
  selector: 'app-customers',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonComponent, AppPaginationComponent, IconActionButtonComponent],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.css'
})
export class CustomersComponent implements OnInit {
  identificationTypes = VARIABLE_CONSTANTS.IDENTIFICATION_TYPE; // Lista de estados para el dropdown

  customers: any[] = [];
  filteredCustomersList: any[] = [];

  _searchTerm = '';
  get searchTerm() { return this._searchTerm; }
  set searchTerm(v: string) { this._searchTerm = v || ''; this.filtrarClientes(); }

  mostrarModal = false;
  clienteEditando: any = null;
  submitted = false;
  clienteForm!: FormGroup;

  page = 1;
  pageSize = 10;
  totalCustomers = 0;
  totalPages = 1;

  onPaginationPage(page: number): void {
    if (page === this.page) return;
    this.page = page;
    this.cargarClientes();
  }
  onPaginationPageSize(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.cargarClientes();
  }

  constructor(
    private customersService: CustomersService,
    private fb: FormBuilder,
    private spinner: NgxSpinnerService,
    private frappeErrorService: FrappeErrorService,
    private alertService: AlertService,
    private capabilities: CompanyCapabilitiesService
  ) { }

  ngOnInit() {
    if (!this.canReadCustomers) {
      this.alertService.error('No tienes permisos para consultar clientes en la empresa seleccionada.');
      return;
    }
    this.cargarClientes();
    this.initForm();
  }

  get canReadCustomers(): boolean {
    return this.capabilities.isEnabled('customers') && this.capabilities.hasPermission('customers.read');
  }

  get canManageCustomers(): boolean {
    return this.capabilities.isEnabled('customers') && this.capabilities.hasPermission('customers.manage');
  }

  initForm(data: any = null) {
    this.clienteForm = this.fb.group({
      name: [''],
      nombre: ['', Validators.required],
      num_identificacion: ['', [Validators.required]],
      tipo_identificacion: ['05 - Cedula', Validators.required], // valor por defecto útil
      correo: ['', [Validators.required, Validators.email]],
      telefono: ['', Validators.required],
      direccion: ['', Validators.required],
      isactive: [true]
    });

    // ✅ aplica tu validador de longitud según el tipo seleccionado
    this.f['num_identificacion'].addValidators(this.identificacionLengthValidator());
    this.f['tipo_identificacion'].valueChanges.subscribe(() => {
      this.f['num_identificacion'].updateValueAndValidity({ emitEvent: false });
    });
  }

  get f() { return this.clienteForm.controls; }

  cargarClientes() {
    this.spinner.show();
    const offset = (this.page - 1) * this.pageSize;
    this.customersService.getAll(1, this.pageSize, offset, this._searchTerm).subscribe({
      next: (res: any) => {
        this.spinner.hide();
        const message = res?.message ?? res ?? {};
        this.customers = Array.isArray(message?.data) ? message.data : (Array.isArray(res) ? res : []);
        this.pageSize = Number(message?.limit ?? this.pageSize) || this.pageSize;
        const responseOffset = Number(message?.offset);
        if (Number.isFinite(responseOffset) && responseOffset >= 0) {
          this.page = Math.floor(responseOffset / this.pageSize) + 1;
        }
        this.totalCustomers = Number(message?.total ?? this.customers.length) || 0;
        const hasNext = Boolean(message?.has_next ?? message?.hasNext);
        this.totalPages = Math.max(1, Math.ceil(this.totalCustomers / this.pageSize), hasNext ? this.page + 1 : 1);
        this.filteredCustomersList = [...this.customers].sort((a, b) =>
          (a.nombre || '').localeCompare(b.nombre || '')
        );
      },
      error: (err) => {
        this.spinner.hide();
        const mensaje: any = this.frappeErrorService.handle(err);
        this.alertService.error(mensaje);
        console.error('Error al cargar clientes', err);
      },
        complete: () => {
          this.spinner.hide();
        }
    });
  }

  filtrarClientes() {
    this.page = 1;
    this.cargarClientes();
  }

  abrirModal(cliente: any = null) {
    if (!this.canManageCustomers) {
      this.alertService.error('No tienes permisos para administrar clientes.');
      return;
    }
    this.mostrarModal = true;
    this.submitted = false;
    this.clienteEditando = cliente;

    this.initForm(); // reinicia validadores/estado

    if (cliente) {
      // ✅ nombres consistentes con tu backend
      this.clienteForm.patchValue({
        name: cliente.name,
        nombre: cliente.nombre,
        num_identificacion: cliente.num_identificacion,
        tipo_identificacion: cliente.tipo_identificacion || '05 - Cedula',
        correo: cliente.correo,
        telefono: cliente.telefono,
        direccion: cliente.direccion,
        isactive: cliente.isactive ?? true,
      });
    }
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.clienteEditando = null;
    this.submitted = false;
    this.clienteForm.reset({
      name: '',
      nombre: '',
      num_identificacion: '',
      tipo_identificacion: '05 - Cedula',
      correo: '',
      telefono: '',
      direccion: '',
      isactive: true
    });
  }

  guardarCliente() {
    if (!this.canManageCustomers) {
      this.alertService.error('No tienes permisos para administrar clientes.');
      return;
    }
    this.submitted = true;
    if (this.clienteForm.invalid) return;

    const data = this.clienteForm.getRawValue();
    // Refuerzo al guardar, no solo al tipear: un cliente antiguo guardado en
    // minúscula que se edita sin retocar el nombre/dirección (por ejemplo,
    // solo se actualiza el teléfono) también debe quedar en mayúscula.
    data.nombre = String(data.nombre || '').toUpperCase().trim();
    data.direccion = String(data.direccion || '').toUpperCase().trim();

    if (this.clienteEditando) {
      this.spinner.show();
      this.customersService.update(data).subscribe({
        next: () => {
          this.spinner.hide();
          toast.success('Cliente actualizado');
          this.cerrarModal();
          this.cargarClientes();
        },
        error: (error: any) => {
          const mensaje: any = this.frappeErrorService.handle(error);
          this.alertService.error(mensaje);
          this.spinner.hide();
        },
        complete: () => {
          this.spinner.hide();
        }
      });
    } else {
      this.spinner.show();
      this.customersService.create(data).subscribe({
        next: () => {
          this.spinner.hide();
          toast.success('Cliente creado exitosamente');
          this.cerrarModal();
          this.cargarClientes();
        },
        error: (error: any) => {
          const mensaje: any = this.frappeErrorService.handle(error);
          console.log('Error al crear cliente', error);
          this.alertService.error(mensaje);
          this.spinner.hide();
        },
        complete: () => {
          this.spinner.hide();
        }
      });
    }
  }

  delete(id: string) {
    if (!this.canManageCustomers) {
      this.alertService.error('No tienes permisos para administrar clientes.');
      return;
    }

    this.alertService.confirm('Estás seguro de eliminar este cliente?', 'Confirmar').then((result) => {
      if (result.isConfirmed) {
        this.spinner.show();
        this.customersService.delete(id).subscribe({
          next: () => {
            toast.success('Cliente eliminado');
            this.cargarClientes();
            this.spinner.hide();
          },
          error: (err) => {
            this.spinner.hide();
            const mensaje: any = this.frappeErrorService.handle(err);
            console.error('Error al eliminar cliente', err);
            this.alertService.error(mensaje);

          },


        });
      }
    })

  }

  // ===== Validadores / helpers =====
  identificacionLengthValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const tipo = this.clienteForm?.get('tipo_identificacion')?.value || '';
      const valor: string = control.value || '';

      // Solo validamos si hay algo escrito
      if (!valor) return null;

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
    const tipo = this.clienteForm?.get('tipo_identificacion')?.value || '';
    return tipo.slice(0, 2) === '05' ? 10 : 13;
  }

  // trackBy para rendimiento
  trackById = (_: number, item: any) => item?.name || item?.num_identificacion || _;
}
