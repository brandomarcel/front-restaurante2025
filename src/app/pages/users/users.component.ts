import { CommonModule } from '@angular/common';
import { Component, DoCheck, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CompanyService } from 'src/app/services/company.service';
import {
  FacturadaBusinessRole,
  FacturadaBusinessUser,
  FrappeUserCandidate,
  UserService
} from 'src/app/services/user.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './users.component.html',
})
export class UsersComponent implements OnInit, DoCheck {
  users: FacturadaBusinessUser[] = [];
  roles: FacturadaBusinessRole[] = [];
  frappeUsers: FrappeUserCandidate[] = [];
  filtered: FacturadaBusinessUser[] = [];

  form!: FormGroup;
  selectedUser: FacturadaBusinessUser | null = null;
  selectedFrappeUser: FrappeUserCandidate | null = null;
  mostrarModal = false;
  loading = false;
  saving = false;
  submitted = false;
  error = '';

  search = '';
  roleFilter = 'all';
  statusFilter = 'all';
  private loadedBusiness = '';
  private requestId = 0;
  private userSearchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly usersService: UserService,
    private readonly capabilities: CompanyCapabilitiesService,
    private readonly companyService: CompanyService,
    private readonly frappeError: FrappeErrorService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      user: ['', [Validators.required, Validators.email]],
      first_name: [''],
      last_name: [''],
      new_password: [''],
      business_role: ['', Validators.required],
      status: ['Activo', Validators.required],
      is_default: [false]
    });
    this.loadForActiveBusiness();
  }

  /** La selección es global. Al cambiarla se descartan siempre datos previos. */
  ngDoCheck(): void {
    const business = this.activeBusinessId;
    if (business !== this.loadedBusiness) this.loadForActiveBusiness();
  }

  get activeBusinessId(): string {
    return String(this.capabilities.activeBusinessId || '').trim();
  }

  get activeBusinessName(): string {
    const business = this.capabilities.activeBusiness;
    return String(business?.business_name || business?.businessname || business?.name || '—');
  }

  get currentBusinessRole(): string {
    return String(this.capabilities.businessRole || '—');
  }

  get canManageUsers(): boolean {
    const role = this.normalized(this.capabilities.businessRole);
    const isManager = role === 'ADMINISTRADOR' || role === 'GERENTE';
    // El contrato Lite define Administrador/Gerente como administradores de
    // usuarios. El backend mantiene la validación final de permisos.
    return isManager;
  }

  get activeCount(): number {
    return this.filtered.filter((item) => this.isActive(item)).length;
  }

  get inactiveCount(): number {
    return this.filtered.length - this.activeCount;
  }

  get assignableRoles(): FacturadaBusinessRole[] {
    const current = this.normalized(this.capabilities.businessRole);
    if (current !== 'GERENTE') return this.roles;
    return this.roles.filter((role) => !['ADMINISTRADOR', 'GERENTE'].includes(this.normalized(this.roleName(role))));
  }

  get selectedRolePermissions(): string[] {
    const selected = this.roles.find((role) => this.roleName(role) === this.form?.value?.business_role);
    const permissions = selected?.permissions ?? selected?.['permission_list'] ?? [];
    return Array.isArray(permissions) ? permissions.map((item) => String(item)) : [];
  }

  get selectedFrappeUserDisabled(): boolean {
    const enabled = this.selectedUser
      ? (this.selectedUser.user_enabled ?? this.selectedUser.enabled)
      : this.selectedFrappeUser?.enabled;
    if (enabled === undefined || enabled === null) return false;
    return enabled === false || enabled === 0 || String(enabled).toLowerCase() === 'false';
  }

  loadForActiveBusiness(): void {
    const business = this.activeBusinessId;
    const requestId = ++this.requestId;
    this.loadedBusiness = business;
    this.users = [];
    this.roles = [];
    this.filtered = [];
    this.error = '';
    this.mostrarModal = false;
    this.selectedUser = null;
    this.selectedFrappeUser = null;
    this.frappeUsers = [];

    if (!business) {
      this.error = 'Debe seleccionar un negocio antes de administrar usuarios.';
      return;
    }
    if (!this.canManageUsers) {
      this.error = 'No tiene permisos para administrar usuarios en este negocio.';
      return;
    }

    this.loading = true;
    forkJoin({
      users: this.usersService.getBusinessUsers(business),
      roles: this.usersService.getBusinessRoles()
    }).pipe(finalize(() => {
      if (requestId === this.requestId) this.loading = false;
    })).subscribe({
      next: ({ users, roles }) => {
        if (requestId !== this.requestId || business !== this.activeBusinessId) return;
        // El backend ya aísla por business; este filtro evita mostrar datos
        // antiguos o inválidos si una respuesta llega tarde al cambiarlo.
        this.users = users.filter((item) => !item.business || String(item.business) === business);
        this.roles = roles;
        this.applyFilters();
      },
      error: (error) => {
        if (requestId !== this.requestId || business !== this.activeBusinessId) return;
        this.error = this.readError(error);
        toast.error(this.error);
      }
    });
  }

  applyFilters(): void {
    const search = this.search.trim().toLocaleLowerCase();
    this.filtered = this.users.filter((user) => {
      const name = this.fullName(user).toLocaleLowerCase();
      const email = this.email(user).toLocaleLowerCase();
      const matchesSearch = !search || name.includes(search) || email.includes(search);
      const matchesRole = this.roleFilter === 'all' || this.roleName(user) === this.roleFilter;
      const matchesStatus = this.statusFilter === 'all'
        || (this.statusFilter === 'Activo' ? this.isActive(user) : !this.isActive(user));
      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  openCreate(): void {
    if (!this.canManageUsers) return;
    this.selectedUser = null;
    this.selectedFrappeUser = null;
    this.submitted = false;
    this.form.reset({ user: '', first_name: '', last_name: '', new_password: '', business_role: this.assignableRoles[0] ? this.roleName(this.assignableRoles[0]) : '', status: 'Activo', is_default: false });
    this.frappeUsers = [];
    this.mostrarModal = true;
  }

  openEdit(user: FacturadaBusinessUser): void {
    if (!this.canManageUsers) return;
    this.selectedUser = user;
    this.selectedFrappeUser = null;
    this.submitted = false;
    this.form.reset({
      user: this.email(user),
      first_name: '',
      last_name: '',
      new_password: '',
      business_role: this.roleName(user),
      status: this.isActive(user) ? 'Activo' : 'Inactivo',
      is_default: this.toBoolean(user.is_default)
    });
    this.frappeUsers = [];
    this.form.get('user')?.disable();
    this.mostrarModal = true;
  }

  closeModal(): void {
    this.mostrarModal = false;
    this.submitted = false;
    this.selectedUser = null;
    this.selectedFrappeUser = null;
    this.form.get('user')?.enable();
    this.form.reset({ user: '', first_name: '', last_name: '', new_password: '', business_role: '', status: 'Activo', is_default: false });
    this.frappeUsers = [];
  }

  searchFrappeUsers(value?: string): void {
    if (this.selectedUser) return;
    const text = String(value ?? this.form.get('user')?.value ?? '').trim();
    if (this.selectedFrappeUser && text !== this.selectedFrappeUser.user) {
      this.selectedFrappeUser = null;
      this.form.get('first_name')?.setValue('', { emitEvent: false });
    }
    this.form.get('user')?.setValue(text, { emitEvent: false });
    this.frappeUsers = [];
    if (this.userSearchTimer) clearTimeout(this.userSearchTimer);
    if (text.length < 2 || !this.activeBusinessId) return;

    this.userSearchTimer = setTimeout(() => {
      this.usersService.searchFrappeUsers(this.activeBusinessId, text, 20).subscribe({
        next: (candidates) => {
          if (this.selectedUser || text !== String(this.form.get('user')?.value || '').trim()) return;
          this.frappeUsers = candidates;
        },
        error: (error) => {
          this.frappeUsers = [];
          toast.error(this.readError(error));
        }
      });
    }, 250);
  }

  selectFrappeUser(candidate: FrappeUserCandidate): void {
    if (!this.isFrappeUserEnabled(candidate) || !!candidate.assignment) return;
    this.selectedFrappeUser = candidate;
    this.form.get('user')?.setValue(candidate.user);
    this.form.get('first_name')?.setValue(candidate.full_name || '');
    this.frappeUsers = [];
  }

  frappeUserName(candidate: FrappeUserCandidate): string {
    return String(candidate.full_name || candidate.email || candidate.user || '—');
  }

  isFrappeUserEnabled(candidate: FrappeUserCandidate): boolean {
    return candidate.enabled !== false && candidate.enabled !== 0 && String(candidate.enabled).toLowerCase() !== 'false';
  }

  save(): void {
    this.submitted = true;
    if (!this.canManageUsers || this.form.invalid || !this.activeBusinessId) return;
    if (this.selectedFrappeUserDisabled) {
      toast.error('No se puede activar una asignación para un usuario Frappe deshabilitado.');
      return;
    }

    const value = this.form.getRawValue();
    const user = String(value.user || '').trim();
    const role = String(value.business_role || '').trim();
    if (!user || !role) return;
    if (!this.selectedUser && !this.selectedFrappeUser && (!String(value.first_name || '').trim() || !String(value.last_name || '').trim() || !String(value.new_password || ''))) {
      for (const field of ['first_name', 'last_name', 'new_password']) {
        if (!String(value[field] || '').trim()) this.form.get(field)?.setErrors({ required: true });
      }
      toast.error('Para crear un usuario ingrese nombres, apellidos y contraseña.');
      return;
    }
    if (this.normalized(this.capabilities.businessRole) === 'GERENTE' && ['ADMINISTRADOR', 'GERENTE'].includes(this.normalized(role))) {
      toast.error('Un Gerente no puede asignar los roles Administrador ni Gerente.');
      return;
    }
    const duplicate = this.users.find((item) => this.email(item).toLowerCase() === user.toLowerCase() && item.name !== this.selectedUser?.name);
    if (duplicate) {
      toast.error('Este usuario ya está asignado al negocio seleccionado.');
      return;
    }

    this.saving = true;
    const request$ = this.selectedUser
      ? this.usersService.saveBusinessUser({
          name: this.selectedUser.name,
          business: this.activeBusinessId,
          user,
          business_role: role,
          status: value.status === 'Inactivo' ? 'Inactivo' : 'Activo',
          is_default: value.is_default ? 1 : 0
        })
      : this.selectedFrappeUser
      ? this.usersService.saveBusinessUser({
          business: this.activeBusinessId,
          user,
          business_role: role,
          status: value.status === 'Inactivo' ? 'Inactivo' : 'Activo',
          is_default: value.is_default ? 1 : 0
        })
      : this.usersService.createFrappeUser({
          business: this.activeBusinessId,
          email: user,
          first_name: String(value.first_name).trim(),
          last_name: String(value.last_name).trim(),
          business_role: role,
          is_default: value.is_default ? 1 : 0,
          new_password: String(value.new_password),
          send_welcome_email: 0
        });
    request$.pipe(finalize(() => { this.saving = false; })).subscribe({
      next: () => {
        toast.success(this.selectedUser
          ? 'Asignación actualizada.'
          : this.selectedFrappeUser
          ? 'Usuario Frappe asignado al negocio.'
          : 'Usuario Frappe creado y asignado al negocio.');
        this.closeModal();
        this.refreshDataAndContext();
      },
      error: (error) => toast.error(this.readError(error))
    });
  }

  deactivate(user: FacturadaBusinessUser): void {
    if (!this.canManageUsers || !user.name || !this.activeBusinessId || !this.isActive(user)) return;
    if (!window.confirm(`¿Desactivar la asignación de ${this.fullName(user)} en ${this.activeBusinessName}?`)) return;
    this.saving = true;
    this.usersService.deactivateBusinessUser(user.name, this.activeBusinessId)
      .pipe(finalize(() => { this.saving = false; }))
      .subscribe({
        next: () => {
          toast.success('La asignación fue desactivada. El usuario Frappe no fue eliminado.');
          this.refreshDataAndContext();
        },
        error: (error) => toast.error(this.readError(error))
      });
  }

  private refreshDataAndContext(): void {
    const business = this.activeBusinessId;
    this.loadForActiveBusiness();
    this.companyService.get_empresa(business).subscribe({
      next: (context) => this.capabilities.setFromResponse(context),
      error: () => undefined
    });
  }

  fullName(user: FacturadaBusinessUser): string {
    return String(user.full_name || user.user_full_name || user.nombre_completo || user.user_data?.full_name || user.first_name || user.nombre || this.email(user) || '—');
  }

  email(user: FacturadaBusinessUser): string {
    return String(user.email || user.correo || user.user || '').trim();
  }

  roleName(record: FacturadaBusinessRole | FacturadaBusinessUser): string {
    return String(record.business_role || record.role || record.role_name || record.label || record.name || '—').trim();
  }

  isActive(user: FacturadaBusinessUser): boolean {
    const status = this.normalized(user.status);
    return status ? status === 'ACTIVO' : this.toBoolean(user.enabled ?? true);
  }

  isDefault(user: FacturadaBusinessUser): boolean {
    return this.toBoolean(user.is_default);
  }

  trackBy = (_index: number, user: FacturadaBusinessUser): string => String(user.name || user.user || user.email || _index);

  private normalized(value: unknown): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  }

  private toBoolean(value: unknown): boolean {
    return value === true || value === 1 || String(value).toLowerCase() === 'true';
  }

  private readError(error: any): string {
    const message = this.frappeError.handle(error);
    if (Number(error?.status) === 403) return 'No tiene permisos para administrar usuarios en este negocio.';
    return message || 'No se pudo completar la operación.';
  }
}
