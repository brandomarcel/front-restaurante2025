import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgxSpinnerService } from 'ngx-spinner';
import { ProductsService } from 'src/app/services/products.service';

import { toast } from 'ngx-sonner';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { CategoryService } from 'src/app/services/category.service';

@Component({
  selector: 'app-products',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgxPaginationModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css'
})
export class ProductsComponent implements OnInit {
  productos: any[] = [];
  categories: any[] = [];
  searchTerm = '';
  mostrarModal = false;
  productoEditando: any = null;
  productoForm!: FormGroup;
  page = 1;
  pageSize = 10;

  constructor(
    private productsService: ProductsService,
    private categoriesService: CategoryService,
    public spinner: NgxSpinnerService,
    private fb: FormBuilder
  ) { }

  ngOnInit() {
    this.cargarProductos();
    this.cargarCategorias();
  }

  cargarProductos() {
    this.spinner.show();
    this.productsService.getAll().subscribe({
      next: (res) => this.productos = res,
      error: (err) => console.error('Error al cargar productos', err),
      complete: () => this.spinner.hide()
    });
  }

  cargarCategorias() {
    this.categoriesService.getAll().subscribe({
      next: (res) => this.categories = res,
      error: (err) => console.error('Error al cargar categorías', err)
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
    this.resetForm();
    if (producto) {
      this.productoForm.patchValue({
        ...producto,
        categoryId: producto.category?.id
      });
    }
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.productoEditando = null;
    this.resetForm();
  }

  guardarProducto() {
    if (this.productoForm.invalid) {
      this.productoForm.markAllAsTouched();
      return;
    }

    if (this.productoEditando) {
      this.updateProduct();
    } else {
      this.createProduct();
    }
  }

  createProduct() {
    this.spinner.show();
    const data = this.productoForm.value;
    console.log('data', data);
    this.productsService.create(data).subscribe({
      next: () => {
        toast.success('Producto creado con éxito');
        this.cargarProductos();
        this.cerrarModal();
      },
      error: (err) => {
        toast.error('Error al crear el producto');
        console.error(err);
      },
      complete: () => this.spinner.hide()
    });
  }

  updateProduct() {
    this.spinner.show();
    const data = this.productoForm.value;
    console.log('data', data);
    this.productsService.update(this.productoEditando.id, data).subscribe({
      next: () => {
        toast.success('Producto actualizado con éxito');
        this.cerrarModal();
        this.cargarProductos();
      },
      error: (err) => {
        toast.error('Error al actualizar el producto');
        console.error(err);
      },
      complete: () => this.spinner.hide()
    });
  }

  eliminar(id: number) {
    if (confirm('¿Eliminar este producto?')) {
      this.spinner.show();
      this.productsService.delete(id).subscribe({
        next: () => {
          toast.success('Producto eliminado con éxito');
          this.cargarProductos();
        },
        error: (err) => {
          toast.error('Error al eliminar el producto');
          console.error(err);
        },
        complete: () => this.spinner.hide()
      });
    }
  }

  resetForm() {
    return this.productoForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      price: [null, [Validators.required, Validators.min(0)]],
      tax: ['0.00', Validators.required],
      categoryId: ['', Validators.required], // ahora es categoryId
      code: [''],
      barcode: [''],
      isActive: [true]
    });
  }

  get f() {
    return this.productoForm.controls;
  }
}
