import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CustomersService } from 'src/app/services/customers.service';
import Swal from 'sweetalert2'
import { AlertService } from '../../core/services/alert.service';
@Component({
  selector: 'app-customers',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgxPaginationModule],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.css'
})


export class CustomersComponent implements OnInit {


  customers: any[] = [];
  private _searchTerm: string = '';
  filteredCustomersList: any[] = []; // reemplaza filteredCustomers()
  mostrarModal = false;
  clienteEditando: any = null;
  submitted = false;
  clienteForm!: FormGroup;
  page = 1;         // Página actual
  pageSize = 10;    // Elementos por página


  constructor(
    private customersService: CustomersService,
    private fb: FormBuilder,
    private spinner: NgxSpinnerService,
    private frappeErrorService: FrappeErrorService,
    private alertService: AlertService
  ) { }

  ngOnInit() {

    this.cargarClientes();
    this.initForm();
  }

  initForm(data: any = null) {
    this.clienteForm = this.fb.group({
      name: [''],
      nombre: ['', Validators.required],
      num_identificacion: ['', Validators.required],
      tipo_identificacion: ['', Validators.required],
      correo: ['', [Validators.required, Validators.email]],
      telefono: ['', Validators.required],
      direccion: ['', Validators.required],
      isactive: [1]
    });


  }

  get searchTerm(): string {
    return this._searchTerm;
  }

  set searchTerm(value: string) {
    this._searchTerm = value;
    this.filtrarClientes();
  }
  get f() {
    return this.clienteForm.controls;
  }

  cargarClientes() {

    this.spinner.show();
    this.customersService.getAll().subscribe({
      next: (res: any) => {
        this.spinner.hide();

        this.customers = res.message.data || [];
        this.filteredCustomersList = [...this.customers]; // Inicializar la lista filtrada
        this.filteredCustomersList.sort((a, b) => a.nombre.localeCompare(b.nombre));

      },
      error: (err) => {
        this.spinner.hide();
        const mensaje: any = this.frappeErrorService.handle(err);
        this.alertService.error(mensaje);
        console.error('Error al cargar clientes', err);
      }
    });
  }


  filtrarClientes() {
    const term = this._searchTerm.toLowerCase();
    this.filteredCustomersList = this.customers.filter(c =>
      (c.fullName && c.fullName.toLowerCase().includes(term)) ||
      (c.identification && c.identification.toLowerCase().includes(term))
    );
  }

  abrirModal(cliente: any = null) {
    this.mostrarModal = true;
    this.submitted = false;
    this.clienteEditando = cliente;

    if (cliente) {
      this.clienteForm.patchValue({
        ...cliente
      });
    }

  }

  cerrarModal() {
    this.mostrarModal = false;
    this.clienteEditando = null;
    this.submitted = false;
    this.clienteForm.reset({
      fullName: '',
      identification: '',
      identificationType: '',
      email: '',
      phone: '',
      address: ''
    });
  }

  guardarCliente() {
    this.submitted = true;
    if (this.clienteForm.invalid) return;

    const data = this.clienteForm.getRawValue();

    if (this.clienteEditando) {
      this.spinner.show();
      // Actualizar
      this.customersService.update(data).subscribe({
        next: () => {
          this.spinner.hide();
          this.cerrarModal();
          toast.success('Cliente actualizado');
          this.cargarClientes();
        },
        error: (error: any) => {
          const mensaje: any = this.frappeErrorService.handle(error); 
          this.alertService.error(mensaje);
          this.spinner.hide();
        }
      });

    } else {
      // Crear
      this.spinner.show();
      this.customersService.create(data).subscribe({
        next: () => {
          this.spinner.hide();
           toast.success('Cliente creado exitosamente');
          this.cargarClientes();
          this.cerrarModal();
        },
        error: (error: any) => {
          const mensaje: any = this.frappeErrorService.handle(error); 
          this.alertService.error(mensaje);
          this.spinner.hide();
        }

      });
    }
  }

  delete(id: string) {
    if (confirm('¿Eliminar este cliente?')) {
      this.customersService.delete(id).subscribe({
        next: () => {
          toast.success('Cliente eliminado');
          this.cargarClientes();
        },
        error: (err) => {
          const mensaje: any = this.frappeErrorService.handle(err);
          console.error('Error al eliminar cliente', err);
          this.alertService.error(mensaje);
        }
      });
    }
  }


    identificacionLengthValidator(): ValidatorFn {
      return (control: AbstractControl): ValidationErrors | null => {
        const tipo = this.clienteForm?.get('tipo_identificacion')?.value;
        const valor = control.value;
        console.log('tipo', tipo);
        console.log('valor', valor);
  
        if (!valor) return null;
        if (tipo.slice(0, 2) === '05' && valor?.length !== 10) {
          return { cedulaInvalida: true };
        }
  
        if (tipo.slice(0, 2) === '04' && valor?.length !== 13) {
          return { rucInvalido: true };
        }
  
        return null; // válido
      };
  
  
    }
  
    getMaxLength(): number {
      const tipo = this.clienteForm?.get('tipo_identificacion')?.value;
      if (tipo?.slice(0, 2) === '05') {
        return 10; // cédula
      }
      return 13; // RUC u otros
    }

}
