import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { OnlyNumbersDirective } from 'src/app/core/directives/only-numbers.directive';
import { CompanyService } from 'src/app/services/company.service';
import { AlertService } from '../../core/services/alert.service';
import { UtilsService } from '../../core/services/utils.service';

@Component({
  selector: 'app-company',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, OnlyNumbersDirective],
  templateUrl: './company.component.html',
  styleUrl: './company.component.css'
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
      clave: ['', Validators.required] // Password para la firma
    });
  }

  loadCompanyInfo() {
    this.service.getAll().subscribe((resp: any) => {
      const company = resp?.data?.[0] ?? resp?.message?.data?.[0];
      if (!company) return;

      this.companyId = company.name;
      // Frappe guarda 'ambiente' como string; para el switch usamos boolean (true = producción)
      const ambienteBool = company.ambiente === 'PRUEBAS' ? false : true;
      this.form.patchValue({ ...company, ambiente: ambienteBool, logo: company.logo || '',urlfirma: company.urlfirma || '' });

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

  const afterUpload = () => this.doUpdate(); // luego de subir firma

  // 1) Si hay firma nueva, súbela privada y que Frappe setee urlfirma
  if (this.firmaFile) {
    this.service.uploadFirma(this.firmaFile, this.companyId).subscribe({
      next: (res: any) => {
        const fileUrl = res?.message?.file_url || res?.data?.file_url || res?.file_url || '';
        if (fileUrl) {
          // sincroniza el form; aunque Frappe ya lo puso en el Doc, así evitas sorpresa en la UI
          this.form.patchValue({ urlfirma: fileUrl });
        }
        // 2) si además hay logo, respeta tu flujo existente
        if (this.logoFile) {
          this.service.uploadLogo(this.logoFile, this.companyId).subscribe({
            next: (res2: any) => {
              const logoUrl = res2?.message?.file_url || res2?.data?.file_url || res2?.file_url || '';
              if (logoUrl) this.form.patchValue({ logo: logoUrl });
              afterUpload();
            },
            error: () => {
              this.alertService.error('No se pudo subir el logo');
              afterUpload(); // aún así intenta guardar lo demás
            }
          });
        } else {
          afterUpload();
        }
      },
      error: () => {
        this.alertService.error('No se pudo subir la firma (.p12)');
        // Aún puedes permitir guardar otros campos si quieres:
        // afterUpload();
      }
    });
  } else {
    // Si no hay firma nueva, conserva tu flujo actual para el logo
    if (this.logoFile) {
      this.service.uploadLogo(this.logoFile, this.companyId).subscribe({
        next: (res: any) => {
          const fileUrl = res?.message?.file_url || res?.data?.file_url || res?.file_url || '';
          if (fileUrl) this.form.patchValue({ logo: fileUrl });
          this.doUpdate();
        },
        error: () => this.alertService.error('No se pudo subir el logo')
      });
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
    this.form.patchValue({ urlfirma: '' });
  }




}
