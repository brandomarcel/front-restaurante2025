import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxPaginationModule } from 'ngx-pagination';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { CategoryService } from 'src/app/services/category.service';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { AlertService } from 'src/app/core/services/alert.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';

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
    private spinner: NgxSpinnerService,
    private alertService: AlertService,
    private frappeErrorService: FrappeErrorService,
    private capabilities: CompanyCapabilitiesService
  ) {}

  ngOnInit() {
    this.resetForm();
    if (!this.canReadCategories) {
      this.alertService.error('No tienes permisos para consultar categorías en la empresa seleccionada.');
      return;
    }
    this.loadCategory();
  }

  get isLiteMode(): boolean { return this.capabilities.isLiteMode; }

  get canReadCategories(): boolean {
    return this.capabilities.isEnabled('products');
  }

  get canManageCategories(): boolean {
    return this.capabilities.isEnabled('products');
  }

  loadCategory() {
    this.spinner.show();
    this.categoryService.getAll().subscribe({
      next: (res: any) => {
        this.spinner.hide();
        const data = Array.isArray(res) ? res : (res?.message?.data ?? res?.data ?? []);
        this.categories = data;
        // ordena por nombre visible
        this.categories.sort((a: any, b: any) => (a?.category_name || a?.nombre || '').localeCompare(b?.category_name || b?.nombre || ''));
        this.actualizarCategoriasFiltradas();
      },
      error: (error: any) => {
        this.spinner.hide();
        this.alertService.error(this.frappeErrorService.handle(error));
      }
    });
  }

  actualizarCategoriasFiltradas() {
    const term = (this._searchTerm || '').toLowerCase();

    let lista = Array.isArray(this.categories) ? [...this.categories] : [];

    lista = lista.filter((c: any) => {
      const byText =
        ((c?.category_name || c?.nombre) && String(c.category_name || c.nombre).toLowerCase().includes(term)) ||
        ((c?.description || c?.descripcion) && String(c.description || c.descripcion).toLowerCase().includes(term)) ||
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
    if (!this.canManageCategories) {
      this.alertService.error('No tienes permiso products.manage para crear o editar categorías.');
      return;
    }

    this.mostrarModal = true;
    this.categoriaEditando = categoria;
    this.resetForm();

    if (categoria) {
      this.categoriaForm.patchValue({
        name: categoria.name || '',
        nombre: categoria.category_name || categoria.nombre || '',
        description: categoria.description || categoria.descripcion || '',
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
    if (!this.canManageCategories) {
      this.alertService.error('No tienes permiso products.manage para guardar categorías.');
      return;
    }

    if (this.categoriaForm.invalid) {
      this.categoriaForm.markAllAsTouched();
      return;
    }

    const formValue = this.categoriaForm.value;

    // CategoryService transforma estos aliases al contrato Lite.
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
        error: (error: any) => {
          toast.error(this.frappeErrorService.handle(error));
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
        error: (error: any) => {
          toast.error(this.frappeErrorService.handle(error));
          this.spinner.hide();
        }
      });
    }
  }

  eliminar(name: string) {
    if (!this.canManageCategories) {
      this.alertService.error('No tienes permiso products.manage para desactivar categorías.');
      return;
    }

    if (confirm('¿Desactivar esta categoría?')) {
      this.spinner.show();
      this.categoryService.delete(name).subscribe({
        next: () => {
          toast.success('Categoría desactivada');
          this.loadCategory();
          this.spinner.hide();
        },
        error: (error: any) => {
          toast.error(this.frappeErrorService.handle(error));
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
