import { NgxPaginationModule } from 'ngx-pagination';
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductsService } from 'src/app/services/products.service';
import { toast } from 'ngx-sonner';

@Component({
  selector: 'app-products',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgxPaginationModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css'
})
export class ProductsComponent implements OnInit {
  productos: any[] = [];
  searchTerm = '';
  categories = ['Entrada', 'Sopas', 'Adicionales', 'Bebidas', 'Postres', 'Platos_Fuertes', 'Burguers'];

  mostrarModal = false;
  productoEditando: any = null;
  productoForm!: FormGroup;
  page = 1;
  pageSize = 10;

  constructor(private productsService: ProductsService,
    private fb: FormBuilder
  ) { }

  ngOnInit() {
    this.cargarProductos();
  }

  cargarProductos() {
    this.productsService.getAll().subscribe((res) => {
      this.productos = res;
    });
  }

  productosFiltrados() {
    return this.productos.filter(p =>
      p.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.includes(this.searchTerm))
    );
  }

  abrirModal(producto: any = null) {
    this.mostrarModal = true;
    this.productoEditando = producto;
    console.log('productoEditando', this.productoEditando);
    this.resetForm();
    this.productoForm.patchValue(producto);
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.productoEditando = null;
    this.productoForm = this.resetForm();
  }

  guardarProducto() {

    if (this.productoForm.invalid) {
      this.productoForm.markAllAsTouched();
      return;
    }

    if (this.productoEditando) {
      // Actualizar
      this.updateProduct();
    } else {

      this.createProduct();
    }
  }

  createProduct() {
    // Crear
    this.productsService.create(this.productoForm.value).subscribe({
      next: () => {
        toast.success('Producto creado con éxito');
        this.cargarProductos();
        this.cerrarModal();
      },
      error: (err) => {
        toast.error('Error al crear el producto');
        console.error('Error al crear el producto', err);
        alert('Error al crear el producto');
      }
    });
  }

  updateProduct() {

    this.productsService.update(this.productoEditando.id, this.productoForm.value).subscribe({
      next: () => {
        toast.success('Producto actualizado con éxito');
        this.cerrarModal();
        this.cargarProductos();
      },
      error: (err) => {
        toast.error('Error al actualizar el producto');
        console.error('Error al actualizar el producto', err);
        alert('Error al actualizar el producto');
      }
    });
  }


  eliminar(id: number) {
    if (confirm('¿Eliminar este producto?')) {
      this.productsService.delete(id).subscribe(() => {
        this.cargarProductos();

      })

    }
  }

  // helper para saber si mostrar errores
  get f() {
    return this.productoForm.controls;
  }

  resetForm() {
    console.log('resetForm');
    return this.productoForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      price: [null, [Validators.required, Validators.min(0)]],
      tax: ['0.12', Validators.required],
      category: ['', Validators.required],
      code: [''],
      barcode: [''],
      isActive: [true]
    });
  }
}
