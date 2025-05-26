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
  searchTerm = '';
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
      fullName: [data?.fullName || '', [Validators.required]],
      identification: [data?.identification || '', [Validators.required]],
      identificationType: [data?.identificationType || '04', [Validators.required]],
      email: [data?.email || '', [Validators.required, Validators.email]],
      phone: [data?.phone || '', [Validators.required]],
      address: [data?.address || '', [Validators.required]],
    });
  }

  get f() {
    return this.clienteForm.controls;
  }

  cargarClientes() {

    this.spinner.show();
    this.customersService.getAll().subscribe({
      next: (res: any) => {
        this.spinner.hide();

        this.customers = res || [];
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


  filteredCustomers() {
    return this.customers.filter(c =>
      c.fullName.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      c.identification.includes(this.searchTerm)
    );
  }

  abrirModal(cliente: any = null) {
    this.mostrarModal = true;
    this.submitted = false;
    this.clienteEditando = cliente;
    this.initForm(cliente); // inicializa el form con o sin datos
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

    const data = this.clienteForm.value;

    if (this.clienteEditando) {
      this.spinner.show();
      // Actualizar
      this.customersService.update(this.clienteEditando.id, data).subscribe(() => {
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

  eliminarCliente(id: number) {
    if (confirm('¿Eliminar este cliente?')) {
      this.customersService.delete(id).subscribe(() => {
        this.cargarClientes();
      });
    }
  }
}
