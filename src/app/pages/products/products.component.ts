import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NgxSpinnerService } from 'ngx-spinner';
import { ProductsService } from 'src/app/services/products.service';

import { toast } from 'ngx-sonner';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { CategoryService } from 'src/app/services/category.service';
import { TaxesService } from 'src/app/services/taxes.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { AlertService } from 'src/app/core/services/alert.service';

@Component({
  selector: 'app-products',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgxPaginationModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css'
})
export class ProductsComponent implements OnInit {
  productos: any[] = [];
  productosFiltradosList: any[] = [];

  categories: any[] = [];

  taxes: any[] = [];
  private _searchTerm: string = '';
  mostrarModal = false;
  productoEditando: any = null;
  productoForm!: FormGroup;
  page = 1;
  pageSize = 20;

  constructor(
    private productsService: ProductsService,
    private categoryService: CategoryService,
    private taxesService: TaxesService,
    public spinner: NgxSpinnerService,
    private fb: FormBuilder,
    private frappeErrorService: FrappeErrorService,
    private alertService: AlertService
  ) { }

  ngOnInit() {
    this.cargarProductos();
    this.loadCategory();
    this.loadTaxes();
  }

  cargarProductos() {
    this.spinner.show();
    this.productsService.getAll().subscribe({
      next: (res: any) => {
        this.productos = res.data;
        this.productosFiltradosList = res.data; // Inicializar la lista filtrada
        this.productosFiltradosList.sort((a, b) => a.name.localeCompare(b.name));
        console.log('Productos cargados:', this.productos);
      },
      error: (error: any) => {
        const mensaje: any = this.frappeErrorService.handle(error);
        this.alertService.error(mensaje);
      }
    });
  }

  loadCategory() {
    this.spinner.show();
    this.categoryService.getAll().subscribe((res: any) => {
      this.spinner.hide();
      this.categories = res.data || [];
      console.log(' this.categories', this.categories);
    });
  }
  loadTaxes() {
    this.spinner.show();
    this.taxesService.getAll().subscribe((res: any) => {
      this.spinner.hide();
      this.taxes = res.data || [];
      console.log(' this.taxes', this.taxes);
    });
  }

  get searchTerm(): string {
    return this._searchTerm;
  }

  set searchTerm(value: string) {
    this._searchTerm = value;
    this.actualizarProductosFiltrados(); // se actualiza cada vez que el usuario escribe
  }

  actualizarProductosFiltrados() {
    const term = this._searchTerm.toLowerCase();

    this.productosFiltradosList = this.productos.filter(p => {
      const nombre = p.nombre.toLowerCase();
      const estadoStock = p.is_out_of_stock === 1 ? 'agotado' : 'disponible';

      return nombre.includes(term) || estadoStock.includes(term);
    });
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
        this.spinner.hide();
      },
      error: (error: any) => {
        const mensaje: any = this.frappeErrorService.handle(error);
        this.alertService.error(mensaje);
        this.spinner.hide();
      }
    });
  }

  updateProduct() {
    this.spinner.show();
    const data = this.productoForm.value;
    console.log('data', data);
    console.log('productoEditando', this.productoEditando);
    this.productsService.update(this.productoEditando.name, data).subscribe({
      next: () => {
        toast.success('Producto actualizado con éxito');
        this.cerrarModal();
        this.cargarProductos();
        this.spinner.hide();
      },
      error: (err) => {
        toast.error('Error al actualizar el producto');
        console.error(err);
        const mensaje: any = this.frappeErrorService.handle(err);
        this.alertService.error(mensaje);
        this.spinner.hide();
      }
    });
  }

  eliminar(id: string) {
    if (confirm('¿Eliminar este producto?')) {
      this.spinner.show();
      this.productsService.delete(id).subscribe({
        next: () => {
          toast.success('Producto eliminado con éxito');
          this.cargarProductos();
          this.spinner.hide();
        },
        error: (err) => {
          const mensaje: any = this.frappeErrorService.handle(err);
          this.alertService.error(mensaje);
          this.spinner.hide();
        }
      });
    }
  }

  resetForm() {
    return this.productoForm = this.fb.group({
      nombre: ['', Validators.required],
      descripcion: [''],
      precio: [null, [Validators.required, Validators.min(0)]],
      tax: ['IVA-0', Validators.required],
      categoria: ['', Validators.required], // ahora es categoryId
      codigo: [''],
      isactive: [true],
      is_out_of_stock: [false]
    });
  }

  get f() {
    return this.productoForm.controls;
  }


  getNameCategory(categoryId: string): string {
    const document = this.categories.find(d => d.name === categoryId);
    return document ? document.nombre : 'No disponible';
  }
}
