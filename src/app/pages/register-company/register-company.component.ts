import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { RegisterCompanyService } from 'src/app/services/register-company.service';
import { CompanyInfo } from 'src/app/services/company.service';
import { toast } from 'ngx-sonner';
import { OnlyNumbersDirective } from "src/app/core/directives/only-numbers.directive"; // si usas ngx-sonner
@Component({
  selector: 'app-register-company',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgxSpinnerModule, RouterLink, OnlyNumbersDirective],
  templateUrl: './register-company.component.html'
})
export class RegisterCompanyComponent {
  form: FormGroup;
  step = 1;
  submitted = false;
  showPass = false;

  // Logo
  logoFile: File | null = null;
  logoFileName: string | null = null;
  logoPreview: string | null = null;

  ambiente: 'PRUEBAS' | 'PRODUCCION' = 'PRUEBAS';

  constructor(private fb: FormBuilder,
    private registerSvc: RegisterCompanyService,
  private spinner: NgxSpinnerService,
  private router: Router,
  ) {
    this.form = this.fb.group(
      {
        // Paso 1: cuenta
        full_name: ['', Validators.required],
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirm_password: ['', Validators.required],
        phone: [''],
        accept_terms: [false, Validators.requiredTrue],

        // Paso 2: compañía
        businessname: ['', Validators.required],
        ruc: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
        address: ['', Validators.required],
        company_phone: ['', Validators.required],
        company_email: ['', [Validators.required, Validators.email]],
        logo: [''],

        // Paso 3: SRI y secuencias
        ambiente_bool: [false], // false PRUEBAS, true PRODUCCION
        establishmentcode: ['001', [Validators.required, Validators.pattern(/^\d{3}$/)]],
        emissionpoint: ['001', [Validators.required, Validators.pattern(/^\d{3}$/)]],
        invoiceseq_prod: [1, Validators.required],
        invoiceseq_pruebas: [1, Validators.required],
        ncseq_pruebas: [1, Validators.required],
        ncseq_prod: [1, Validators.required],
      },
      { validators: this.passwordMatchValidator }
    );
  }

  get f() { return this.form.controls; }

  passwordMatchValidator = (group: AbstractControl) => {
    const pass = group.get('password')?.value;
    const confirm = group.get('confirm_password')?.value;
    return pass && confirm && pass !== confirm ? { passwordMismatch: true } : null;
  };

  // Navegación entre pasos con validación del paso actual
  nextStep() {
    this.submitted = true;
    if (!this.isCurrentStepValid()) return;
    this.submitted = false;
    this.step = Math.min(4, this.step + 1);
    if (this.step === 3) this.syncAmbiente();
  }

  prevStep() {
    this.submitted = false;
    this.step = Math.max(1, this.step - 1);
  }

  isCurrentStepValid(): boolean {
    const controlsByStep: Record<number, string[]> = {
      1: ['full_name', 'email', 'password', 'confirm_password', 'accept_terms'],
      2: ['businessname', 'ruc', 'address', 'company_phone', 'company_email'],
      3: ['establishmentcode', 'emissionpoint', 'invoiceseq_prod', 'invoiceseq_pruebas', 'ncseq_pruebas', 'ncseq_prod'],
      4: [] // revisión
    };
    const keys = controlsByStep[this.step] || [];
    keys.forEach(k => this.f[k].markAsTouched());
    return keys.every(k => this.f[k].valid) && !this.form.errors;
  }

  syncAmbiente() {
    this.ambiente = this.form.value.ambiente_bool ? 'PRODUCCION' : 'PRUEBAS';
  }

  // Logo handlers
  onLogoSelected(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.logoFile = file;
    this.logoFileName = file.name;

    const reader = new FileReader();
    reader.onload = () => this.logoPreview = reader.result as string;
    reader.readAsDataURL(file);
  }

  removeLogo() {
    this.logoFile = null;
    this.logoFileName = null;
    this.logoPreview = null;
    this.form.patchValue({ logo: '' });
  }



submit() {
  this.submitted = true;

  // Si intentan enviar antes del último paso, valida y detente.
  if (!this.isCurrentStepValid()) return;

  // Desarma full_name -> first_name / last_name
  const fullName: string = (this.form.value.full_name || '').trim();
  const [first_name, ...restParts] = fullName.split(/\s+/);
  const last_name = restParts.join(' ');

  // User payload (los roles solo se aplican si están permitidos en site_config["registration_allowed_roles"])
  const userPayload = {
    email: this.form.value.email,
    first_name,
    last_name,
    phone: this.form.value.phone,
    password: this.form.value.password,
    roles: ['System Manager'], // opcional; se filtrará en el server
    role_profile: 'ADMIN COMPANY'
  };

  // Asegura el tipo literal del ambiente para TypeScript
  const ambiente = (this.ambiente === 'PRODUCCION' ? 'PRODUCCION' : 'PRUEBAS') as 'PRODUCCION' | 'PRUEBAS';

  // Company payload
  const companyPayload = {
    businessname: this.form.value.businessname,
    ruc: this.form.value.ruc,
    address: this.form.value.address,
    phone: this.form.value.company_phone,
    email: this.form.value.company_email,
    ambiente,
    establishmentcode: this.form.value.establishmentcode,
    emissionpoint: this.form.value.emissionpoint,
    invoiceseq_prod: this.form.value.invoiceseq_prod,
    invoiceseq_pruebas: this.form.value.invoiceseq_pruebas,
    ncseq_pruebas: this.form.value.ncseq_pruebas,
    ncseq_prod: this.form.value.ncseq_prod,
  };

  // Logo payload (opcional). Usamos la dataURL ya generada en la vista previa.
  const logoPayload = this.logoFile && this.logoPreview
    ? { filename: this.logoFile.name, data: this.logoPreview, is_private: 0 as 0 | 1 }
    : undefined;

  this.spinner.show();

  this.registerSvc.registerTenantOpen({
    user: userPayload,
    company: companyPayload,
    logo: logoPayload,
    add_permission: true
  }).subscribe({
    next: (res: any) => {
      this.spinner.hide();
      const companyName = res?.company || companyPayload.businessname;
      const userName = res?.user || userPayload.email;

      toast.success(`¡Listo! Usuario ${userName} y empresa ${companyName} creados.`);

      // Limpia estado/UI
      this.form.reset();
      this.submitted = false;
      this.step = 1;
      this.ambiente = 'PRUEBAS';
      this.logoFile = null;
      this.logoFileName = null;
      this.logoPreview = null;

      // Redirige (ajusta ruta según tu app)
      this.router.navigate(['/auth/login']);
    },
    error: (err) => {
      this.spinner.hide();
      const msg = this.parseFrappeError(err);
      toast.error(msg);
      console.error('register_tenant_open error:', err);
    }
  });
}

/** Extrae un mensaje legible de errores de Frappe */
private parseFrappeError(err: any): string {
  try {
    const server = err?.error?._server_messages;
    if (server) {
      const arr = JSON.parse(server);
      const first = typeof arr[0] === 'string' ? JSON.parse(arr[0]) : arr[0];
      return first?.message || 'Error en el servidor';
    }
    if (err?.error?.message) return err.error.message;
    if (err?.message) return err.message;
  } catch {}
  return 'No se pudo completar el registro. Verifica los datos e inténtalo nuevamente.';
}



}
