import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { OnlyNumbersDirective } from 'src/app/core/directives/only-numbers.directive';
import { CompanyService } from 'src/app/services/company.service';
import { AlertService } from '../../core/services/alert.service';
import { UtilsService } from '../../core/services/utils.service';
import { ButtonComponent } from "src/app/shared/components/button/button.component";

@Component({
  selector: 'app-company',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, OnlyNumbersDirective, ButtonComponent],
  templateUrl: './company.component.html',
  styleUrl: './company.component.scss'
})
export class CompanyComponent implements OnInit {
  form!: FormGroup;
  companyId!: any;        // en tu loadCompanyInfo lo asignas con company.name
  submitted = false;

  ambiente: 'PRUEBAS' | 'PRODUCCION' = 'PRUEBAS';

  // === Logo ===
  logoFile: File | null = null;
  logoPreview: string | null = null;
  logoFileName: string | null = null;

  firmaFile: File | null = null;
  firmaFileName: string | null = null;
  showClave = false;

  certInfo?: {
    subject?: string;      // "NOMBRE APELLIDO ..."
    notAfter?: string;     // "2027-02-08 10:02:45"
    serialNumber?: string; // "123456789..."
    issuer?: string;       // cadena larga
    keyUsage?: string;     // "DigitalSignature, NonRepudiation, ..."
  };


  constructor(
    private fb: FormBuilder,
    private service: CompanyService,
    private alertService: AlertService,
    private utilsService: UtilsService
  ) { }

  ngOnInit() {
    this.initForm();
    this.loadCompanyInfo();
  }

  get f() { return this.form.controls; }

  initForm() {
    this.form = this.fb.group({
      businessname: ['', Validators.required],
      ruc: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
      ambiente: [''], // boolean (switch) - lo mapeas con cambiarAmbiente()
      address: ['', Validators.required],
      phone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      establishmentcode: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
      emissionpoint: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
      invoiceseq_prod: ['', Validators.required],
      invoiceseq_pruebas: ['', Validators.required],
      salenoteseq: ['', Validators.required],
      logo: [''], // URL del archivo en Frappe
      urlfirma: [''],             // se llenará con el file_url retornado por Frappe
      clave: [null, Validators.required] // Password para la firma
    });
  }

  loadCompanyInfo() {
    this.service.getAll().subscribe((resp: any) => {
      const company = resp?.data?.[0] ?? resp?.message?.data?.[0];
      if (!company) return;

      this.companyId = company.name;
      console.log('company', company);
      // this.logoFileName = company.logo || '';

      // Frappe guarda 'ambiente' como string; para el switch usamos boolean (true = producción)
      const ambienteBool = company.ambiente === 'PRUEBAS' ? false : true;
      this.form.patchValue({ ...company, ambiente: ambienteBool, logo: company.logo || '', urlfirma: company.urlfirma || '' });
      this.certInfo = {
        subject: company.cert_common_name,
        notAfter: company.cert_not_after,
        // not_before: company.cert_not_before,
        // serialNumber: company.serial_number_hex,
        // issuer: company.issuer,
        // keyUsage: company.key_usage
      };

      this.ambiente = ambienteBool ? 'PRODUCCION' : 'PRUEBAS';

      // Vista previa del logo si ya existe
      this.logoPreview = company.logo || null;
      console.log('this.logoPreview', this.logoPreview);
    });
  }

  cambiarAmbiente() {
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

  // ===== Logo handlers =====
  onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.logoFile = file;
    this.logoFileName = file.name;

    const reader = new FileReader();
    reader.onload = () => (this.logoPreview = reader.result as string);
    reader.readAsDataURL(file);
  }

  removeLogo() {
    this.logoFile = null;
    this.logoFileName = null;
    this.logoPreview = null;
    this.form.patchValue({ logo: '' });
  }

save() {
  this.submitted = true;
  if (this.form.invalid) return;

  // Helpers de lectura segura
  const getClave = () => (this.form.value?.clave || '').trim();
  const hasExistingFirma = !!(this.form.value?.urlfirma && `${this.form.value.urlfirma}`.trim());

  const analyzeThenUpdate = () => {
    const hasNewFirma = !!this.firmaFile;
    const hasAnyFirma = hasNewFirma || hasExistingFirma;

    // Si no hay ninguna firma, no se analiza
    if (!hasAnyFirma) return this.doUpdate();

    const clave = getClave();
    if (!clave) {
      this.alertService.error('Ingresa la clave de la firma para validar el certificado.');
      return;
    }

    // Si tu backend necesita URL explícita, pasa this.form.value.urlfirma
    this.service.analyzeFirma(clave, this.companyId, undefined, this.form.value.urlfirma, 1).subscribe({
      next: (r: any) => {
        const info = r?.message?.info || r?.info;
        if (r?.message?.info?.ruc_mismatch) {
          this.alertService.error('El RUC de la compañía no coincide con el del certificado.');
        }
        this.doUpdate();
      },
      error: () => this.alertService.error('Clave incorrecta o archivo .p12 inválido.')
    });
  };

  const afterUploadLogoThenAnalyze = () => {
    // SOLO subimos logo si existe (type narrowing con const local)
    if (this.logoFile) {
      const logoFile: File = this.logoFile; // aquí ya no es null
      this.service.uploadLogo(logoFile, this.companyId).subscribe({
        next: (res2: any) => {
          const logoUrl = res2?.message?.file_url || res2?.data?.file_url || res2?.file_url || '';
          if (logoUrl) this.form.patchValue({ logo: logoUrl });
          analyzeThenUpdate();
        },
        error: () => {
          this.alertService.error('No se pudo subir el logo');
          analyzeThenUpdate(); // continúa con análisis/guardado
        }
      });
    } else {
      analyzeThenUpdate();
    }
  };

  // --- Flujo principal ---

  // 1) Si hay firma NUEVA, súbela primero
  if (this.firmaFile) {
    const clave = getClave();
    if (!clave) {
      this.alertService.error('Ingresa la clave de la firma antes de guardar.');
      return;
    }

    const firmaFile: File = this.firmaFile; // narrowing: ya no es null aquí
    this.service.uploadFirma(firmaFile, this.companyId).subscribe({
      next: (res: any) => {
        const fileUrl = res?.message?.file_url || res?.data?.file_url || res?.file_url || '';
        if (fileUrl) this.form.patchValue({ urlfirma: fileUrl });
        // Luego logo (si hay) y después análisis
           this.certInfo = {
        subject: res.cert_common_name,
        notAfter: res.cert_not_after,
        // not_before: company.cert_not_before,
        // serialNumber: company.serial_number_hex,
        // issuer: company.issuer,
        // keyUsage: company.key_usage
      }
        afterUploadLogoThenAnalyze();
      },
      error: () => {
        this.alertService.error('No se pudo subir la firma (.p12)');
        // Si quieres permitir guardar otros campos aún con fallo, podrías llamar this.doUpdate();
      }
    });

    return; // salir para no caer en el bloque "sin firma nueva"
  }

  // 2) No hay firma nueva
  if (this.logoFile) {
    const logoFile: File = this.logoFile; // narrowing
    this.service.uploadLogo(logoFile, this.companyId).subscribe({
      next: (res: any) => {
        const fileUrl = res?.message?.file_url || res?.data?.file_url || res?.file_url || '';
        if (fileUrl) this.form.patchValue({ logo: fileUrl });

        // Validar solo si hay firma existente + clave; si no, guardar
        if (hasExistingFirma && getClave()) {
          analyzeThenUpdate();
        } else {
          this.doUpdate();
        }
      },
      error: () => {
        this.alertService.error('No se pudo subir el logo');
        if (hasExistingFirma && getClave()) {
          analyzeThenUpdate();
        } else {
          this.doUpdate();
        }
      }
    });
  } else {
    // Sin subidas: analiza solo si hay firma existente + clave
    if (hasExistingFirma && getClave()) {
      analyzeThenUpdate();
    } else {
      this.doUpdate();
    }
  }
}




  private doUpdate() {
    const { ambiente, ...payload } = this.form.value;

    // IMPORTANTE:
    // - `payload.clave` va en claro; Frappe (Password) lo cifrará al guardar.
    // - `payload.urlfirma` ya debería tener el file_url (si subiste firma).
    this.service.update(this.companyId, payload).subscribe({
      next: () => this.alertService.success('Datos actualizados correctamente'),
      error: () => this.alertService.error('No se pudieron guardar los cambios')
    });
  }

  // company.component.ts
  onFirmaSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validaciones mínimas
    const tooBig = file.size > 5 * 1024 * 1024; // 5MB
    const badExt = !/\.p12$/i.test(file.name);
    if (tooBig || badExt) {
      this.alertService.error(badExt ? 'El archivo debe ser .p12' : 'El archivo supera 5MB');
      return;
    }

    this.firmaFile = file;
    this.firmaFileName = file.name;
  }

  removeFirma() {
    this.firmaFile = null;
    this.firmaFileName = null;
    this.certInfo = undefined;
    this.form.patchValue({ urlfirma: '' });
  }

  // Flags de estado visual
  isDraggingLogo = false;
  isDraggingFirma = false;

  // === DRAG & DROP LOGO ===
  onLogoDragOver(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    this.isDraggingLogo = true;
  }
  onLogoDragLeave(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    this.isDraggingLogo = false;
  }
  onLogoDrop(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    this.isDraggingLogo = false;

    const file = evt.dataTransfer?.files?.[0];
    if (!file) return;

    // Reutiliza tu misma lógica de selección
    if (!file.type.startsWith('image/')) {
      this.alertService.error('El archivo debe ser una imagen');
      return;
    }

    // Simular el evento de input para reusar onLogoSelected
    this.logoFile = file;
    this.logoFileName = file.name;

    const reader = new FileReader();
    reader.onload = () => (this.logoPreview = reader.result as string);
    reader.readAsDataURL(file);
  }

  // === DRAG & DROP FIRMA ===
  onFirmaDragOver(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    this.isDraggingFirma = true;
  }
  onFirmaDragLeave(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    this.isDraggingFirma = false;
  }
  onFirmaDrop(evt: DragEvent) {
    evt.preventDefault();
    evt.stopPropagation();
    this.isDraggingFirma = false;

    const file = evt.dataTransfer?.files?.[0];
    if (!file) return;

    const tooBig = file.size > 5 * 1024 * 1024; // 5MB
    const badExt = !/\.p12$/i.test(file.name);
    if (tooBig || badExt) {
      this.alertService.error(badExt ? 'El archivo debe ser .p12' : 'El archivo supera 5MB');
      return;
    }

    this.firmaFile = file;
    this.firmaFileName = file.name;
  }



}
