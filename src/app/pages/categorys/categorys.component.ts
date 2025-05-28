import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { CategoryService } from 'src/app/services/category.service';

@Component({
  selector: 'app-categorys',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgxPaginationModule],
  templateUrl: './categorys.component.html',
  styleUrl: './categorys.component.css'
})
export class CategorysComponent implements OnInit {
  categories: any[] = [];
  categoriesFiltradasList: any[] = [];

  private _searchTerm: string = '';
  mostrarModal: boolean = false;
  categoriaEditando: any = null;
  page: number = 1;
  pageSize: number = 10;

  categoriaForm!: FormGroup;

  constructor(
    private categoryService: CategoryService,
    private fb: FormBuilder,
    private spinner: NgxSpinnerService
  ) { }

  ngOnInit() {
    this.loadCategory();
    this.resetForm();
  }

  loadCategory() {
    this.spinner.show();
    this.categoryService.getAll().subscribe((res: any) => {
      this.spinner.hide();
      this.categories = res.data || [];
      this.categoriesFiltradasList = [...this.categories]; // Inicializar la lista filtrada
      this.categories.sort((a, b) => a.name.localeCompare(b.name));
      console.log(' this.categories', this.categories);
    });
  }
  get searchTerm(): string {
    return this._searchTerm;
  }

  set searchTerm(value: string) {
    this._searchTerm = value;
    this.actualizarCategoriasFiltradas(); // se actualiza cada vez que el usuario escribe
  }
  actualizarCategoriasFiltradas() {
    const term = this._searchTerm.toLowerCase();
    this.categoriesFiltradasList = this.categories.filter(p =>
      p.name.toLowerCase().includes(term)
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
      this.categoryService.update(this.categoriaEditando.name, data).subscribe({
        next: () => {
          toast.success('Categoría actualizada');
          this.loadCategory();
          this.cerrarModal();
          this.spinner.hide()
        },
        error: () => {
          toast.error('Error al actualizar')
          this.spinner.hide()
        },
        complete: () => this.spinner.hide()
      });
    } else {
      this.categoryService.create(data).subscribe({
        next: () => {
          toast.success('Categoría creada');
          this.loadCategory();
          this.cerrarModal();
          this.spinner.hide()
        },
        error: () => {
          toast.error('Error al crear')
          this.spinner.hide()
        },
        complete: () => this.spinner.hide()
      });
    }
  }

  eliminar(name: string) {
    if (confirm('¿Eliminar esta categoría?')) {
      this.spinner.show();
      this.categoryService.delete(name).subscribe({
        next: () => {
          toast.success('Categoría eliminada');
          this.loadCategory();
          this.spinner.hide()
        },
        error: () => {
          toast.error('Error al eliminar')
          this.spinner.hide()
        },
        complete: () => this.spinner.hide()
      });
    }
  }

  resetForm() {
    this.categoriaForm = this.fb.group({
      name: [''],
      nombre: ['', Validators.required],
      description: [''],
      isActive: [true],
    });
  }

  get f() {
    return this.categoriaForm.controls;
  }
}