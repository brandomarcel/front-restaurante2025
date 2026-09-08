import { CommonModule } from '@angular/common';
import { Component, DoCheck, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CompanyService } from 'src/app/services/company.service';

@Component({
  selector: 'app-lite-establishments',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lite-establishments.component.html'
})
export class LiteEstablishmentsComponent implements OnInit, DoCheck {
  establishments: any[] = [];
  form!: FormGroup;
  editing: any | null = null;
  modalOpen = false;
  loading = false;
  saving = false;
  error = '';
  submitted = false;
  private loadedBusiness = '';
  private requestId = 0;

  constructor(
    private readonly fb: FormBuilder,
    private readonly companyService: CompanyService,
    private readonly capabilities: CompanyCapabilitiesService,
    private readonly frappeError: FrappeErrorService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      establishment_code: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
      establishment_name: ['', Validators.required],
      status: ['Activo', Validators.required],
      is_main: [false],
      address: [''],
      phone: [''],
      email: ['', Validators.email],
      address_link: [''],
      contact: [''],
      warehouse: [''],
      cost_center: [''],
      pos_profile: ['']
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

  get canManage(): boolean {
    const role = this.normalize(this.capabilities.businessRole);
    return ['ADMINISTRADOR', 'GERENTE', 'ADMINISTRADOR DEL NEGOCIO'].includes(role);
  }

  get roleLabel(): string {
    return String(this.capabilities.businessRole || 'Usuario');
  }

  /** Lite guarda datos de contacto simples; ERPNext usa enlaces a documentos. */
  get isLiteBusiness(): boolean {
    const business = this.capabilities.activeBusiness || this.capabilities.business;
    const mode = this.normalize(business?.business_mode || business?.businessMode || '');
    return this.capabilities.businessMode === 'FACTURADA_LITE' || mode === 'LITE' || mode === 'FACTURADA_LITE';
  }

  get activeCount(): number {
    return this.establishments.filter((item) => this.isActive(item)).length;
  }

  loadForBusiness(): void {
    const business = this.activeBusinessId;
    const requestId = ++this.requestId;
    this.loadedBusiness = business;
    this.establishments = [];
    this.error = '';
    this.modalOpen = false;
    this.editing = null;
    if (!business) {
      this.error = 'Debe seleccionar un negocio antes de consultar establecimientos.';
      return;
    }

    this.loading = true;
    this.companyService.getLiteEstablishments(business).pipe(finalize(() => {
      if (requestId === this.requestId) this.loading = false;
    })).subscribe({
      next: (rows) => {
        if (requestId !== this.requestId || business !== this.activeBusinessId) return;
        this.establishments = rows.filter((item: any) => !item.business || String(item.business) === business);
      },
      error: (error) => {
        if (requestId !== this.requestId || business !== this.activeBusinessId) return;
        this.error = this.readError(error);
        toast.error(this.error);
      }
    });
  }

  openCreate(): void {
    if (!this.canManage || !this.activeBusinessId) return;
    this.editing = null;
    this.submitted = false;
    this.form.reset({ establishment_code: '', establishment_name: '', status: 'Activo', is_main: false, address: '', phone: '', email: '', address_link: '', contact: '', warehouse: '', cost_center: '', pos_profile: '' });
    this.modalOpen = true;
  }

  openEdit(establishment: any): void {
    if (!this.canManage) return;
    this.editing = establishment;
    this.submitted = false;
    this.populateForm(establishment);
    this.modalOpen = true;
    this.companyService.getLiteEstablishment(this.activeBusinessId, establishment.name).subscribe({
      next: (detail) => {
        if (this.editing?.name === establishment.name && detail) this.populateForm(detail);
      },
      error: (error) => toast.error(this.readError(error))
    });
  }

  closeModal(): void {
    this.modalOpen = false;
    this.editing = null;
    this.submitted = false;
  }

  save(): void {
    this.submitted = true;
    if (!this.canManage || !this.activeBusinessId || this.form.invalid) return;
    const value = this.form.getRawValue();
    const payload: any = {
      business: this.activeBusinessId,
      establishment_code: String(value.establishment_code).trim(),
      establishment_name: String(value.establishment_name).trim(),
      status: value.status === 'Inactivo' ? 'Inactivo' : 'Activo',
      is_main: value.is_main ? 1 : 0
    };
    if (this.isLiteBusiness) {
      payload.address = String(value.address || '').trim();
      payload.phone = String(value.phone || '').trim();
      payload.email = String(value.email || '').trim();
    } else {
      payload.address_link = String(value.address_link || '').trim();
      payload.contact = String(value.contact || '').trim();
      payload.warehouse = String(value.warehouse || '').trim();
      payload.cost_center = String(value.cost_center || '').trim();
      payload.pos_profile = String(value.pos_profile || '').trim();
    }
    if (this.editing?.name) payload.name = this.editing.name;

    this.saving = true;
    const request$ = this.editing
      ? this.companyService.saveLiteEstablishment(payload)
      : this.companyService.createLiteEstablishment(payload);
    request$.pipe(finalize(() => { this.saving = false; })).subscribe({
      next: () => {
        toast.success(this.editing ? 'Establecimiento actualizado.' : 'Establecimiento creado.');
        this.closeModal();
        this.refreshListAndContext();
      },
      error: (error) => toast.error(this.readError(error))
    });
  }

  deactivate(establishment: any): void {
    if (!this.canManage || !establishment?.name || !this.activeBusinessId) return;
    if (!window.confirm(`¿Desactivar ${this.displayName(establishment)}?`)) return;
    this.saving = true;
    this.companyService.deactivateLiteEstablishment(establishment.name, this.activeBusinessId)
      .pipe(finalize(() => { this.saving = false; }))
      .subscribe({
        next: () => {
          toast.success('Establecimiento desactivado. El registro se conserva.');
          this.refreshListAndContext();
        },
        error: (error) => toast.error(this.readError(error))
      });
  }

  displayName(establishment: any): string {
    const code = String(establishment?.establishment_code || '').trim();
    const name = String(establishment?.establishment_name || establishment?.name || 'Establecimiento');
    return code ? `${code} - ${name}` : name;
  }

  isActive(establishment: any): boolean {
    return this.normalize(establishment?.status || 'Activo') === 'ACTIVO';
  }

  isMain(establishment: any): boolean {
    return this.toBoolean(establishment?.is_main);
  }

  trackBy = (_index: number, item: any): string => String(item?.name || item?.establishment_code || _index);

  private refreshListAndContext(): void {
    const business = this.activeBusinessId;
    this.loadForBusiness();
    this.companyService.get_empresa(business).subscribe({
      next: (context) => this.capabilities.setFromResponse(context),
      error: () => undefined
    });
  }

  private populateForm(establishment: any): void {
    this.form.reset({
      establishment_code: establishment?.establishment_code || '',
      establishment_name: establishment?.establishment_name || '',
      status: establishment?.status || 'Activo',
      is_main: this.toBoolean(establishment?.is_main),
      address: establishment?.address || '',
      phone: establishment?.phone || '',
      email: establishment?.email || '',
      address_link: establishment?.address_link || '',
      contact: establishment?.contact || '',
      warehouse: establishment?.warehouse || '',
      cost_center: establishment?.cost_center || '',
      pos_profile: establishment?.pos_profile || ''
    });
  }

  private normalize(value: unknown): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  }

  private toBoolean(value: unknown): boolean {
    return value === true || value === 1 || String(value).toLowerCase() === 'true';
  }

  private readError(error: any): string {
    if (Number(error?.status) === 403) return 'Se requiere rol Administrador o Gerente para esta operación.';
    return this.frappeError.handle(error) || 'No se pudo completar la operación.';
  }
}
