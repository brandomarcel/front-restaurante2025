import { CommonModule } from '@angular/common';
import { Component, DoCheck, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CompanyService } from 'src/app/services/company.service';

@Component({
  selector: 'app-lite-emission-points',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lite-emission-points.component.html'
})
export class LiteEmissionPointsComponent implements OnInit, DoCheck {
  points: any[] = [];
  form!: FormGroup;
  editing: any | null = null;
  modalOpen = false;
  loading = false;
  saving = false;
  error = '';
  submitted = false;
  selectedEstablishmentId = '';

  private loadedBusiness = '';
  private loadedEstablishment = '';
  private requestId = 0;
  private setupLoadedBusiness = '';
  private setupLoadingBusiness = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly companyService: CompanyService,
    private readonly capabilities: CompanyCapabilitiesService,
    private readonly frappeError: FrappeErrorService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      emission_point_code: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
      emission_point_name: ['', Validators.required],
      status: ['Activo', Validators.required],
      is_default: [false]
    });
    this.syncBusiness();
  }

  ngDoCheck(): void {
    this.syncBusiness();
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
    return ['ADMINISTRADOR', 'GERENTE', 'ADMINISTRADOR DEL NEGOCIO'].includes(role);
  }

  get activeEstablishments(): any[] {
    return this.capabilities.activeEstablishments;
  }

  get selectedEstablishment(): any | null {
    return this.activeEstablishments.find((item: any) => String(item?.name || '').trim() === this.selectedEstablishmentId) || null;
  }

  get selectedEstablishmentLabel(): string {
    const establishment = this.selectedEstablishment;
    if (!establishment) return 'Seleccione un establecimiento';
    const code = String(establishment.establishment_code || '').trim();
    const name = String(establishment.establishment_name || establishment.name || '').trim();
    return code ? `${code} - ${name}` : name;
  }

  get activeCount(): number {
    return this.points.filter((point) => this.isActive(point)).length;
  }

  get pendingSequenceCount(): number {
    return this.points.filter((point) => this.toBoolean(point?.requires_sequence_setup)).length;
  }

  onEstablishmentChange(value: unknown): void {
    const id = String(value || '').trim();
    const valid = this.activeEstablishments.some((item: any) => String(item?.name || '').trim() === id);
    this.selectedEstablishmentId = valid ? id : '';
    this.loadPoints();
  }

  openCreate(): void {
    if (!this.canManage || !this.activeBusinessId || !this.selectedEstablishmentId) return;
    this.editing = null;
    this.submitted = false;
    this.form.reset({ emission_point_code: '', emission_point_name: '', status: 'Activo', is_default: false });
    this.modalOpen = true;
  }

  openEdit(point: any): void {
    if (!this.canManage || !point?.name) return;
    this.editing = point;
    this.submitted = false;
    this.populateForm(point);
    this.modalOpen = true;
  }

  closeModal(): void {
    this.modalOpen = false;
    this.editing = null;
    this.submitted = false;
  }

  save(): void {
    this.submitted = true;
    if (!this.canManage || !this.activeBusinessId || !this.selectedEstablishmentId || this.form.invalid) return;

    const value = this.form.getRawValue();
    const payload: any = {
      business: this.activeBusinessId,
      establishment: this.selectedEstablishmentId,
      emission_point_code: String(value.emission_point_code || '').trim(),
      emission_point_name: String(value.emission_point_name || '').trim(),
      status: value.status === 'Inactivo' ? 'Inactivo' : 'Activo',
      is_default: value.is_default ? 1 : 0
    };
    if (this.editing?.name) payload.name = this.editing.name;

    this.saving = true;
    const request$ = this.editing
      ? this.companyService.saveLiteEmissionPoint(payload)
      : this.companyService.createLiteEmissionPoint(payload);
    request$.pipe(finalize(() => { this.saving = false; })).subscribe({
      next: () => {
        toast.success(this.editing ? 'Punto de emisión actualizado.' : 'Punto de emisión creado.');
        this.closeModal();
        this.refreshSetupAndPoints();
      },
      error: (error) => toast.error(this.readError(error))
    });
  }

  deactivate(point: any): void {
    if (!this.canManage || !point?.name || !this.activeBusinessId) return;
    if (!window.confirm(`¿Desactivar ${this.displayName(point)}?`)) return;
    this.saving = true;
    this.companyService.deactivateLiteEmissionPoint(point.name, this.activeBusinessId)
      .pipe(finalize(() => { this.saving = false; }))
      .subscribe({
        next: () => {
          toast.success('Punto de emisión desactivado. El registro se conserva.');
          this.refreshSetupAndPoints();
        },
        error: (error) => toast.error(this.readError(error))
      });
  }

  displayName(point: any): string {
    const code = String(point?.emission_point_code || '').trim();
    const name = String(point?.emission_point_name || point?.name || 'Punto de emisión');
    return code ? `${code} - ${name}` : name;
  }

  isActive(point: any): boolean {
    return this.normalize(point?.status || 'Activo') === 'ACTIVO';
  }

  isDefault(point: any): boolean {
    return this.toBoolean(point?.is_default);
  }

  requiresSequence(point: any): boolean {
    return this.toBoolean(point?.requires_sequence_setup);
  }

  trackBy = (_index: number, item: any): string => String(item?.name || item?.emission_point_code || _index);

  private syncBusiness(): void {
    const business = this.activeBusinessId;
    if (business !== this.loadedBusiness) {
      this.loadedBusiness = business;
      this.setupLoadedBusiness = '';
      this.loadedEstablishment = '';
      this.selectedEstablishmentId = '';
      this.points = [];
      this.error = '';
      this.modalOpen = false;
      this.editing = null;
      // El contexto puede no traer todavía las listas del setup. Consultar
      // get_lite_setup evita que el selector aparezca vacío hasta volver a
      // iniciar sesión después de crear un establecimiento.
      this.refreshSetup(business);
      return;
    }

    if (business && this.setupLoadedBusiness !== business) {
      this.refreshSetup(business);
      return;
    }

    // El contexto puede terminar de cargar establecimientos después de que
    // el componente ya se haya renderizado. Toma la selección persistida por
    // negocio cuando aparece, sin elegir arbitrariamente el primer registro.
    if (!this.selectedEstablishmentId) {
      const selected = this.capabilities.selectedLiteEstablishment;
      const selectedId = String(selected?.name || '').trim();
      if (selectedId && this.activeEstablishments.some((item: any) => String(item?.name || '').trim() === selectedId)) {
        this.selectedEstablishmentId = selectedId;
        if (this.loadedEstablishment !== selectedId) this.loadPoints();
      }
    }
  }

  private loadPoints(): void {
    const business = this.activeBusinessId;
    const establishment = this.selectedEstablishmentId;
    const requestId = ++this.requestId;
    this.points = [];
    this.error = '';
    this.loadedEstablishment = establishment;
    if (!business) {
      this.error = 'Debe seleccionar un negocio antes de consultar puntos de emisión.';
      return;
    }
    if (!establishment) {
      this.error = 'Seleccione un establecimiento activo para consultar sus puntos de emisión.';
      return;
    }

    this.loading = true;
    this.companyService.getLiteEmissionPoints(business, establishment)
      .pipe(finalize(() => { if (requestId === this.requestId) this.loading = false; }))
      .subscribe({
        next: (rows) => {
          if (requestId !== this.requestId || business !== this.activeBusinessId || establishment !== this.selectedEstablishmentId) return;
          this.points = rows.filter((item: any) =>
            (!item.business || String(item.business) === business)
            && (!item.establishment || String(item.establishment) === establishment)
          );
        },
        error: (error) => {
          if (requestId !== this.requestId) return;
          this.error = this.readError(error);
          toast.error(this.error);
        }
      });
  }

  private populateForm(point: any): void {
    this.form.reset({
      emission_point_code: point?.emission_point_code || '',
      emission_point_name: point?.emission_point_name || '',
      status: point?.status || 'Activo',
      is_default: this.toBoolean(point?.is_default)
    });
  }

  private refreshSetupAndPoints(): void {
    const business = this.activeBusinessId;
    if (!business) return;
    this.setupLoadedBusiness = '';
    this.refreshSetup(business);
  }

  private refreshSetup(business: string): void {
    if (!business || this.setupLoadingBusiness === business) return;
    this.setupLoadingBusiness = business;
    this.companyService.getLiteSetup(business).pipe(
      finalize(() => {
        if (this.setupLoadingBusiness === business) this.setupLoadingBusiness = '';
      })
    ).subscribe({
      next: (setup) => {
        if (business !== this.activeBusinessId) return;
        this.capabilities.setLiteSetupState(setup);
        this.setupLoadedBusiness = business;

        const selected = this.capabilities.selectedLiteEstablishment;
        if (selected && this.activeEstablishments.some((item: any) => String(item?.name || '') === String(selected.name || ''))) {
          this.selectedEstablishmentId = String(selected.name);
        }
        this.loadPoints();
      },
      error: (error) => {
        if (business !== this.activeBusinessId) return;
        this.setupLoadedBusiness = business;
        this.error = this.readError(error);
        this.loadPoints();
      }
    });
  }

  private normalize(value: unknown): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  }

  private toBoolean(value: unknown): boolean {
    return value === true || value === 1 || String(value).toLowerCase() === 'true' || String(value) === '1';
  }

  private readError(error: any): string {
    if (Number(error?.status) === 403) return 'No tiene permisos para administrar puntos de emisión en este negocio.';
    return this.frappeError.handle(error) || 'No se pudo completar la operación.';
  }
}
