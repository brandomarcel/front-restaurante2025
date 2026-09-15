import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { CategoryService } from 'src/app/services/category.service';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { AlertService } from 'src/app/core/services/alert.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { AppPaginationComponent } from 'src/app/shared/components/pagination/app-pagination.component';

@Component({
  selector: 'app-categorys',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ButtonComponent, AppPaginationComponent],
  templateUrl: './categorys.component.html',
  styleUrl: './categorys.component.css'
})
export class CategorysComponent implements OnInit {
  categories: any[] = [];
  categoriesFiltradasList: any[] = [];

  private _searchTerm = '';
  get searchTerm() { return this._searchTerm; }
  set searchTerm(v: string) {
    this._searchTerm = v || '';
    this.page = 1;
    this.loadCategory();
  }

  // filtro de estado: '' | 'activos' | 'inactivos'
  estadoFiltro: '' | 'activos' | 'inactivos' = '';

  mostrarModal = false;
  categoriaEditando: any = null;

  page = 1;
  pageSize = 10;
  totalCategories = 0;
  totalPages = 1;

  onPaginationPage(page: number): void {
    if (page === this.page) return;
    this.page = page;
    this.loadCategory();
  }
  onPaginationPageSize(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.loadCategory();
  }

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
    return this.capabilities.isEnabled('products') && this.capabilities.hasPermission('products.read');
  }

  get canManageCategories(): boolean {
    return this.capabilities.isEnabled('products') && this.capabilities.hasPermission('products.manage');
  }

  loadCategory() {
    this.spinner.show();
    const offset = (this.page - 1) * this.pageSize;
    const status = this.estadoFiltro === 'activos' ? 'Activo' : this.estadoFiltro === 'inactivos' ? 'Inactivo' : undefined;
    this.categoryService.getAll(undefined, this.pageSize, offset, this._searchTerm, status).subscribe({
      next: (res: any) => {
        this.spinner.hide();
        const message = res?.message ?? res ?? {};
        const data = Array.isArray(message?.data) ? message.data : (Array.isArray(res) ? res : []);
        this.categories = data;
        this.pageSize = Number(message?.limit ?? this.pageSize) || this.pageSize;
        const responseOffset = Number(message?.offset);
        if (Number.isFinite(responseOffset) && responseOffset >= 0) {
          this.page = Math.floor(responseOffset / this.pageSize) + 1;
        }
        this.totalCategories = Number(message?.total ?? this.categories.length) || 0;
        const hasNext = Boolean(message?.has_next ?? message?.hasNext);
        this.totalPages = Math.max(1, Math.ceil(this.totalCategories / this.pageSize), hasNext ? this.page + 1 : 1);
        // ordena por nombre visible
        this.categories.sort((a: any, b: any) => (a?.category_name || a?.nombre || '').localeCompare(b?.category_name || b?.nombre || ''));
        this.categoriesFiltradasList = [...this.categories];
      },
      error: (error: any) => {
        this.spinner.hide();
        this.alertService.error(this.frappeErrorService.handle(error));
      }
    });
  }

  actualizarCategoriasFiltradas() {
    this.page = 1;
    this.loadCategory();
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
