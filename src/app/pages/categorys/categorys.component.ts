import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { CategoryService } from 'src/app/services/category.service';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';

@Component({
  selector: 'app-categorys',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgxPaginationModule,ButtonComponent],
  templateUrl: './categorys.component.html',
  styleUrl: './categorys.component.css'
})
export class CategorysComponent implements OnInit {
  categories: any[] = [];
  categoriesFiltradasList: any[] = [];

  private _searchTerm = '';
  get searchTerm() { return this._searchTerm; }
  set searchTerm(v: string) { this._searchTerm = v || ''; this.actualizarCategoriasFiltradas(); }

  // filtro de estado: '' | 'activos' | 'inactivos'
  estadoFiltro: '' | 'activos' | 'inactivos' = '';

  mostrarModal = false;
  categoriaEditando: any = null;

  page = 1;
  pageSize = 10;

  categoriaForm!: FormGroup;

  constructor(
    private categoryService: CategoryService,
    private fb: FormBuilder,
    private spinner: NgxSpinnerService
  ) {}

  ngOnInit() {
    this.loadCategory();
    this.resetForm();
  }

  loadCategory() {
    this.spinner.show();
    this.categoryService.getAll().subscribe({
      next: (res: any) => {
        this.spinner.hide();
        // según tu API, a veces usas res.data, otras res.message.data
        const data = res?.data ?? res?.message?.data ?? [];
        this.categories = data;
        // ordena por nombre visible
        this.categories.sort((a: any, b: any) => (a?.nombre || '').localeCompare(b?.nombre || ''));
        this.actualizarCategoriasFiltradas();
      },
      error: () => {
        this.spinner.hide();
        toast.error('Error al cargar categorías');
      }
    });
  }

  actualizarCategoriasFiltradas() {
    const term = (this._searchTerm || '').toLowerCase();

    let lista = Array.isArray(this.categories) ? [...this.categories] : [];

    lista = lista.filter((c: any) => {
      const byText =
        (c?.nombre && c.nombre.toLowerCase().includes(term)) ||
        (c?.description && c.description.toLowerCase().includes(term)) ||
        (c?.name && c.name.toLowerCase().includes(term));

      const activo = !!c?.isactive; // del backend suele venir isactive
      const byEstado =
        this.estadoFiltro === ''
          ? true
          : this.estadoFiltro === 'activos'
            ? activo
            : !activo;

      return byText && byEstado;
    });

    this.categoriesFiltradasList = lista;
  }

  limpiarFiltros() {
    this._searchTerm = '';
    this.estadoFiltro = '';
    this.actualizarCategoriasFiltradas();
  }

  abrirModal(categoria: any = null) {
    this.mostrarModal = true;
    this.categoriaEditando = categoria;
    this.resetForm();

    if (categoria) {
      this.categoriaForm.patchValue({
        name: categoria.name || '',
        nombre: categoria.nombre || '',
        description: categoria.description || '',
        // en el form usamos isActive, pero del backend suele ser isactive
        isActive: categoria.isactive ?? true,
      });
    }
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

    const formValue = this.categoriaForm.value;

    // Mapea al payload del backend: isactive en lugar de isActive
    const payload = {
      name: formValue.name,
      nombre: formValue.nombre,
      description: formValue.description,
      isactive: !!formValue.isActive,
    };

    this.spinner.show();

    if (this.categoriaEditando) {
      // Update por name (id)
      this.categoryService.update(this.categoriaEditando.name, payload).subscribe({
        next: () => {
          toast.success('Categoría actualizada');
          this.loadCategory();
          this.cerrarModal();
          this.spinner.hide();
        },
        error: () => {
          toast.error('Error al actualizar');
          this.spinner.hide();
        }
      });
    } else {
      this.categoryService.create(payload).subscribe({
        next: () => {
          toast.success('Categoría creada');
          this.loadCategory();
          this.cerrarModal();
          this.spinner.hide();
        },
        error: () => {
          toast.error('Error al crear');
          this.spinner.hide();
        }
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
          this.spinner.hide();
        },
        error: () => {
          toast.error('Error al eliminar');
          this.spinner.hide();
        }
      });
    }
  }

  resetForm() {
    this.categoriaForm = this.fb.group({
      name: [''],
      nombre: ['', Validators.required],
      description: [''],
      isActive: [true], // UI
    });
  }

  get f() {
    return this.categoriaForm.controls;
  }

  // trackBy para rendimiento
  trackByName = (_: number, item: any) => item?.name || item?.nombre || _;
}
