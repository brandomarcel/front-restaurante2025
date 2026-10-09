import { CommonModule } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, inject } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { NgxSpinnerService } from 'ngx-spinner';
import { CategoryService } from 'src/app/services/category.service';
import { IconActionButtonComponent } from 'src/app/shared/components/icon-action-button/icon-action-button.component';
import { ListStateComponent } from 'src/app/shared/components/list-state/list-state.component';
import { debouncedCallback } from 'src/app/shared/utils/debounced-callback';
import { AlertService } from 'src/app/core/services/alert.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { AppPaginationComponent } from 'src/app/shared/components/pagination/app-pagination.component';

@Component({
  selector: 'app-categorys',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AppPaginationComponent, IconActionButtonComponent, ListStateComponent],
  templateUrl: './categorys.component.html',
  styleUrl: './categorys.component.css'
})
export class CategorysComponent implements OnInit {
  categories: any[] = [];
  categoriesFiltradasList: any[] = [];

  private _searchTerm = '';
  /** La búsqueda espera a que el usuario deje de escribir: no consulta en cada tecla. */
  private readonly searchSoon = debouncedCallback(inject(DestroyRef), () => {
    this.page = 1;
    this.loadCategory();
  });
  get searchTerm() { return this._searchTerm; }
  set searchTerm(v: string) {
    this._searchTerm = v || '';
    this.searchSoon();
  }

  // filtro de estado: '' | 'activos' | 'inactivos'
  estadoFiltro: '' | 'activos' | 'inactivos' = '';
  readonly estadoOptions: Array<{ value: '' | 'activos' | 'inactivos'; label: string }> = [
    { value: '', label: 'Todas' },
    { value: 'activos', label: 'Activas' },
    { value: 'inactivos', label: 'Inactivas' }
  ];

  loading = false;
  saving = false;
  submitted = false;

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

  get hasActiveFilters(): boolean {
    return !!this._searchTerm.trim() || !!this.estadoFiltro;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.mostrarModal && !this.saving) this.cerrarModal();
  }

  setEstado(value: '' | 'activos' | 'inactivos'): void {
    if (this.estadoFiltro === value) return;
    this.estadoFiltro = value;
    this.actualizarCategoriasFiltradas();
  }

  isActive(categoria: any): boolean {
    return categoria?.isactive === true || categoria?.isactive === 1 || String(categoria?.isactive) === '1';
  }

  categoryName(categoria: any): string {
    return String(categoria?.category_name || categoria?.nombre || categoria?.name || '—');
  }

  categoryDescription(categoria: any): string {
    return String(categoria?.description || categoria?.descripcion || '');
  }

  loadCategory() {
    // El listado muestra su propio esqueleto de carga; el spinner global queda para guardar.
    this.loading = true;
    const offset = (this.page - 1) * this.pageSize;
    const status = this.estadoFiltro === 'activos' ? 'Activo' : this.estadoFiltro === 'inactivos' ? 'Inactivo' : undefined;
    this.categoryService.getAll(undefined, this.pageSize, offset, this._searchTerm, status).subscribe({
      next: (res: any) => {
        this.loading = false;
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
        this.loading = false;
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
    this.submitted = false;
    this.categoriaEditando = categoria;
    this.resetForm();

    if (categoria) {
      this.categoriaForm.patchValue({
        name: categoria.name || '',
        nombre: categoria.category_name || categoria.nombre || '',
        description: categoria.description || categoria.descripcion || '',
        // en el form usamos isActive, pero del backend suele ser isactive
        isActive: categoria.isactive === undefined || categoria.isactive === null ? true : this.isActive(categoria),
      });
    }
  }

  cerrarModal() {
    this.mostrarModal = false;
    this.submitted = false;
    this.categoriaEditando = null;
    this.resetForm();
  }

  guardarCategoria() {
    if (!this.canManageCategories) {
      this.alertService.error('No tienes permiso products.manage para guardar categorías.');
      return;
    }

    this.submitted = true;
    if (this.categoriaForm.invalid) {
      this.categoriaForm.markAllAsTouched();
      return;
    }
    if (this.saving) return;

    const formValue = this.categoriaForm.value;

    // CategoryService transforma estos aliases al contrato Lite.
    // Refuerzo al guardar, no solo al tipear (mismo criterio que Clientes y
    // Productos): una categoría vieja en minúscula que se edita sin retocar
    // el nombre también debe quedar en mayúscula.
    const payload = {
      name: formValue.name,
      nombre: String(formValue.nombre || '').toUpperCase().trim(),
      description: String(formValue.description || '').toUpperCase().trim(),
      isactive: !!formValue.isActive,
    };

    this.spinner.show();
    this.saving = true;

    if (this.categoriaEditando) {
      // Update por name (id)
      this.categoryService.update(this.categoriaEditando.name, payload).subscribe({
        next: () => {
          toast.success('Categoría actualizada');
          this.saving = false;
          this.spinner.hide();
          this.cerrarModal();
          this.loadCategory();
        },
        error: (error: any) => {
          toast.error(this.frappeErrorService.handle(error));
          this.saving = false;
          this.spinner.hide();
        }
      });
    } else {
      this.categoryService.create(payload).subscribe({
        next: () => {
          toast.success('Categoría creada');
          this.saving = false;
          this.spinner.hide();
          this.cerrarModal();
          this.loadCategory();
        },
        error: (error: any) => {
          toast.error(this.frappeErrorService.handle(error));
          this.saving = false;
          this.spinner.hide();
        }
      });
    }
  }

  eliminar(name: string, label = '') {
    if (!this.canManageCategories) {
      this.alertService.error('No tienes permiso products.manage para desactivar categorías.');
      return;
    }

    const mensaje = label
      ? `"${label}" dejará de aparecer al crear productos. Los productos que ya la usan no cambian.`
      : 'La categoría dejará de aparecer al crear productos. Los productos que ya la usan no cambian.';
    this.alertService.confirm(mensaje, 'Desactivar categoría').then((result) => {
      if (!result.isConfirmed) return;
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
    });
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
