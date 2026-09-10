import { CommonModule } from '@angular/common';
import { Component, DoCheck, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CompanyService } from 'src/app/services/company.service';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-lite-pos-terminals',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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

  private loadedBusiness = '';
  private requestId = 0;

  constructor(
    private readonly fb: FormBuilder,
    private readonly companyService: CompanyService,
    private readonly userService: UserService,
    private readonly capabilities: CompanyCapabilitiesService,
    private readonly frappeError: FrappeErrorService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      terminal_name: ['', Validators.required],
      establishment: ['', Validators.required],
      emission_point: ['', Validators.required],
      status: ['Activo', Validators.required]
    });
    this.loadForBusiness();
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
    const role = this.normalize(this.capabilities.businessRole);
    return ['ADMINISTRADOR', 'GERENTE'].includes(role);
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
    this.form.reset({ terminal_name: '', establishment: '', emission_point: '', status: 'Activo' });
    this.modalOpen = true;
  }

  openEdit(terminal: any): void {
    if (!this.canManage || !terminal?.name) return;
    this.editing = terminal;
    this.submitted = false;
    this.selectedUserIds = this.readTerminalUsers(terminal);
    this.form.reset({
      terminal_name: terminal.terminal_name || '',
      establishment: terminal.establishment || '',
      emission_point: terminal.emission_point || '',
      status: terminal.status || 'Activo'
    });
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
