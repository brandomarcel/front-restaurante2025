import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CustomersService } from 'src/app/services/customers.service';

@Component({
  selector: 'app-customers',
  imports: [CommonModule, FormsModule],
  templateUrl: './customers.component.html',
  styleUrl: './customers.component.css'
})
export class CustomersComponent implements OnInit {
  customers: any[] = [];
  searchTerm = '';

  mostrarModal = false;
  clienteEditando: any = null;
  clienteForm = this.resetForm();

  constructor(private customersService: CustomersService) { }

  ngOnInit() {
    this.cargarClientes();
  }

  cargarClientes() {
    this.customersService.getAll().subscribe((res) => {
      this.customers = res;
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
    this.clienteEditando = cliente;
    this.clienteForm = cliente ? { ...cliente } : this.resetForm();
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.clienteEditando = null;
    this.clienteForm = this.resetForm();
  }

  guardarCliente() {
    if (this.clienteEditando) {

      this.customersService.update(this.clienteEditando.id, this.clienteForm).subscribe(() => {
        this.cargarClientes();
        this.cerrarModal();
      })

    } else {

      this.customersService.create(this.clienteForm).subscribe(() => {
        this.cargarClientes();
        this.cerrarModal();
      })
    }
  }

  eliminarCliente(id: number) {
    if (confirm('¿Eliminar este cliente?')) {
      this.customersService.delete(id).subscribe(() => {
        this.cargarClientes();
      })
    }
  }

  resetForm() {
    return {
      fullName: '',
      identification: '',
      identificationType: '06',
      email: '',
      phone: '',
    };
  }
}
