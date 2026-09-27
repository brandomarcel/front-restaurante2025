import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { InventoryService } from 'src/app/services/inventory.service';

@Component({
  selector: 'app-lite-warehouses',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './lite-warehouses.component.html'
})
export class LiteWarehousesComponent implements OnInit {
  loading = false;
  savingMode = false;
  savingWarehouse = false;
  error = '';

  modalOpen = false;
  editing: any | null = null;
  submitted = false;
  form!: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly inventoryService: InventoryService,
    public readonly capabilities: CompanyCapabilitiesService,
    private readonly alertService: AlertService,
    private readonly frappeError: FrappeErrorService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      warehouse_name: ['', Validators.required],
      establishment: [''],
      is_default: [false],
      status: ['Activo', Validators.required],
      notes: ['']
    });
    this.cargar();
  }

  get canManage(): boolean {
    return this.capabilities.hasPermission('*') || this.capabilities.hasPermission('business.settings.manage');
  }

  /** El traslado entre bodegas es una operación de inventario, no de configuración del negocio. */
  get canTransfer(): boolean {
    return this.capabilities.hasPermission('*')
      || this.capabilities.hasPermission('inventory.manage')
      || this.canManage;
  }

  get activeBusinessId(): string {
    return String(this.capabilities.activeBusinessId || '').trim();
  }

  get inventoryMode(): 'Simple' | 'Por Bodega' {
    return this.capabilities.inventoryMode;
  }

  get warehouses(): any[] {
    return this.capabilities.warehouses;
  }

  get activeEstablishments(): any[] {
    return this.capabilities.activeEstablishments;
  }

  /** Regla 4: no se puede activar "Por Bodega" sin una bodega activa predeterminada. */
  get hasDefaultActiveWarehouse(): boolean {
    return !!this.capabilities.defaultWarehouse;
  }

  /** Regla 5: todos los terminales POS activos deben tener bodega asignada antes de activar el modo. */
  get terminalsWithoutWarehouse(): any[] {
    return this.capabilities.activePosTerminals.filter((terminal: any) => !String(terminal?.warehouse || '').trim());
  }

  get canActivateWarehouseMode(): boolean {
    return this.hasDefaultActiveWarehouse && this.terminalsWithoutWarehouse.length === 0;
  }

  cargar(): void {
    if (!this.activeBusinessId) {
      this.error = 'Selecciona un negocio para administrar el inventario por bodega.';
      return;
    }
    this.loading = true;
    this.error = '';
    this.inventoryService.getInventoryConfiguration().pipe(
      finalize(() => this.loading = false)
    ).subscribe({
      next: (response: any) => this.capabilities.setInventoryConfiguration(response),
      error: (err) => {
        this.error = this.readError(err);
        toast.error(this.error);
      }
    });
  }

  /**
   * Cambiar a "Por Bodega" exige confirmación explícita si el negocio venía
   * en Simple (puede tener stock global que haya que migrar); nunca se envía
   * `migrate_existing_stock` sin que el usuario lo haya decidido.
   */
  async cambiarModo(nextMode: 'Simple' | 'Por Bodega'): Promise<void> {
    if (!this.canManage || this.savingMode || nextMode === this.inventoryMode) return;

    if (nextMode === 'Por Bodega' && !this.canActivateWarehouseMode) {
      if (!this.hasDefaultActiveWarehouse) {
        toast.error('Crea y marca una bodega activa como predeterminada antes de activar "Por Bodega".');
      } else {
        toast.error(`${this.terminalsWithoutWarehouse.length} terminal(es) POS activo(s) no tienen bodega asignada. Asígnala en Terminales POS antes de continuar.`);
      }
      return;
    }

    let migrate = false;
    if (nextMode === 'Por Bodega') {
      const result = await this.alertService.confirm(
        `A partir de ahora el stock se maneja por separado en cada bodega, usando "${this.capabilities.defaultWarehouse?.warehouse_name}" como predeterminada.`,
        'Activar "Por Bodega"'
      );
      if (!result.isConfirmed) return;
      // La migración es una decisión aparte: cancelar esta segunda pregunta
      // igual activa el modo, solo que sin mover el stock global existente.
      const migrateResult = await this.alertService.confirm(
        'Si este negocio ya tiene stock registrado en modo Simple, ¿deseas moverlo a la bodega predeterminada ahora?',
        '¿Migrar el stock existente?'
      );
      migrate = !!migrateResult.isConfirmed;
    } else {
      const result = await this.alertService.confirm(
        'Se volverá a manejar un único stock global para todo el negocio.',
        'Volver a modo Simple'
      );
      if (!result.isConfirmed) return;
    }

    this.savingMode = true;
    this.inventoryService.saveInventoryConfiguration(nextMode, migrate).pipe(
      finalize(() => this.savingMode = false)
    ).subscribe({
      next: () => {
        toast.success(nextMode === 'Por Bodega' ? 'Inventario por bodega activado.' : 'Inventario simple activado.');
        this.cargar();
      },
      error: (err) => toast.error(this.readError(err))
    });
  }

  openCreate(): void {
    if (!this.canManage) return;
    this.editing = null;
    this.submitted = false;
    this.form.reset({ warehouse_name: '', establishment: '', is_default: false, status: 'Activo', notes: '' });
    this.modalOpen = true;
  }

  openEdit(warehouse: any): void {
    if (!this.canManage) return;
    this.editing = warehouse;
    this.submitted = false;
    this.form.reset({
      warehouse_name: warehouse.warehouse_name || '',
      establishment: warehouse.establishment || '',
      is_default: !!warehouse.is_default,
      status: warehouse.status || 'Activo',
      notes: warehouse.notes || ''
    });
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
    this.editing = null;
    this.submitted = false;
  }

  guardar(): void {
    this.submitted = true;
    if (!this.canManage || this.form.invalid) return;
    const value = this.form.getRawValue();

    this.savingWarehouse = true;
    this.inventoryService.saveWarehouse({
      name: this.editing?.name || undefined,
      warehouse_name: String(value.warehouse_name || '').trim(),
      establishment: String(value.establishment || '').trim() || undefined,
      is_default: !!value.is_default,
      status: value.status === 'Inactivo' ? 'Inactivo' : 'Activo',
      notes: String(value.notes || '').trim()
    }).pipe(
      finalize(() => this.savingWarehouse = false)
    ).subscribe({
      next: () => {
        toast.success(this.editing ? 'Bodega actualizada.' : 'Bodega creada.');
        this.closeModal();
        this.cargar();
      },
      error: (err) => toast.error(this.readError(err))
    });
  }

  establishmentLabel(id: string): string {
    const establishment = this.activeEstablishments.find((item: any) => String(item?.name || '') === String(id || ''));
    return establishment ? `${establishment.establishment_code || ''} - ${establishment.establishment_name || establishment.name}` : '—';
  }

  trackByWarehouse = (_index: number, item: any) => String(item?.name || _index);

  private readError(error: any): string {
    const backendMessage = this.frappeError.handle(error);
    if (Number(error?.status) === 403) {
      return backendMessage || 'No tienes permisos para administrar el inventario por bodega.';
    }
    return backendMessage || 'No se pudo completar la operación.';
  }
}
