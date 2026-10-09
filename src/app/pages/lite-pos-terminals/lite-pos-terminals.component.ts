import { CommonModule } from '@angular/common';
import { Component, DoCheck, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CompanyService } from 'src/app/services/company.service';
import { UserService } from 'src/app/services/user.service';
import { InventoryService } from 'src/app/services/inventory.service';
import { FiscalSetupHeaderComponent } from 'src/app/shared/components/fiscal-setup-header/fiscal-setup-header.component';
import { fiscalSeries } from 'src/app/core/utils/fiscal-setup';

@Component({
  selector: 'app-lite-pos-terminals',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, FiscalSetupHeaderComponent],
  templateUrl: './lite-pos-terminals.component.html'
})
export class LitePosTerminalsComponent implements OnInit, DoCheck {
  terminals: any[] = [];
  businessUsers: any[] = [];
  form!: FormGroup;
  editing: any | null = null;
  modalOpen = false;
  loading = false;
  usersLoading = false;
  saving = false;
  error = '';
  submitted = false;
  selectedUserIds: string[] = [];
  userSearch = '';

  private loadedBusiness = '';
  private requestId = 0;

  constructor(
    private readonly fb: FormBuilder,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
    private readonly capabilities: CompanyCapabilitiesService,
    private readonly inventoryService: InventoryService,
    private readonly frappeError: FrappeErrorService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      terminal_name: ['', Validators.required],
      establishment: ['', Validators.required],
      emission_point: ['', Validators.required],
      warehouse: [''],
      status: ['Activo', Validators.required]
    });
    this.loadForBusiness();
    this.loadWarehousesIfNeeded();
  }

  /**
   * El campo bodega debe poder asignarse ANTES de activar "Por Bodega": esa
   * activación exige que todo terminal ya tenga bodega, así que el selector
   * no puede depender de `isWarehouseMode` (nunca sería true a tiempo). Basta
   * con que el negocio tenga inventario habilitado y al menos una bodega creada.
   */
  get showWarehouseField(): boolean {
    return this.capabilities.isEnabled('inventory') && this.warehouseOptions.length > 0;
  }

  get warehouseOptions(): any[] {
    return this.capabilities.activeWarehouses;
  }

  private loadWarehousesIfNeeded(): void {
    if (!this.capabilities.isEnabled('inventory') || !this.activeBusinessId) return;
    this.inventoryService.getInventoryConfiguration().subscribe({
      next: (response: any) => this.capabilities.setInventoryConfiguration(response),
      error: () => undefined
    });
  }

  ngDoCheck(): void {
    if (this.activeBusinessId !== this.loadedBusiness) this.loadForBusiness();
  }

  get activeBusinessId(): string {
    return String(this.capabilities.activeBusinessId || '').trim();
  }

  get activeBusinessName(): string {
    const business = this.capabilities.activeBusiness;
    return String(business?.business_name || business?.businessname || business?.name || '—');
  }

  get roleLabel(): string {
    return String(this.capabilities.businessRole || 'Usuario');
  }

  get canManage(): boolean {
    return this.capabilities.hasPermission('*')
      || this.capabilities.hasPermission('business.settings.manage');
  }

  get activeEstablishments(): any[] {
    return this.capabilities.activeEstablishments;
  }

  get activeEmissionPoints(): any[] {
    const establishment = String(this.form?.get('establishment')?.value || '').trim();
    return this.capabilities.activeEmissionPointsFor(establishment);
  }

  get selectedEstablishment(): any | null {
    const id = String(this.form?.get('establishment')?.value || '').trim();
    return this.activeEstablishments.find((item: any) => String(item?.name || '') === id) || null;
  }

  get selectedEmissionPoint(): any | null {
    const id = String(this.form?.get('emission_point')?.value || '').trim();
    return this.activeEmissionPoints.find((item: any) => String(item?.name || '') === id) || null;
  }

  get activeCount(): number {
    return this.terminals.filter((item) => this.isActive(item)).length;
  }

  get isWarehouseMode(): boolean {
    return this.capabilities.isWarehouseMode;
  }

  /** Serie fiscal desde la que factura la terminal (001-002). */
  series(terminal: any): string {
    return fiscalSeries(terminal?.establishment_code, terminal?.emission_point_code);
  }

  get formSeries(): string {
    return fiscalSeries(this.selectedEstablishment?.establishment_code, this.selectedEmissionPoint?.emission_point_code);
  }

  warehouseName(terminal: any): string {
    const id = String(terminal?.warehouse || '').trim();
    if (!id) return '';
    const warehouse = this.warehouseOptions.find((item: any) => String(item?.name || '') === id);
    return String(terminal?.warehouse_name || warehouse?.warehouse_name || warehouse?.name || id);
  }

  userCount(terminal: any): number {
    return this.readTerminalUsers(terminal).length;
  }

  /** Avisos que impiden o limitan el uso de la terminal. */
  warnings(terminal: any): string[] {
    if (!this.isActive(terminal)) return [];
    const warnings: string[] = [];
    if (!this.userCount(terminal)) warnings.push('Nadie tiene asignada esta terminal.');
    if (this.isWarehouseMode && !String(terminal?.warehouse || '').trim()) warnings.push('Sin bodega: no puede vender mientras el inventario sea "Por bodega".');
    return warnings;
  }

  get filteredUsers(): any[] {
    const term = this.userSearch.trim().toLowerCase();
    if (!term) return this.businessUsers;
    return this.businessUsers.filter((user) => `${this.userLabel(user)} ${this.userEmail(user)}`.toLowerCase().includes(term));
  }

  get allFilteredSelected(): boolean {
    return this.filteredUsers.length > 0 && this.filteredUsers.every((user) => this.isUserSelected(user));
  }

  toggleAllFiltered(): void {
    const select = !this.allFilteredSelected;
    this.filteredUsers.forEach((user) => this.toggleUser(user, select));
  }

  selectEstablishment(id: string): void {
    if (this.editing) return;
    this.form.patchValue({ establishment: id });
    this.onEstablishmentChange();
  }

  selectEmissionPoint(id: string): void {
    if (this.editing) return;
    this.form.patchValue({ emission_point: id });
  }

  onEstablishmentChange(): void {
    const control = this.form.get('emission_point');
    const points = this.activeEmissionPoints;
    const current = String(control?.value || '').trim();
    if (!points.some((point: any) => String(point?.name || '') === current)) {
      control?.setValue(points.length === 1 ? points[0].name : '');
    }
  }

  openCreate(): void {
    if (!this.canManage || !this.activeBusinessId) return;
    this.editing = null;
    this.submitted = false;
    this.selectedUserIds = [];
    this.userSearch = '';
    this.setLocationLocked(false);
    this.form.reset({ terminal_name: '', establishment: '', emission_point: '', warehouse: '', status: 'Activo' });
    // Con un único establecimiento se preselecciona; el punto se completa si también es único.
    if (this.activeEstablishments.length === 1) this.selectEstablishment(String(this.activeEstablishments[0].name));
    this.modalOpen = true;
  }

  openEdit(terminal: any): void {
    if (!this.canManage || !terminal?.name) return;
    this.editing = terminal;
    this.submitted = false;
    this.selectedUserIds = this.readTerminalUsers(terminal);
    this.userSearch = '';
    this.form.reset({
      terminal_name: terminal.terminal_name || '',
      establishment: terminal.establishment || '',
      emission_point: terminal.emission_point || '',
      warehouse: terminal.warehouse || '',
      status: terminal.status || 'Activo'
    });
    // La ubicación fiscal no se cambia al editar: el atributo [disabled] no
    // aplica a controles reactivos, por eso se bloquea desde el formulario.
    this.setLocationLocked(true);
    this.modalOpen = true;
    this.companyService.getLitePosTerminal(this.activeBusinessId, terminal.name).subscribe({
      next: (detail) => {
        if (this.editing?.name !== terminal.name || !detail) return;
        this.editing = { ...terminal, ...detail, name: detail.name || terminal.name };
        this.selectedUserIds = this.readTerminalUsers(this.editing);
        this.form.patchValue({
          terminal_name: this.editing.terminal_name || '',
          establishment: this.editing.establishment || '',
          emission_point: this.editing.emission_point || '',
          warehouse: this.editing.warehouse || '',
          status: this.editing.status || 'Activo'
        });
      },
      error: (error) => toast.error(this.readError(error))
    });
  }

  closeModal(): void {
    this.modalOpen = false;
    this.editing = null;
    this.submitted = false;
    this.selectedUserIds = [];
  }

  toggleUser(user: any, checked: boolean): void {
    const id = this.userAssignmentId(user);
    if (!id) return;
    if (checked && !this.selectedUserIds.includes(id)) this.selectedUserIds = [...this.selectedUserIds, id];
    if (!checked) this.selectedUserIds = this.selectedUserIds.filter((value) => value !== id);
  }

  isUserSelected(user: any): boolean {
    const id = this.userAssignmentId(user);
    return !!id && this.selectedUserIds.includes(id);
  }

  save(): void {
    this.submitted = true;
    if (!this.canManage || !this.activeBusinessId || this.form.invalid) return;
    const value = this.form.getRawValue();
    const payload: any = {
      business: this.activeBusinessId,
      terminal_name: String(value.terminal_name || '').trim(),
      establishment: String(value.establishment || '').trim(),
      emission_point: String(value.emission_point || '').trim(),
      status: value.status === 'Inactivo' ? 'Inactivo' : 'Activo',
      users: this.selectedUserIds.map((businessUser) => ({ business_user: businessUser }))
    };
    // Siempre explícito (null para desvincular): omitir la clave al limpiar
    // el select no le indica al backend que debe quitar la bodega ya asignada.
    if (this.showWarehouseField) payload.warehouse = String(value.warehouse || '').trim() || null;
    if (this.editing?.name) payload.name = this.editing.name;

    this.saving = true;
    const request$ = this.editing
      ? this.companyService.saveLitePosTerminal(payload)
      : this.companyService.createLitePosTerminal(payload);
    request$.pipe(finalize(() => { this.saving = false; })).subscribe({
      next: () => {
        toast.success(this.editing ? 'Terminal actualizado.' : 'Terminal creado.');
        this.closeModal();
        this.refreshListAndContext();
      },
      error: (error) => toast.error(this.readError(error))
    });
  }

  deactivate(terminal: any): void {
    if (!this.canManage || !terminal?.name || !this.activeBusinessId) return;
    if (!window.confirm(`¿Desactivar ${this.terminalLabel(terminal)}?`)) return;
    this.saving = true;
    this.companyService.deactivateLitePosTerminal(terminal.name, this.activeBusinessId)
      .pipe(finalize(() => { this.saving = false; }))
      .subscribe({
        next: () => {
          if (this.capabilities.activePosTerminal?.name === terminal.name) this.capabilities.clearActivePosTerminal();
          toast.success('Terminal desactivado. El registro se conserva.');
          this.refreshListAndContext();
        },
        error: (error) => toast.error(this.readError(error))
      });
  }

  terminalLabel(terminal: any): string {
    const name = String(terminal?.terminal_name || terminal?.name || 'Terminal');
    const establishmentCode = String(terminal?.establishment_code || '').trim();
    const pointCode = String(terminal?.emission_point_code || '').trim();
    const establishmentName = String(terminal?.establishment_name || terminal?.establishment || '').trim();
    const codes = establishmentCode || pointCode ? ` · ${establishmentCode || '—'}-${pointCode || '—'}` : '';
    return `${name}${codes}${establishmentName ? ` · ${establishmentName}` : ''}`;
  }

  userLabel(user: any): string {
    return String(user?.full_name || user?.user_full_name || user?.nombre_completo || user?.user || user?.email || user?.name || 'Usuario');
  }

  userEmail(user: any): string {
    return String(user?.email || user?.user || '').trim();
  }

  isActive(terminal: any): boolean {
    return this.normalize(terminal?.status || '') === 'ACTIVO';
  }

  trackBy = (_index: number, item: any): string => String(item?.name || item?.terminal_name || _index);

  private loadForBusiness(): void {
    const business = this.activeBusinessId;
    const requestId = ++this.requestId;
    this.loadedBusiness = business;
    this.terminals = [];
    this.businessUsers = [];
    this.error = '';
    this.modalOpen = false;
    this.editing = null;
    this.selectedUserIds = [];
    if (!business) {
      this.error = 'Debe seleccionar un negocio antes de administrar terminales.';
      return;
    }

    this.loading = true;
    this.usersLoading = true;
    this.companyService.getLitePosTerminals(business, 'Activo').pipe(
      finalize(() => { if (requestId === this.requestId) this.loading = false; })
    ).subscribe({
      next: (rows) => {
        if (requestId !== this.requestId || business !== this.activeBusinessId) return;
        this.terminals = rows.filter((item: any) => !item.business || String(item.business) === business);
      },
      error: (error) => {
        if (requestId !== this.requestId) return;
        this.error = this.readError(error);
        toast.error(this.error);
      }
    });
    this.userService.getBusinessUsers(business, 'Activo').pipe(
      finalize(() => { if (requestId === this.requestId) this.usersLoading = false; })
    ).subscribe({
      next: (rows) => {
        if (requestId !== this.requestId || business !== this.activeBusinessId) return;
        this.businessUsers = rows.filter((user: any) => this.normalize(user?.status || 'Activo') === 'ACTIVO');
      },
      error: (error) => {
        if (requestId !== this.requestId) return;
        this.usersLoading = false;
        toast.error(this.readError(error));
      }
    });
  }

  private refreshListAndContext(): void {
    const business = this.activeBusinessId;
    this.loadForBusiness();
    if (!business) return;
    this.companyService.get_empresa(business).subscribe({
      next: (context) => this.capabilities.setFromResponse(context),
      error: () => undefined
    });
  }

  private setLocationLocked(locked: boolean): void {
    ['establishment', 'emission_point'].forEach((key) => {
      const control = this.form.get(key);
      if (locked) control?.disable({ emitEvent: false });
      else control?.enable({ emitEvent: false });
    });
  }

  private readTerminalUsers(terminal: any): string[] {
    const users = Array.isArray(terminal?.users) ? terminal.users : [];
    return users.map((user: any) => String(user?.business_user || user?.name || user?.business_user_name || user || '').trim()).filter(Boolean);
  }

  private userAssignmentId(user: any): string {
    return String(user?.name || user?.assignment?.name || user?.business_user || '').trim();
  }

  private normalize(value: unknown): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  }

  private readError(error: any): string {
    const backendMessage = this.frappeError.handle(error);
    if (Number(error?.status) === 403) {
      return backendMessage || 'No tiene permisos para administrar terminales POS en este negocio.';
    }
    return backendMessage || 'No se pudo completar la operación.';
  }
}
