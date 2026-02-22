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

  ambiente: 'PRUEBAS' | 'PRODUCCION' = 'PRUEBAS';

  logoFile: File | null = null;
  logoPreview: string | null = null;
  logoFileName: string | null = null;

  firmaFile: File | null = null;
  firmaFileName: string | null = null;
  showClave = false;

  certInfo?: {
    subject?: string;
    notAfter?: string;
    serialNumber?: string;
    issuer?: string;
    keyUsage?: string;
  };

  isDraggingLogo = false;
  isDraggingFirma = false;

  constructor(
    private fb: FormBuilder,
    private service: CompanyService,
    private alertService: AlertService,
    private utilsService: UtilsService,
    private spinner: NgxSpinnerService
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

  initForm(): void {
    this.form = this.fb.group({
      businessname: ['', Validators.required],
      ruc: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
      ambiente: [false],
      address: ['', Validators.required],
      phone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      establishmentcode: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
      emissionpoint: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
      invoiceseq_prod: ['', Validators.required],
      invoiceseq_pruebas: ['', Validators.required],
      ncseq_pruebas: ['', Validators.required],
      ncseq_prod: ['', Validators.required],
      logo: [''],
      urlfirma: [''],
      clave: [''],
      obligado_a_llevar_contabilidad: ['NO', Validators.required]
    });
  }

  loadCompanyInfo(): void {
    this.isLoadingCompany = true;
    this.service.getAll().pipe(finalize(() => {
      this.isLoadingCompany = false;
    })).subscribe({
      next: (resp: any) => {
        const company = resp?.data?.[0] ?? resp?.message?.data?.[0];
        if (!company) return;

        this.companyId = company.name;
        const ambienteBool = company.ambiente !== 'PRUEBAS';

        this.form.patchValue({
          ...company,
          ambiente: ambienteBool,
          logo: company.logo || '',
          urlfirma: company.urlfirma || '',
          obligado_a_llevar_contabilidad: this.normalizeContabilidad(company.obligado_a_llevar_contabilidad)
        });

        this.certInfo = {
          subject: company.cert_common_name,
          notAfter: company.cert_not_after
        };

        this.ambiente = ambienteBool ? 'PRODUCCION' : 'PRUEBAS';
        this.logoPreview = company.logo || null;
        this.updateClaveValidation();
      },
      error: () => {
        this.alertService.error('No se pudo cargar la información de la empresa');
      }
    });
  }

  cambiarAmbiente(): void {
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

  save(): void {
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
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.setLogoFile(file);
    input.value = '';
  }

  removeLogo(): void {
    this.logoFile = null;
    this.logoFileName = null;
    this.logoPreview = null;
    this.form.patchValue({ logo: '' });
  }

  onFirmaSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.setFirmaFile(file);
    input.value = '';
  }

  removeFirma(): void {
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
    const maxLogoBytes = 2 * 1024 * 1024;
    if (!file.type.startsWith('image/')) {
      this.alertService.error('El logo debe ser una imagen válida');
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
    const tooBig = file.size > 5 * 1024 * 1024;
    const badExt = !/\.p12$/i.test(file.name);
    if (tooBig || badExt) {
      this.alertService.error(badExt ? 'El archivo debe ser .p12' : 'El archivo supera 5MB');
      return;
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

    if (this.hasFirmaAvailable) {
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

    return this.service.uploadLogo(this.logoFile, this.companyId).pipe(
      tap((res: any) => {
        const logoUrl = res?.message?.file_url || res?.data?.file_url || res?.file_url || '';
        if (logoUrl) this.form.patchValue({ logo: logoUrl });
      }),
      map(() => void 0),
      catchError((error) => {
        this.alertService.error('No se pudo subir el logo');
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
        console.log('error', error);
        if (error?.message !== '__RUC_MISMATCH__') {
          this.alertService.error('Clave incorrecta o archivo .p12 inválido.');
        }
        return throwError(() => error);
      })
    );
  }

  private doUpdate(): Observable<void> {
    const { ambiente, ...payload } = this.form.value;

    return this.service.update(this.companyId, payload).pipe(
      map(() => void 0),
      catchError((error) => {
        this.alertService.error('No se pudieron guardar los cambios');
        return throwError(() => error);
      })
    );
  }

  private normalizeContabilidad(value: unknown): 'SI' | 'NO' {
    const normalized = `${value ?? ''}`.trim().toUpperCase();
    if (normalized === 'SI' || normalized === 'SÍ' || normalized === '1' || normalized === 'TRUE') {
      return 'SI';
    }
    return 'NO';
  }
}
