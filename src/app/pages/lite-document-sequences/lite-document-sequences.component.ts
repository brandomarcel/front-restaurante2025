import { CommonModule } from '@angular/common';
import { Component, DoCheck, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CompanyService } from 'src/app/services/company.service';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FiscalSetupHeaderComponent } from 'src/app/shared/components/fiscal-setup-header/fiscal-setup-header.component';
import {
  FISCAL_DOCUMENTS, FISCAL_ENVIRONMENTS, FiscalDocumentType, FiscalEnvironment,
  fiscalDocumentNumber, fiscalEnvironmentLabel, fiscalSeries, sequentialNumber
} from 'src/app/core/utils/fiscal-setup';

@Component({
  selector: 'app-lite-document-sequences',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, FiscalSetupHeaderComponent],
  templateUrl: './lite-document-sequences.component.html'
})
export class LiteDocumentSequencesComponent implements OnInit, DoCheck {
  sequences: any[] = [];
  form!: FormGroup;
  editing: any | null = null;
  modalOpen = false;
  loading = false;
  saving = false;
  error = '';
  submitted = false;
  consecutiveError = '';
  selectedEstablishmentId = '';
  selectedEmissionPointId = '';
  showHistory = false;

  /**
   * Cada tipo documental tiene su propia serie SRI (Factura 01, Nota de
   * Crédito 04, Guía de Remisión 06): el mismo establecimiento y punto de
   * emisión llevan consecutivos independientes, nunca uno compartido.
   */
  readonly documents = FISCAL_DOCUMENTS;
  readonly environmentColumns = FISCAL_ENVIRONMENTS;
  readonly environmentLabel = fiscalEnvironmentLabel;

  private loadedBusiness = '';
  private loadedCombination = '';
  private requestId = 0;

  constructor(
    private readonly fb: FormBuilder,
    private readonly companyService: CompanyService,
    private readonly capabilities: CompanyCapabilitiesService,
    private readonly frappeError: FrappeErrorService,
    private readonly route: ActivatedRoute
  ) {}

  /** Ubicación pedida al llegar desde Puntos de emisión (no cambia la selección para facturar). */
  private get requestedLocation(): { establishment: string; point: string } {
    const params = this.route.snapshot.queryParamMap;
    return {
      establishment: String(params.get('establishment') || '').trim(),
      point: String(params.get('point') || '').trim()
    };
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      establishment: ['', Validators.required],
      emission_point: ['', Validators.required],
      document_type: ['Factura', Validators.required],
      environment: ['Pruebas', Validators.required],
      status: ['Activo', Validators.required],
      current_number: [0, [Validators.required, Validators.min(0), Validators.max(999999999), Validators.pattern(/^\d+$/)]]
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
    return this.capabilities.hasPermission('*')
      || this.capabilities.hasPermission('business.settings.manage');
  }

  get activeEstablishments(): any[] {
    return this.capabilities.activeEstablishments;
  }

  get activeEmissionPoints(): any[] {
    return this.capabilities.activeEmissionPointsFor(this.selectedEstablishmentId);
  }

  get selectedEstablishment(): any | null {
    return this.activeEstablishments.find((item: any) => String(item?.name || '') === this.selectedEstablishmentId) || null;
  }

  get selectedEmissionPoint(): any | null {
    return this.activeEmissionPoints.find((item: any) => String(item?.name || '') === this.selectedEmissionPointId) || null;
  }

  get selectedEstablishmentLabel(): string {
    const item = this.selectedEstablishment;
    if (!item) return 'Seleccione un establecimiento';
    return this.label(item.establishment_code, item.establishment_name || item.name);
  }

  get selectedEmissionPointLabel(): string {
    const item = this.selectedEmissionPoint;
    if (!item) return 'Seleccione un punto de emisión';
    return this.label(item.emission_point_code, item.emission_point_name || item.name);
  }

  get profileEnvironment(): string {
    const business = this.capabilities.business || this.capabilities.activeBusiness;
    const raw = business?.environment || business?.ambiente || business?.tax_profile?.environment || business?.tax_profile?.ambiente;
    return this.normalize(raw) === 'PRODUCCION' ? 'Produccion' : 'Pruebas';
  }

  get activeInvoiceSequenceForProfile(): any | null {
    const sequence = this.sequenceFor('Factura', this.profileEnvironment);
    return sequence && this.isActive(sequence) ? sequence : null;
  }

  get pointReadyForProfile(): boolean {
    const point = this.activeInvoiceSequenceForProfile;
    return !!point && this.canEmit(point);
  }

  get activeCount(): number {
    return this.sequences.filter((item) => this.isActive(item)).length;
  }

  /** Serie fiscal de la ubicación seleccionada (001-002). */
  get selectedSeries(): string {
    return fiscalSeries(this.selectedEstablishment?.establishment_code, this.selectedEmissionPoint?.emission_point_code);
  }

  /** Secuencias que no se muestran en la matriz (por ejemplo, inactivas reemplazadas). */
  get historySequences(): any[] {
    const shown = new Set(this.documents.flatMap((document) =>
      this.environmentColumns.map((environment) => this.sequenceFor(document.type, environment.value)?.name)));
    return this.sequences.filter((sequence) => !shown.has(sequence?.name));
  }

  /** Número completo del próximo comprobante (001-002-000000026). */
  nextDocumentNumber(sequence: any): string {
    return fiscalDocumentNumber(
      sequence?.establishment_code || this.selectedEstablishment?.establishment_code,
      sequence?.emission_point_code || this.selectedEmissionPoint?.emission_point_code,
      this.nextValue(sequence)
    );
  }

  /** Vista previa del próximo número mientras se edita el consecutivo. */
  get formPreviewNumber(): string {
    return fiscalDocumentNumber(
      this.selectedEstablishment?.establishment_code || this.editing?.establishment_code,
      this.selectedEmissionPoint?.emission_point_code || this.editing?.emission_point_code,
      sequentialNumber(this.form?.get('current_number')?.value) + 1
    );
  }

  get formDocumentType(): string {
    return this.documentTypeLabel(this.editing?.document_type || this.form?.get('document_type')?.value);
  }

  get formEnvironment(): string {
    return fiscalEnvironmentLabel(this.editing?.environment || this.form?.get('environment')?.value);
  }

  selectFormDocumentType(type: FiscalDocumentType): void {
    if (!this.editing) this.form.patchValue({ document_type: type });
  }

  selectFormEnvironment(environment: FiscalEnvironment): void {
    if (!this.editing) this.form.patchValue({ environment });
  }

  isProfileEnvironment(environment: string): boolean {
    return environment === this.profileEnvironment;
  }

  onEstablishmentChange(value: unknown): void {
    const id = String(value || '').trim();
    const valid = this.activeEstablishments.some((item: any) => String(item?.name || '') === id);
    this.selectedEstablishmentId = valid ? id : '';
    this.selectedEmissionPointId = '';
    const preferred = this.activeEmissionPoints.find((item: any) => this.toBoolean(item?.is_default))
      || (this.activeEmissionPoints.length === 1 ? this.activeEmissionPoints[0] : null);
    if (preferred) this.selectedEmissionPointId = String(preferred.name);
    this.persistSelection();
    this.loadSequences();
  }

  onEmissionPointChange(value: unknown): void {
    const id = String(value || '').trim();
    this.selectedEmissionPointId = this.activeEmissionPoints.some((item: any) => String(item?.name || '') === id) ? id : '';
    this.persistSelection();
    this.loadSequences();
  }

  openCreate(documentType = 'Factura', environment = this.profileEnvironment): void {
    if (!this.canManage || !this.activeBusinessId || !this.selectedEstablishmentId || !this.selectedEmissionPointId) return;
    this.editing = null;
    this.submitted = false;
    this.consecutiveError = '';
    this.setStructuralControls(false);
    this.form.reset({
      establishment: this.selectedEstablishmentId,
      emission_point: this.selectedEmissionPointId,
      document_type: documentType,
      environment,
      status: 'Activo',
      current_number: 0
    });
    this.modalOpen = true;
  }

  openEdit(sequence: any): void {
    if (!this.canManage || !sequence?.name) return;
    this.editing = sequence;
    this.submitted = false;
    this.consecutiveError = '';
    this.form.reset({
      establishment: sequence.establishment || this.selectedEstablishmentId,
      emission_point: sequence.emission_point || this.selectedEmissionPointId,
      document_type: sequence.document_type || 'Factura',
      environment: sequence.environment || 'Pruebas',
      status: sequence.status || 'Activo',
      current_number: this.numberValue(sequence.current_number)
    });
    this.setStructuralControls(true);
    this.modalOpen = true;
    this.companyService.getLiteDocumentSequence(this.activeBusinessId, sequence.name).subscribe({
      next: (detail) => {
        if (this.editing?.name === sequence.name && detail) {
          this.form.patchValue({
            status: detail.status || 'Activo',
            current_number: this.numberValue(detail.current_number)
          });
          this.editing = { ...sequence, ...detail, name: detail.name || sequence.name };
        }
      },
      error: (error) => toast.error(this.readError(error))
    });
  }

  closeModal(): void {
    this.modalOpen = false;
    this.editing = null;
    this.submitted = false;
    this.consecutiveError = '';
    this.setStructuralControls(false);
  }

  save(): void {
    this.submitted = true;
    this.consecutiveError = '';
    if (!this.canManage || !this.activeBusinessId || this.form.invalid) return;

    const value = this.form.getRawValue();
    const currentNumber = this.numberValue(value.current_number);
    const previousNumber = this.editing ? this.numberValue(this.editing.current_number) : 0;
    if (currentNumber < previousNumber) {
      this.consecutiveError = `El consecutivo no puede ser menor al actual (${previousNumber}).`;
      return;
    }
    if (currentNumber > 999999999) {
      this.consecutiveError = 'El consecutivo máximo permitido es 999999999.';
      return;
    }

    const payload: any = {
      business: this.activeBusinessId,
      establishment: this.editing?.establishment || this.selectedEstablishmentId,
      emission_point: this.editing?.emission_point || this.selectedEmissionPointId,
      document_type: this.editing?.document_type || value.document_type,
      environment: this.editing?.environment || value.environment,
      status: value.status === 'Inactivo' ? 'Inactivo' : 'Activo',
      current_number: currentNumber
    };
    if (this.editing?.name) payload.name = this.editing.name;

    this.saving = true;
    const request$ = this.editing
      ? this.companyService.saveLiteDocumentSequence(payload)
      : this.companyService.createLiteDocumentSequence(payload);
    request$.pipe(finalize(() => { this.saving = false; })).subscribe({
      next: () => {
        toast.success(this.editing ? 'Secuencia actualizada.' : 'Secuencia creada.');
        this.closeModal();
        this.refreshSetupAndSequences();
      },
      error: (error) => toast.error(this.readError(error))
    });
  }

  deactivate(sequence: any): void {
    if (!this.canManage || !sequence?.name || !this.activeBusinessId) return;
    if (!window.confirm(`¿Desactivar la secuencia ${this.displayName(sequence)}?`)) return;
    this.saving = true;
    this.companyService.deactivateLiteDocumentSequence(sequence.name, this.activeBusinessId)
      .pipe(finalize(() => { this.saving = false; }))
      .subscribe({
        next: () => {
          toast.success('Secuencia desactivada. El registro se conserva.');
          this.refreshSetupAndSequences();
        },
        error: (error) => toast.error(this.readError(error))
      });
  }

  displayName(sequence: any): string {
    return `${sequence?.document_type || 'Documento'} · ${sequence?.environment || '—'}`;
  }

  documentTypeLabel(documentType: unknown): string {
    const key = this.normalize(documentType);
    if (key === 'FACTURA') return 'Factura';
    if (key === 'NOTA DE CREDITO') return 'Nota de Crédito';
    if (key === 'GUIA DE REMISION') return 'Guía de Remisión';
    return String(documentType || '—');
  }

  isActive(sequence: any): boolean {
    return this.normalize(sequence?.status || '') === 'ACTIVO';
  }

  canEmit(sequence: any): boolean {
    const current = this.numberValue(sequence?.current_number);
    const backendCanEmit = sequence?.can_emit === undefined || sequence?.can_emit === null
      ? current < 999999999
      : this.toBoolean(sequence.can_emit);
    return this.isActive(sequence) && backendCanEmit && current < 999999999;
  }

  /**
   * Devuelve la secuencia de la ubicación actualmente configurada. Aunque el
   * endpoint ya se consulta por establecimiento y punto, este filtro evita
   * que una respuesta amplia del backend haga aparecer una secuencia ajena.
   */
  sequenceFor(documentType: string, environment: string): any | null {
    const matches = this.sequences.filter((sequence) =>
      this.matchesSelectedLocation(sequence)
      && this.normalize(sequence?.document_type) === this.normalize(documentType)
      && this.normalizeEnvironment(sequence?.environment) === this.normalizeEnvironment(environment)
    );
    // Si conviven una secuencia activa y otras inactivas, la activa es la que numera.
    return matches.find((sequence) => this.isActive(sequence)) || matches[0] || null;
  }

  sequenceState(sequence: any | null): 'ready' | 'blocked' | 'missing' {
    if (!sequence) return 'missing';
    return this.canEmit(sequence) ? 'ready' : 'blocked';
  }

  nextNumber(sequence: any): string {
    return this.formatNumber(this.nextValue(sequence));
  }

  private nextValue(sequence: any): number {
    const backendNext = this.numberValue(sequence?.next_number);
    const current = this.numberValue(sequence?.current_number);
    return sequence?.next_number !== undefined && sequence?.next_number !== null && backendNext > 0
      ? backendNext
      : current + 1;
  }

  formatNumber(value: unknown): string {
    const number = this.numberValue(value);
    return number >= 0 ? String(number).padStart(9, '0') : '—';
  }

  trackBy = (_index: number, item: any): string => String(item?.name || `${item?.document_type}-${item?.environment}-${_index}`);

  private syncBusiness(): void {
    const business = this.activeBusinessId;
    if (business !== this.loadedBusiness) {
      this.loadedBusiness = business;
      this.loadedCombination = '';
      this.selectedEstablishmentId = '';
      this.selectedEmissionPointId = '';
      this.sequences = [];
      this.error = '';
      this.modalOpen = false;
      this.editing = null;
      const requested = this.requestedLocation;
      const establishment = this.capabilities.selectedLiteEstablishment;
      const point = this.capabilities.selectedLiteEmissionPoint;
      const requestedIsValid = this.activeEstablishments.some((item: any) => String(item?.name || '') === requested.establishment)
        && this.capabilities.activeEmissionPointsFor(requested.establishment).some((item: any) => String(item?.name || '') === requested.point);
      if (requestedIsValid) {
        this.selectedEstablishmentId = requested.establishment;
        this.selectedEmissionPointId = requested.point;
      } else {
        if (establishment) this.selectedEstablishmentId = String(establishment.name || '');
        if (point && this.selectedEstablishmentId) this.selectedEmissionPointId = String(point.name || '');
      }
      this.loadSequences();
      return;
    }

    if (!this.selectedEstablishmentId) {
      const establishment = this.capabilities.selectedLiteEstablishment;
      if (establishment && this.activeEstablishments.some((item: any) => String(item?.name || '') === String(establishment.name || ''))) {
        this.selectedEstablishmentId = String(establishment.name);
      }
    }
    if (!this.selectedEmissionPointId) {
      const point = this.capabilities.selectedLiteEmissionPoint;
      if (point && this.activeEmissionPoints.some((item: any) => String(item?.name || '') === String(point.name || ''))) {
        this.selectedEmissionPointId = String(point.name);
      }
    }
    const combination = `${business}|${this.selectedEstablishmentId}|${this.selectedEmissionPointId}`;
    if (combination !== this.loadedCombination && this.selectedEstablishmentId && this.selectedEmissionPointId) this.loadSequences();
  }

  private loadSequences(): void {
    const business = this.activeBusinessId;
    const establishment = this.selectedEstablishmentId;
    const point = this.selectedEmissionPointId;
    const requestId = ++this.requestId;
    this.sequences = [];
    this.error = '';
    this.loadedCombination = `${business}|${establishment}|${point}`;
    if (!business) {
      this.error = 'Debe seleccionar un negocio antes de consultar secuencias.';
      return;
    }
    if (!establishment || !point) {
      this.error = 'Seleccione un establecimiento y un punto de emisión activos.';
      return;
    }

    this.loading = true;
    this.companyService.getLiteDocumentSequences(business, establishment, point)
      .pipe(finalize(() => { if (requestId === this.requestId) this.loading = false; }))
      .subscribe({
        next: (rows) => {
          if (requestId !== this.requestId || business !== this.activeBusinessId || establishment !== this.selectedEstablishmentId || point !== this.selectedEmissionPointId) return;
          this.sequences = rows.filter((item: any) =>
            (!item.business || String(item.business) === business)
            && (!item.establishment || String(item.establishment) === establishment)
            && (!item.emission_point || String(item.emission_point) === point)
          );
        },
        error: (error) => {
          if (requestId !== this.requestId) return;
          this.error = this.readError(error);
          toast.error(this.error);
        }
      });
  }

  private refreshSetupAndSequences(): void {
    const business = this.activeBusinessId;
    this.loadSequences();
    if (!business) return;
    this.companyService.getLiteSetup(business).subscribe({
      next: (setup) => {
        this.capabilities.setLiteSetupState(setup);
        this.loadSequences();
      },
      error: () => undefined
    });
  }

  private matchesSelectedLocation(sequence: any): boolean {
    return String(sequence?.business || this.activeBusinessId) === this.activeBusinessId
      && String(sequence?.establishment || '') === this.selectedEstablishmentId
      && String(sequence?.emission_point || sequence?.emissionPoint || '') === this.selectedEmissionPointId;
  }

  private persistSelection(): void {
    if (this.selectedEstablishmentId) {
      this.capabilities.setLiteDocumentSelection(this.selectedEstablishmentId, this.selectedEmissionPointId);
    } else {
      this.capabilities.clearLiteDocumentSelection();
    }
  }

  private setStructuralControls(disabled: boolean): void {
    if (!this.form) return;
    // La ubicación siempre sale de los selectores activos de la pantalla;
    // nunca se cambia accidentalmente desde el modal. En edición también se
    // bloquean tipo y ambiente: para otra combinación se crea una secuencia.
    ['establishment', 'emission_point'].forEach((key) => this.form.get(key)?.disable({ emitEvent: false }));
    ['document_type', 'environment'].forEach((key) => {
      const control = this.form.get(key);
      if (disabled) control?.disable({ emitEvent: false });
      else control?.enable({ emitEvent: false });
    });
  }

  private normalize(value: unknown): string {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  }

  private normalizeEnvironment(value: unknown): string {
    return this.normalize(value) === 'PRODUCCION' ? 'Produccion' : 'Pruebas';
  }

  private numberValue(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  }

  private label(code: unknown, name: unknown): string {
    const normalizedCode = String(code || '').trim();
    const normalizedName = String(name || '').trim();
    return normalizedCode ? `${normalizedCode} - ${normalizedName}` : normalizedName;
  }

  private toBoolean(value: unknown): boolean {
    return value === true || value === 1 || String(value).toLowerCase() === 'true' || String(value) === '1';
  }

  private readError(error: any): string {
    if (Number(error?.status) === 403) return 'No tiene permisos para administrar secuencias en este negocio.';
    return this.frappeError.handle(error) || 'No se pudo completar la operación.';
  }
}
