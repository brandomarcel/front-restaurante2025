import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { CategoryService } from 'src/app/services/category.service';

@Component({
  selector: 'app-categorys',
  imports: [CommonModule,FormsModule,ReactiveFormsModule,NgxPaginationModule],
  templateUrl: './categorys.component.html',
  styleUrl: './categorys.component.css'
})
export class CategorysComponent implements OnInit {
  categorias: any[] = [];
  searchTerm: string = '';
  mostrarModal: boolean = false;
  categoriaEditando: any = null;
  page: number = 1;
  pageSize: number = 10;

  categoriaForm!: FormGroup;

  constructor(
    private categoriesService: CategoryService,
    private fb: FormBuilder,
    private spinner: NgxSpinnerService
  ) {}

  ngOnInit() {
    this.cargarCategorias();
    this.resetForm();
  }

  cargarCategorias() {
    this.spinner.show();
    this.categoriesService.getAll().subscribe({
      next: (res:any) => this.categorias = res,
      error: (err:any) => console.error('Error al cargar categorías', err),
      complete: () => this.spinner.hide()
    });
  }

  categoriasFiltradas() {
    return this.categorias.filter(c =>
      c.name.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
  }

  abrirModal(categoria: any = null) {
    this.mostrarModal = true;
    this.categoriaEditando = categoria;
    this.resetForm();
    if (categoria) this.categoriaForm.patchValue(categoria);
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.categoriaEditando = null;
    this.resetForm();
  }

  guardarCategoria() {
    if (this.categoriaForm.invalid) {
      this.categoriaForm.markAllAsTouched();
      return;
    }

    const data = this.categoriaForm.value;
    this.spinner.show();

    if (this.categoriaEditando) {
      this.categoriesService.update(this.categoriaEditando.id, data).subscribe({
        next: () => {
          toast.success('Categoría actualizada');
          this.cargarCategorias();
          this.cerrarModal();
        },
        error: () => toast.error('Error al actualizar'),
        complete: () => this.spinner.hide()
      });
    } else {
      this.categoriesService.create(data).subscribe({
        next: () => {
          toast.success('Categoría creada');
          this.cargarCategorias();
          this.cerrarModal();
        },
        error: () => toast.error('Error al crear'),
        complete: () => this.spinner.hide()
      });
    }
  }

  eliminar(name: string) {
    if (confirm('¿Eliminar esta categoría?')) {
      this.spinner.show();
      this.categoriesService.delete(name).subscribe({
        next: () => {
          toast.success('Categoría eliminada');
          this.cargarCategorias();
        },
        error: () => toast.error('Error al eliminar'),
        complete: () => this.spinner.hide()
      });
    }
  }

  resetForm() {
    this.categoriaForm = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      isActive: [true],
    });
  }

  get f() {
    return this.categoriaForm.controls;
  }
}