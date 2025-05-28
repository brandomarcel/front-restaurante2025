import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { NgxSpinnerService } from 'ngx-spinner';
import { CustomersService } from 'src/app/services/customers.service';

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
    private spinner: NgxSpinnerService
  ) { }

  ngOnInit() {

    this.cargarClientes();
    this.initForm();
  }

  initForm(data: any = null) {
   this.clienteForm = this.fb.group({
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
        console.log('res', res);
        this.spinner.hide();

        this.customers = res.data || [];
        this.filteredCustomersList = [...this.customers]; // Inicializar la lista filtrada
        this.filteredCustomersList.sort((a, b) => a.nombre.localeCompare(b.nombre));
      },
      error: (err) => {
        this.spinner.hide();
        console.error('Error al cargar clientes', err);
      },
      complete: () => {
        this.spinner.hide();
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
    console.log('cliente', cliente);
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
      identificationType: '06',
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
      this.customersService.update(this.clienteEditando.name, data).subscribe(() => {
        this.cargarClientes();
        this.cerrarModal();
        this.spinner.hide();
      });
    } else {
      // Crear
      this.spinner.show();
      this.customersService.create(data).subscribe(() => {
        this.spinner.hide();
        this.cargarClientes();
        this.cerrarModal();
      });
    }
  }

  delete(id: string) {
    if (confirm('¿Eliminar este cliente?')) {
      this.customersService.delete(id).subscribe(() => {
        this.cargarClientes();
      });
    }
  }
}
