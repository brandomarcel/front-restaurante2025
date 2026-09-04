import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgxSpinnerService } from 'ngx-spinner';
import { catchError, finalize, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { OnlyNumbersDirective } from 'src/app/core/directives/only-numbers.directive';
import { CompanyService } from 'src/app/services/company.service';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { AlertService } from '../../core/services/alert.service';
import { UtilsService } from '../../core/services/utils.service';
import { CompanyCapabilitiesService, CompanyPlan } from 'src/app/core/services/company-capabilities.service';
import { MenuService } from 'src/app/modules/layout/services/menu.service';

interface CertificateInfo {
  subject?: string;
  issuer?: string;
  serialNumber?: string;
  validFrom?: string;
  validTo?: string;
  notAfter?: string;
  status?: string;
  lastError?: string;
  keyUsage?: string;
}

@Component({
  selector: 'app-company',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, OnlyNumbersDirective, ButtonComponent],
  templateUrl: './company.component.html',
  styleUrl: './company.component.scss'
})
export class CompanyComponent implements OnInit {
  form!: FormGroup;
  companyId = '';
  submitted = false;
  isLoadingCompany = false;
  isSaving = false;
  currentPlan: CompanyPlan | null = null;
  businesses: any[] = [];
  liteSequences: any[] = [];
  activeInvoiceSequence: any | null = null;
  liteSequenceError = '';

  ambiente: 'PRUEBAS' | 'PRODUCCION' = 'PRUEBAS';

  logoFile: File | null = null;
  logoPreview: string | null = null;
  logoFileName: string | null = null;

  firmaFile: File | null = null;
  firmaFileName: string | null = null;
  private previousCertificateReference = '';
  private previousCertificateInfo?: CertificateInfo;
  certificateConfigured = false;
  showClave = false;

  certInfo?: CertificateInfo;

  isDraggingLogo = false;
  isDraggingFirma = false;

  constructor(
    private fb: FormBuilder,
    private service: CompanyService,
    private alertService: AlertService,
    private utilsService: UtilsService,
    private spinner: NgxSpinnerService,
    private capabilities: CompanyCapabilitiesService,
    private menuService: MenuService
  ) { }

  ngOnInit(): void {
    this.initForm();
    this.loadCompanyInfo();
  }

  get f() {
    return this.form.controls;
  }

  get hasFirmaAvailable(): boolean {
    return !!(this.firmaFile || `${this.form.value?.urlfirma || ''}`.trim());
  }

  get requiresCertificatePassword(): boolean {
    return this.isLiteMode ? !!this.firmaFile : this.hasFirmaAvailable;
  }

  get certificateStatusLabel(): string {
    const backendStatus = this.certInfo?.status?.trim();
    if (backendStatus) return backendStatus;
    if (!this.certificateConfigured) return 'No configurado';
    return 'Pendiente de validar';
  }

  get certificateStatusClasses(): string {
    const status = this.normalizeStatus(this.certificateStatusLabel);
    if (status === 'VIGENTE') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (status === 'POR VENCER') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (status === 'NO CONFIGURADO' || status === 'VENCIDO' || status === 'NO VIGENTE' || status === 'ERROR DE LECTURA') return 'bg-red-100 text-red-700 border-red-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  }

  get certificateDaysRemaining(): number | null {
    const raw = this.certInfo?.validTo;
    if (!raw) return null;
    const date = this.parseCertificateDate(raw);
    if (!date) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((date.getTime() - today.getTime()) / 86400000);
  }

  get certificateIsBlocking(): boolean {
    const status = this.normalizeStatus(this.certificateStatusLabel);
    return ['NO CONFIGURADO', 'VENCIDO', 'NO VIGENTE', 'ERROR DE LECTURA'].includes(status) || !!this.certInfo?.lastError;
  }

  formatCertificateDate(value?: string): string {
    const raw = `${value || ''}`.trim();
    if (!raw) return '—';
    const datePart = raw.split(/[T ]/)[0];
    return this.formatPlanDate(datePart);
  }

  get isLiteMode(): boolean {
    return this.capabilities.isLiteMode;
  }

  get activeBusiness(): any | null {
    return this.capabilities.activeBusiness;
  }

  get canEditLiteSetup(): boolean {
    return !this.isLiteMode || this.capabilities.canManageBusinessSetup;
  }

  get hasValidLiteInvoiceSequence(): boolean {
    return !!this.activeInvoiceSequence && !this.liteSequenceError;
  }

  get liteSequenceCurrentNumber(): number | null {
    const value = this.activeInvoiceSequence?.current_number;
    return value === undefined || value === null || value === '' ? null : Number(value);
  }

  initForm(): void {
    this.form = this.fb.group({
      businessname: ['', Validators.required],
      business_name: [''],
      legal_name: [''],
      trade_name: [''],
      ruc: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
      ambiente: [false],
      address: ['', Validators.required],
      phone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      business_mode: [{ value: 'RESTAURANTE', disabled: true }, Validators.required],
      establishmentcode: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
      emissionpoint: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
      establishment_name: ['Matriz'],
      emission_point_name: ['Caja 001'],
      current_number: [0, [Validators.min(0)]],
      sequence_environment: ['PRUEBAS'],
      invoiceseq_prod: ['', Validators.required],
      invoiceseq_pruebas: ['', Validators.required],
      ncseq_pruebas: ['', Validators.required],
      ncseq_prod: ['', Validators.required],
      logo: [''],
      urlfirma: [''],
      clave: [''],
      service_base_url: [''],
      obligado_a_llevar_contabilidad: ['NO', Validators.required],
      enable_provider_ruc: [false],
      // Se muestra únicamente el valor administrado por backend.
      provider_ruc: ['']
    });
  }

  loadCompanyInfo(): void {
    this.isLoadingCompany = true;
    const activeBusiness = this.capabilities.activeBusinessId
      || localStorage.getItem('active_business')
      || localStorage.getItem('businessId')
      || '';
    if (!activeBusiness) {
      this.isLoadingCompany = false;
      this.alertService.error('No hay una empresa activa. Selecciona una empresa desde el inicio de sesión.');
      return;
    }
    this.service.getLiteSetup(activeBusiness).pipe(finalize(() => {
      this.isLoadingCompany = false;
    })).subscribe({
      next: (response: any) => {
        const setupData = response?.data ?? response?.message?.data ?? response ?? {};
        this.capabilities.setLiteSetupState(setupData);
        this.currentPlan = this.capabilities.plan;
        this.businesses = Array.isArray(this.capabilities.businesses) ? this.capabilities.businesses : [];
        const company = this.service.normalizeLiteSetup(setupData);
        if (!company) return;

        this.companyId = company.name || company.business || this.capabilities.businessId || '';
        // En Lite la fuente de verdad es tax_profile.environment. El servicio
        // ya lo normaliza a `environment`/`ambiente`, pero mantenemos el
        // fallback para respuestas parciales y formatos antiguos.
        const taxProfileEnvironment = setupData?.tax_profile?.environment
          ?? setupData?.tax_profile?.ambiente;
        const ambiente = this.normalizeEnvironment(
          taxProfileEnvironment ?? company.environment ?? company.ambiente
        );
        const ambienteBool = ambiente === 'PRODUCCION';

        this.form.patchValue({
          ...company,
          ambiente: ambienteBool,
          logo: company.logo || '',
          urlfirma: company.urlfirma || company.certificate_reference || '',
          service_base_url: company.service_base_url || '',
          business_mode: this.normalizeBusinessMode(company.business_mode),
          obligado_a_llevar_contabilidad: this.normalizeContabilidad(company.obligado_a_llevar_contabilidad),
          enable_provider_ruc: this.normalizeCheck(company.enable_provider_ruc),
          provider_ruc: company.provider_ruc || company.software_provider_ruc || ''
        });
        const hasCertificatePassword = company.has_certificate_password;
        this.certificateConfigured = hasCertificatePassword !== undefined && hasCertificatePassword !== null
          ? this.normalizeCheck(hasCertificatePassword)
          : !!`${company.urlfirma || company.certificate_reference || ''}`.trim();
        this.updateProviderRucValidation();

        this.applyCertificateInfo(company);

        this.ambiente = ambienteBool ? 'PRODUCCION' : 'PRUEBAS';
        this.liteSequences = Array.isArray(setupData?.sequences) ? setupData.sequences : [];
        this.updateLiteInvoiceSequence(this.ambiente);
        this.form.patchValue({ sequence_environment: this.ambiente }, { emitEvent: false });
        // Mantener sincronizados el indicador global, POS, facturación y el
        // menú de perfil al entrar directamente a Configuración.
        localStorage.setItem('ambiente', this.ambiente);
        this.utilsService.cambiarAmbiente(this.ambiente);
        this.logoPreview = company.logo || null;
        this.updateClaveValidation();
      },
      error: (error: any) => {
        if (error?.status === 403 && !this.isPermissionError(error)) {
          localStorage.removeItem('active_business');
          localStorage.removeItem('businessId');
        }
        this.alertService.error(this.readBackendError(error) || 'No se pudo cargar la información de la empresa');
      }
    });
  }

  get planName(): string {
    return this.currentPlan?.plan_name || this.currentPlan?.plan || 'Sin plan activo';
  }

  get planStatus(): string {
    return `${this.currentPlan?.status || 'SIN PLAN'}`.toUpperCase();
  }

  get hasCurrentPlan(): boolean {
    return !!this.currentPlan;
  }

  get liteSetupReady(): boolean | null {
    return this.capabilities.liteSetupReady;
  }

  get liteSetupMissing(): string[] {
    return this.capabilities.liteSetupMissing;
  }

  get liteSetupMissingLabel(): string {
    const labels: Record<string, string> = {
      tax_profile: 'Perfil tributario',
      establishment: 'Establecimiento',
      emission_point: 'Punto de emisión',
      invoice_sequence: 'Secuencia de factura'
    };
    return this.liteSetupMissing.map((item) => labels[item] || item).join(', ');
  }

  get planIsInactive(): boolean {
    return !!this.currentPlan && this.currentPlan.active === false;
  }

  get planStatusClasses(): string {
    return this.getPlanStatusClasses(this.planStatus);
  }

  get planUnlimitedVouchers(): boolean {
    return !!this.currentPlan?.unlimited_authorized_vouchers || Number(this.currentPlan?.remaining_authorized_vouchers) === -1;
  }

  get planUsedVouchers(): number {
    return Number(this.currentPlan?.used_authorized_vouchers) || 0;
  }

  get planPurchasedVouchers(): number {
    return Number(this.currentPlan?.purchased_authorized_vouchers) || 0;
  }

  get planRemainingLabel(): string {
    if (!this.currentPlan) return '—';
    if (this.planUnlimitedVouchers) return 'Ilimitados';
    return `${Number(this.currentPlan.remaining_authorized_vouchers) || 0}`;
  }

  get planVoucherUsageLabel(): string {
    if (!this.currentPlan) return '—';
    if (this.planUnlimitedVouchers) return `${this.planUsedVouchers} usados / Ilimitados`;
    return `${this.planUsedVouchers} usados / ${this.planPurchasedVouchers} incluidos`;
  }

  get planConsumptionLabel(): string {
    if (!this.currentPlan) return '—';
    return this.planUnlimitedVouchers ? 'Ilimitada' : 'Por comprobantes';
  }

  get shouldShowAutoRenew(): boolean {
    return this.currentPlan?.auto_renew !== undefined && this.currentPlan?.auto_renew !== null && `${this.currentPlan?.auto_renew}` !== '';
  }

  get autoRenewLabel(): string {
    const value = this.currentPlan?.auto_renew;
    return value === true || value === 1 || `${value ?? ''}` === '1' ? 'Sí' : 'No';
  }

  cambiarAmbiente(): void {
    if (this.isLiteMode) {
      this.onLiteEnvironmentSelected(this.form.value.ambiente ? 'PRODUCCION' : 'PRUEBAS');
      return;
    }

    if (!this.companyId) return;

    this.ambiente = this.form.value.ambiente ? 'PRODUCCION' : 'PRUEBAS';
    this.service.update(this.companyId, { ambiente: this.ambiente }).subscribe({
      next: (res: any) => {
        const nuevoAmbiente = res?.data?.ambiente || this.ambiente;
        this.alertService.success('Ambiente cambiado correctamente');
        localStorage.setItem('ambiente', nuevoAmbiente);
        this.utilsService.cambiarAmbiente(nuevoAmbiente);
      },
      error: () => this.alertService.error('No se pudo cambiar el ambiente')
    });
  }

  onLiteEnvironmentSelected(value: string): void {
    const target = this.normalizeEnvironment(value);
    const previous = this.ambiente;
    if (target === previous) {
      this.updateLiteInvoiceSequence(target);
      return;
    }

    const sequence = this.findLiteInvoiceSequence(target);
    if (!sequence) {
      this.form.patchValue({
        sequence_environment: previous,
        ambiente: previous === 'PRODUCCION'
      }, { emitEvent: false });
      this.updateLiteInvoiceSequence(previous);
      this.alertService.error('No existe una secuencia activa para este ambiente.');
      return;
    }

    if (target === 'PRODUCCION') {
      const status = this.normalizeStatus(this.certificateStatusLabel);
      if (this.certificateIsBlocking || !this.certificateConfigured || !['VIGENTE', 'POR VENCER'].includes(status)) {
        this.form.patchValue({
          sequence_environment: previous,
          ambiente: previous === 'PRODUCCION'
        }, { emitEvent: false });
        this.alertService.error('Configura un certificado vigente antes de cambiar a Produccion.');
        return;
      }
    }

    this.alertService.confirm(
      `¿Deseas cambiar el ambiente a ${target === 'PRODUCCION' ? 'Produccion' : 'Pruebas'}?`,
      'Se utilizará la secuencia activa de ese ambiente.'
    ).then((result) => {
      if (!result.isConfirmed) {
        this.form.patchValue({
          sequence_environment: previous,
          ambiente: previous === 'PRODUCCION'
        }, { emitEvent: false });
        return;
      }

      this.isSaving = true;
      this.spinner.show();
      this.service.saveLiteSetup(this.buildLiteSetupPayload(target)).pipe(
        switchMap(() => this.service.getLiteSetup(this.companyId)),
        finalize(() => {
          this.isSaving = false;
          this.spinner.hide();
        })
      ).subscribe({
        next: (response: any) => {
          const data = response?.data ?? response?.message?.data ?? response ?? {};
          this.capabilities.setLiteSetupState(data);
          this.alertService.success('Ambiente actualizado correctamente.');
          this.loadCompanyInfo();
        },
        error: (error: any) => {
          this.form.patchValue({
            sequence_environment: previous,
            ambiente: previous === 'PRODUCCION'
          }, { emitEvent: false });
          this.ambiente = previous;
          this.updateLiteInvoiceSequence(previous);
          this.alertService.error(this.readBackendError(error) || 'No se pudo cambiar el ambiente.');
        }
      });
    });
  }

  save(): void {
    if (this.isLiteMode) {
      if (!this.canEditLiteSetup) {
        this.alertService.error('Solo el administrador del negocio puede modificar esta configuración.');
        return;
      }
      this.saveLiteSetup();
      return;
    }

    this.submitted = true;
    this.updateClaveValidation();

    if (this.form.invalid || !this.companyId || this.isSaving) return;

    this.isSaving = true;
    this.spinner.show();

    of(null).pipe(
      switchMap(() => this.uploadFirmaIfNeeded()),
      switchMap(() => this.uploadLogoIfNeeded()),
      switchMap(() => this.analyzeFirmaIfNeeded()),
      switchMap(() => this.doUpdate()),
      switchMap(() => this.refreshCompanyCapabilities()),
      finalize(() => {
        this.isSaving = false;
        this.spinner.hide();
      })
    ).subscribe({
      next: () => {
        this.alertService.success('Datos actualizados correctamente');
        this.submitted = false;
      },
      error: () => { }
    });
  }

  onLogoSelected(event: Event): void {
    if (!this.canEditLiteSetup) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.setLogoFile(file);
    input.value = '';
  }

  removeLogo(): void {
    if (this.isLiteMode) {
      // Lite no expone un endpoint de eliminación: conservar el logo vigente
      // hasta que el usuario cargue uno nuevo.
      this.logoFile = null;
      this.logoFileName = null;
      this.logoPreview = `${this.form.get('logo')?.value || ''}`.trim() || null;
      return;
    }
    this.logoFile = null;
    this.logoFileName = null;
    this.logoPreview = null;
    this.form.patchValue({ logo: '' });
  }

  onFirmaSelected(event: Event): void {
    if (!this.canEditLiteSetup) return;
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.setFirmaFile(file);
    input.value = '';
  }

  removeFirma(): void {
    if (this.isLiteMode) {
      // En Lite no existe eliminación desde este formulario: sin un archivo
      // nuevo el certificado vigente debe conservarse en el backend.
      if (!this.firmaFile) return;
      this.firmaFile = null;
      this.firmaFileName = null;
      this.form.patchValue({ urlfirma: this.previousCertificateReference }, { emitEvent: false });
      this.certInfo = this.previousCertificateInfo;
      this.certificateConfigured = !!this.previousCertificateReference || !!this.previousCertificateInfo;
      this.previousCertificateReference = '';
      this.previousCertificateInfo = undefined;
      this.updateClaveValidation();
      return;
    }

    this.firmaFile = null;
    this.firmaFileName = null;
    this.certInfo = undefined;
    this.form.patchValue({ urlfirma: '' });
    this.updateClaveValidation();
  }

  onLogoDragOver(evt: DragEvent): void {
    evt.preventDefault();
    evt.stopPropagation();
    this.isDraggingLogo = true;
  }

  onLogoDragLeave(evt: DragEvent): void {
    evt.preventDefault();
    evt.stopPropagation();
    this.isDraggingLogo = false;
  }

  onLogoDrop(evt: DragEvent): void {
    evt.preventDefault();
    evt.stopPropagation();
    this.isDraggingLogo = false;
    const file = evt.dataTransfer?.files?.[0];
    if (!file) return;
    this.setLogoFile(file);
  }

  onFirmaDragOver(evt: DragEvent): void {
    evt.preventDefault();
    evt.stopPropagation();
    this.isDraggingFirma = true;
  }

  onFirmaDragLeave(evt: DragEvent): void {
    evt.preventDefault();
    evt.stopPropagation();
    this.isDraggingFirma = false;
  }

  onFirmaDrop(evt: DragEvent): void {
    evt.preventDefault();
    evt.stopPropagation();
    this.isDraggingFirma = false;
    const file = evt.dataTransfer?.files?.[0];
    if (!file) return;
    this.setFirmaFile(file);
  }

  private setLogoFile(file: File): void {
    if (!this.canEditLiteSetup) return;
    const maxLogoBytes = 2 * 1024 * 1024;
    const validExtension = /\.(png|jpe?g|webp)$/i.test(file.name || '');
    const validMime = ['image/png', 'image/jpeg', 'image/webp'].includes((file.type || '').toLowerCase());
    if (!file.size || !validExtension || (file.type && !validMime)) {
      this.alertService.error('El logo debe ser una imagen PNG, JPG/JPEG o WEBP válida.');
      return;
    }
    if (file.size > maxLogoBytes) {
      this.alertService.error('El logo supera 2MB');
      return;
    }

    this.logoFile = file;
    this.logoFileName = file.name;
    const reader = new FileReader();
    reader.onload = () => (this.logoPreview = reader.result as string);
    reader.readAsDataURL(file);
  }

  private setFirmaFile(file: File): void {
    if (!this.canEditLiteSetup) return;
    const empty = file.size <= 0;
    const tooBig = file.size > 5 * 1024 * 1024;
    const badExt = !/\.(p12|pfx)$/i.test(file.name);
    if (empty || tooBig || badExt) {
      const message = empty
        ? 'El certificado está vacío.'
        : badExt
          ? 'El certificado debe tener extensión .p12 o .pfx'
          : 'El archivo supera 5MB';
      this.alertService.error(message);
      return;
    }

    if (!this.firmaFile) {
      this.previousCertificateReference = `${this.form.get('urlfirma')?.value || ''}`.trim();
      this.previousCertificateInfo = this.certInfo ? { ...this.certInfo } : undefined;
    }
    this.firmaFile = file;
    this.firmaFileName = file.name;
    this.certInfo = undefined;
    // Evita analizar accidentalmente la firma anterior mientras se reemplaza.
    this.form.patchValue({ urlfirma: '' });
    this.updateClaveValidation();
  }

  private updateClaveValidation(): void {
    const claveCtrl = this.form.get('clave');
    if (!claveCtrl) return;

    if (this.requiresCertificatePassword) {
      claveCtrl.setValidators([Validators.required]);
    } else {
      claveCtrl.clearValidators();
      claveCtrl.setValue('', { emitEvent: false });
    }
    claveCtrl.updateValueAndValidity({ emitEvent: false });
  }

  private uploadFirmaIfNeeded(): Observable<void> {
    if (!this.firmaFile) return of(void 0);

    return this.service.uploadFirma(this.firmaFile, this.companyId).pipe(
      tap((res: any) => {
        const fileUrl = res?.message?.file_url || res?.data?.file_url || res?.file_url || '';
        if (!fileUrl) {
          throw new Error('__FIRMA_UPLOAD_NO_URL__');
        }
        this.form.patchValue({ urlfirma: fileUrl });
        this.updateClaveValidation();
      }),
      map(() => void 0),
      catchError((error) => {
        if (error?.message === '__FIRMA_UPLOAD_NO_URL__') {
          this.alertService.error('La firma se subió, pero no se obtuvo la URL del archivo. Intenta nuevamente.');
        } else {
          this.alertService.error('No se pudo subir la firma (.p12)');
        }
        return throwError(() => error);
      })
    );
  }

  private uploadLogoIfNeeded(): Observable<void> {
    if (!this.logoFile) return of(void 0);

    const business = this.companyId || this.capabilities.businessId || localStorage.getItem('businessId') || '';
    if (this.isLiteMode && !business) {
      return throwError(() => new Error('__MISSING_LITE_BUSINESS__'));
    }

    const request$ = this.isLiteMode
      ? this.service.uploadLiteLogo(business, this.logoFile)
      : this.service.uploadLogo(this.logoFile, this.companyId);

    return request$.pipe(
      tap((res: any) => {
        const data = res?.data ?? res?.message?.data ?? res ?? {};
        const logoUrl = data?.file_url || data?.business?.logo || data?.logo || '';
        if (!logoUrl) throw new Error('__LOGO_UPLOAD_NO_URL__');
        this.form.patchValue({ logo: logoUrl }, { emitEvent: false });
        this.logoPreview = logoUrl;
      }),
      map(() => void 0),
      catchError((error) => {
        const message = error?.message === '__LOGO_UPLOAD_NO_URL__'
          ? 'El logo se cargó, pero el backend no devolvió su URL.'
          : this.readBackendError(error) || 'No se pudo subir el logo.';
        this.alertService.error(message);
        return throwError(() => error);
      })
    );
  }

  private analyzeFirmaIfNeeded(): Observable<void> {
    if (!this.hasFirmaAvailable) return of(void 0);

    const clave = `${this.form.value?.clave || ''}`.trim();
    if (!clave) {
      this.alertService.error('Ingresa la clave de la firma para validar el certificado.');
      return throwError(() => new Error('__MISSING_CLAVE__'));
    }

    return this.service.analyzeFirma(clave, this.companyId, undefined, this.form.value.urlfirma, 1).pipe(
      tap((response: any) => {
        const info = response?.message?.info || response?.info || {};

        this.certInfo = {
          subject: info.common_name || info.subject || this.certInfo?.subject,
          notAfter: info.not_after || info.notAfter || this.certInfo?.notAfter,
          serialNumber: info.serial_number_hex || info.serialNumber || this.certInfo?.serialNumber,
          issuer: info.issuer || this.certInfo?.issuer,
          keyUsage: info.key_usage || info.keyUsage || this.certInfo?.keyUsage
        };

        // if (info?.ruc_mismatch) {
        //   this.alertService.error('El RUC de la compañía no coincide con el del certificado.');
        //   throw new Error('__RUC_MISMATCH__');
        // }
      }),
      map(() => void 0),
      catchError((error) => {
        if (error?.message !== '__RUC_MISMATCH__') {
          this.alertService.error('Clave incorrecta o archivo .p12 inválido.');
        }
        return throwError(() => error);
      })
    );
  }

  private doUpdate(): Observable<void> {
    // Ambiente se cambia con su propio switch; business_mode y RUC proveedor son configuración administrada.
    const { ambiente, business_mode, enable_provider_ruc, provider_ruc, ruc, ...payload } = this.form.getRawValue();

    return this.service.update(this.companyId, payload).pipe(
      map(() => void 0),
      catchError((error) => {
        this.alertService.error('No se pudieron guardar los cambios');
        return throwError(() => error);
      })
    );
  }

  private normalizeEnvironment(value: unknown): 'PRUEBAS' | 'PRODUCCION' {
    const normalized = String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();
    return normalized.includes('PROD') ? 'PRODUCCION' : 'PRUEBAS';
  }

  private toBackendEnvironment(value: unknown): 'Pruebas' | 'Produccion' {
    return this.normalizeEnvironment(value) === 'PRODUCCION' ? 'Produccion' : 'Pruebas';
  }

  private findLiteInvoiceSequence(environment: 'PRUEBAS' | 'PRODUCCION'): any | null {
    const target = this.normalizeEnvironment(environment);
    return this.liteSequences.find((sequence: any) => {
      const documentType = this.normalizeStatus(sequence?.document_type ?? sequence?.documentType);
      const sequenceEnvironment = this.normalizeEnvironment(sequence?.environment);
      const status = this.normalizeStatus(sequence?.status);
      return documentType === 'FACTURA' && sequenceEnvironment === target && status === 'ACTIVO';
    }) || null;
  }

  private updateLiteInvoiceSequence(environment: 'PRUEBAS' | 'PRODUCCION'): void {
    if (!this.isLiteMode) return;
    this.activeInvoiceSequence = this.findLiteInvoiceSequence(environment);
    this.liteSequenceError = this.activeInvoiceSequence
      ? ''
      : 'No existe una secuencia activa para este ambiente';
    if (this.activeInvoiceSequence) {
      this.form.patchValue({
        current_number: this.activeInvoiceSequence.current_number ?? 0,
        sequence_environment: environment
      }, { emitEvent: false });
    }
  }

  private uploadLiteCertificateIfNeeded(): Observable<void> {
    if (!this.firmaFile) return of(void 0);

    const password = `${this.form.get('clave')?.value || ''}`.trim();
    if (!password) {
      this.alertService.error('Ingresa la contraseña del certificado.');
      return throwError(() => new Error('__MISSING_CERTIFICATE_PASSWORD__'));
    }

    const business = this.companyId || this.capabilities.businessId || localStorage.getItem('businessId') || '';
    if (!business) {
      this.alertService.error('No se encontró el negocio para cargar el certificado.');
      return throwError(() => new Error('__MISSING_LITE_BUSINESS__'));
    }

    return this.service.uploadLiteCertificate(business, this.firmaFile, password).pipe(
      tap((response: any) => {
        const data = response?.data ?? response?.message?.data ?? response ?? {};
        const taxProfile = data?.tax_profile ?? {};
        const fileUrl = data?.file_url || taxProfile?.certificate_reference || data?.certificate_reference || '';
        if (!fileUrl) throw new Error('__CERTIFICATE_UPLOAD_NO_URL__');

        this.form.patchValue({ urlfirma: fileUrl }, { emitEvent: false });
        this.certificateConfigured = taxProfile?.has_certificate_password !== undefined
          ? this.normalizeCheck(taxProfile.has_certificate_password)
          : !!fileUrl;
        this.previousCertificateReference = '';
        this.previousCertificateInfo = undefined;
        this.updateClaveValidation();
      }),
      map(() => void 0),
      catchError((error) => {
        if (this.previousCertificateReference) {
          this.form.patchValue({ urlfirma: this.previousCertificateReference }, { emitEvent: false });
          this.certInfo = this.previousCertificateInfo;
        }
        if (error?.message === '__CERTIFICATE_UPLOAD_NO_URL__') {
          this.alertService.error('El certificado se subió, pero el backend no devolvió su referencia.');
        } else if (error?.message !== '__MISSING_CERTIFICATE_PASSWORD__') {
          this.alertService.error(this.readBackendError(error) || 'No se pudo cargar el certificado.');
        }
        return throwError(() => error);
      })
    );
  }

  private refreshLiteSetupAfterCertificate(): Observable<void> {
    const business = this.companyId || this.capabilities.businessId || localStorage.getItem('businessId') || '';
    if (!business) return throwError(() => new Error('__MISSING_LITE_BUSINESS__'));

    return this.service.getLiteSetup(business).pipe(
      tap((response: any) => this.applyLiteSetupCertificate(response)),
      map(() => void 0),
      catchError((error) => {
        this.alertService.error(this.readBackendError(error) || 'El certificado se cargó, pero no se pudo consultar la configuración actualizada.');
        return throwError(() => error);
      })
    );
  }

  private applyLiteSetupCertificate(response: any): void {
    const data = response?.data ?? response?.message?.data ?? response ?? {};
    this.capabilities.setLiteSetupState(data);
    this.currentPlan = this.capabilities.plan;
    this.liteSequences = Array.isArray(data?.sequences) ? data.sequences : this.liteSequences;
    const setupEnvironment = data?.tax_profile?.environment ?? data?.tax_profile?.ambiente;
    if (setupEnvironment) {
      this.ambiente = this.normalizeEnvironment(setupEnvironment);
      this.form.patchValue({
        ambiente: this.ambiente === 'PRODUCCION',
        sequence_environment: this.ambiente
      }, { emitEvent: false });
      this.updateLiteInvoiceSequence(this.ambiente);
    }
    const taxProfile = data?.tax_profile ?? {};
    const fileUrl = data?.file_url || taxProfile?.certificate_reference || data?.certificate_reference || '';
    if (fileUrl) this.form.patchValue({ urlfirma: fileUrl }, { emitEvent: false });
    const profile = { ...data, ...taxProfile };
    this.applyCertificateInfo(profile);
    if (taxProfile?.has_certificate_password !== undefined) {
      this.certificateConfigured = this.normalizeCheck(taxProfile.has_certificate_password);
    } else if (fileUrl) {
      this.certificateConfigured = true;
    }
  }

  private applyCertificateInfo(source: any): void {
    const profile = source?.tax_profile && typeof source.tax_profile === 'object'
      ? { ...source, ...source.tax_profile }
      : (source || {});
    this.certInfo = {
      subject: profile.certificate_subject || profile.cert_common_name || profile.subject || undefined,
      issuer: profile.certificate_issuer || profile.issuer || undefined,
      serialNumber: profile.certificate_serial || profile.serial_number || profile.serialNumber || undefined,
      validFrom: profile.certificate_valid_from || undefined,
      validTo: profile.certificate_valid_to || undefined,
      notAfter: profile.certificate_valid_to || profile.cert_not_after || undefined,
      status: profile.certificate_status || undefined,
      lastError: profile.certificate_last_error || undefined
    };
    const hasInfo = Object.values(this.certInfo).some((value) => `${value ?? ''}`.trim() !== '');
    if (!hasInfo) this.certInfo = undefined;
    this.certificateConfigured = profile.has_certificate_password !== undefined
      ? this.normalizeCheck(profile.has_certificate_password)
      : this.certificateConfigured;
    const hasPassword = profile.has_certificate_password;
    const fallbackStatus = hasPassword !== undefined
      ? (this.normalizeCheck(hasPassword) ? '' : 'NO CONFIGURADO')
      : undefined;
    this.capabilities.setCertificateStatus(
      profile.certificate_status ?? fallbackStatus,
      profile.certificate_last_error
    );
  }

  private readBackendError(error: any): string {
    const direct = error?.error?.message;
    if (typeof direct === 'string' && direct.trim()) return direct;
    const nested = error?.error?._server_messages;
    if (typeof nested === 'string' && nested.trim()) {
      try {
        const parsed = JSON.parse(nested);
        const first = Array.isArray(parsed) ? parsed[0] : parsed;
        const payload = typeof first === 'string' ? JSON.parse(first) : first;
        const message = payload?.message || payload?.error || payload?.title;
        if (message) return String(message);
      } catch { }
    }
    return typeof error?.message === 'string' ? error.message : '';
  }

  private isPermissionError(error: any): boolean {
    const payload = error?.error;
    const raw = [
      typeof payload === 'string' ? payload : undefined,
      payload?.exc_type,
      payload?.exception,
      payload?.exc,
      payload?._server_messages,
      payload?.message
    ].filter(Boolean).join(' ');
    return /permissionerror|permission denied|not permitted|not allowed|rol del usuario no permite/i.test(raw);
  }

  private restorePendingCertificate(): void {
    if (!this.firmaFile || (!this.previousCertificateReference && !this.previousCertificateInfo)) return;
    this.form.patchValue({ urlfirma: this.previousCertificateReference }, { emitEvent: false });
    this.certInfo = this.previousCertificateInfo;
    this.certificateConfigured = !!this.previousCertificateReference || !!this.previousCertificateInfo;
  }

  private buildLiteSetupPayload(environmentOverride?: 'PRUEBAS' | 'PRODUCCION'): any {
    const raw = this.form.getRawValue();
    const selectedEnvironment = environmentOverride || (raw.ambiente ? 'PRODUCCION' : 'PRUEBAS');
    const environment = this.toBackendEnvironment(selectedEnvironment);
    const businessName = `${raw.business_name || raw.businessname || ''}`.trim();
    const legalName = `${raw.legal_name || raw.businessname || businessName}`.trim();
    const address = `${raw.address || ''}`.trim();
    // current_number es informativo: nunca se incrementa ni se calcula en el
    // frontend. Para guardar se reenvía el valor que ya devolvió el backend.
    const currentNumber = Number(this.findLiteInvoiceSequence(selectedEnvironment)?.current_number
      ?? raw.current_number
      ?? 0) || 0;

    const payload: any = {
      business_name: businessName,
      address,
      phone: `${raw.phone || ''}`.trim(),
      email: `${raw.email || ''}`.trim(),
      environment,
      sequence_environment: environment,
      legal_name: legalName,
      trade_name: `${raw.trade_name || businessName}`.trim(),
      main_address: address,
      establishment_code: `${raw.establishmentcode || ''}`.trim(),
      establishment_name: `${raw.establishment_name || 'Matriz'}`.trim(),
      emission_point_code: `${raw.emissionpoint || ''}`.trim(),
      emission_point_name: `${raw.emission_point_name || 'Caja 001'}`.trim(),
      current_number: currentNumber
    };

    const business = this.companyId || this.capabilities.businessId || localStorage.getItem('businessId') || '';
    if (business) {
      payload.business = business;
    }

    return payload;
  }

  private saveLiteSetup(): void {
    if (!this.canEditLiteSetup) return;
    this.submitted = true;
    this.updateClaveValidation();
    this.updateProviderRucValidation();

    const requiredControls = [
      'businessname',
      'ruc',
      'address',
      'phone',
      'email',
      'establishmentcode',
      'emissionpoint',
      ...(this.requiresCertificatePassword ? ['clave'] : []),
    ];
    const hasInvalidRequired = requiredControls.some((key) => this.form.get(key)?.invalid);
    if (hasInvalidRequired || this.isSaving) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.spinner.show();

    of(null).pipe(
      switchMap(() => this.service.saveLiteSetup(this.buildLiteSetupPayload()).pipe(
        tap((response: any) => {
          this.capabilities.setLiteSetupState(response);
          this.currentPlan = this.capabilities.plan;
        })
      )),
      switchMap(() => this.uploadLiteCertificateIfNeeded()),
      switchMap(() => this.refreshLiteSetupAfterCertificate()),
      switchMap(() => this.uploadLogoIfNeeded()),
      switchMap(() => this.refreshCompanyCapabilities()),
      finalize(() => {
        this.isSaving = false;
        this.spinner.hide();
      })
    ).subscribe({
      next: () => {
        this.alertService.success('Configuración Lite actualizada correctamente');
        this.form.get('clave')?.reset('', { emitEvent: false });
        this.firmaFile = null;
        this.firmaFileName = null;
        this.updateClaveValidation();
        this.submitted = false;
      },
      error: (error) => {
        this.restorePendingCertificate();
        const message = this.readBackendError(error) || 'No se pudo guardar la configuración Lite.';
        this.alertService.error(message);
      }
    });
  }

  private refreshCompanyCapabilities(): Observable<void> {
    const business = this.companyId || this.capabilities.activeBusinessId || localStorage.getItem('active_business') || '';
    return this.service.getLiteSetup(business).pipe(
      tap((response) => {
        this.applyLiteSetupCertificate(response);
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        this.menuService.setMenuForRoles(Array.isArray(user?.roles) ? user.roles : []);
      }),
      map(() => void 0),
      catchError(() => of(void 0))
    );
  }

  private normalizeContabilidad(value: unknown): 'SI' | 'NO' {
    const normalized = `${value ?? ''}`.trim().toUpperCase();
    if (normalized === 'SI' || normalized === 'SÍ' || normalized === '1' || normalized === 'TRUE') {
      return 'SI';
    }
    return 'NO';
  }

  private normalizeBusinessMode(value: unknown): 'RESTAURANTE' | 'FACTURADOR' | 'FACTURADA_LITE' {
    const normalized = `${value ?? ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();

    if (normalized === 'LITE' || normalized.includes('FACTURADA') || normalized.includes('LITE')) {
      return 'FACTURADA_LITE';
    }

    if (normalized === 'FACTURADOR' || normalized === 'FACTURACION' || normalized.includes('FACTUR')) {
      return 'FACTURADOR';
    }

    return 'RESTAURANTE';
  }

  formatPlanDate(value?: string | null): string {
    const raw = `${value || ''}`.trim();
    if (!raw) return '—';
    const parts = raw.split('-');
    if (parts.length !== 3) return raw;
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  private getPlanStatusClasses(status: string): string {
    const normalized = `${status || ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();

    if (normalized === 'ACTIVO') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (normalized === 'PRUEBA') return 'bg-sky-100 text-sky-700 border-sky-200';
    if (normalized === 'VENCIDO') return 'bg-red-100 text-red-700 border-red-200';
    if (normalized === 'SUSPENDIDO') return 'bg-orange-100 text-orange-700 border-orange-200';
    if (normalized === 'CANCELADO' || normalized === 'RENOVADO') return 'bg-slate-100 text-slate-600 border-slate-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }

  private normalizeCheck(value: unknown): boolean {
    const normalized = `${value ?? ''}`.trim().toUpperCase();
    return value === true || value === 1 || normalized === '1' || normalized === 'TRUE' || normalized === 'SI' || normalized === 'SÍ';
  }

  private normalizeStatus(value: unknown): string {
    return `${value || ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim();
  }

  private parseCertificateDate(value: string): Date | null {
    const raw = `${value || ''}`.trim();
    const datePart = raw.split(/[T ]/)[0];
    const parts = datePart.split('-').map(Number);
    if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
    const [year, month, day] = parts;
    return new Date(year, month - 1, day);
  }

  private updateProviderRucValidation(): void {
    const providerRuc = this.form.get('provider_ruc');
    if (!providerRuc) return;

    providerRuc.clearValidators();
    providerRuc.updateValueAndValidity({ emitEvent: false });
  }
}
