import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { ButtonComponent } from 'src/app/shared/components/button/button.component';
import { RegisterCompanyService } from 'src/app/services/register-company.service';
import { toast } from 'ngx-sonner';
import { OnlyNumbersDirective } from 'src/app/core/directives/only-numbers.directive';
import { UppercaseDirective, toUpperText } from 'src/app/core/directives/uppercase.directive';
import { of, switchMap } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { CompanyService } from 'src/app/services/company.service';
@Component({
  selector: 'app-register-company',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgxSpinnerModule, RouterLink, OnlyNumbersDirective, UppercaseDirective, AngularSvgIconModule, ButtonComponent],
  templateUrl: './register-company.component.html',
  styleUrls: ['./register-company.component.css']
})
export class RegisterCompanyComponent {
  @ViewChild('scrollArea') scrollArea?: ElementRef<HTMLElement>;

  readonly privacyPolicyUrl = 'https://bmarc-corp.com/politica-privacidad/';
  readonly steps = [
    { id: 1, label: 'Cuenta', hint: 'Tus datos de acceso' },
    { id: 2, label: 'Empresa', hint: 'Datos del negocio' },
    { id: 3, label: 'Revisión', hint: 'Confirma y crea' },
  ];

  form: FormGroup;
  step = 1;
  submitted = false;
  showPass = false;
  isSubmitting = false;

  constructor(private fb: FormBuilder,
    private registerSvc: RegisterCompanyService,
  private spinner: NgxSpinnerService,
  private router: Router,
  private authService: AuthService,
  private companyService: CompanyService,
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
        // RUC SRI: 13 dígitos y siempre termina en 001
        ruc: ['', [Validators.required, Validators.pattern(/^\d{13}$/), Validators.pattern(/^\d{10}001$/)]],
        address: [''],
        company_phone: [''],
        company_email: ['', Validators.email],
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

  /** Muestra el error de un campo al salir de él o al intentar avanzar */
  showError(name: string): boolean {
    const control = this.f[name];
    return !!control && control.invalid && (control.touched || this.submitted);
  }

  get rucError(): string {
    const errors = this.f['ruc'].errors;
    if (!errors) return '';
    if (errors['required']) return 'Ingresa el RUC de la empresa';
    const value = String(this.f['ruc'].value || '');
    if (value.length !== 13) return `El RUC tiene 13 dígitos (llevas ${value.length})`;
    return 'El RUC debe terminar en 001';
  }

  get showPasswordMismatch(): boolean {
    return !!this.form.errors?.['passwordMismatch'] && (this.f['confirm_password'].touched || this.submitted);
  }

  get passwordsMatch(): boolean {
    const { password, confirm_password } = this.form.value;
    return !!password && password === confirm_password;
  }

  /** 0–4: longitud, longitud extra, mayúsculas+minúsculas, números y símbolos */
  get passwordStrength(): number {
    const value = String(this.f['password'].value || '');
    if (!value) return 0;
    let score = 0;
    if (value.length >= 8) score++;
    if (value.length >= 12) score++;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
    if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
    return Math.max(1, score);
  }

  get passwordStrengthLabel(): string {
    return ['', 'Débil', 'Aceptable', 'Buena', 'Fuerte'][this.passwordStrength];
  }

  // Navegación entre pasos con validación del paso actual
  nextStep() {
    this.submitted = true;
    if (!this.isCurrentStepValid()) return;
    this.submitted = false;
    this.setStep(Math.min(3, this.step + 1));
  }

  prevStep() {
    this.submitted = false;
    this.setStep(Math.max(1, this.step - 1));
  }

  /** Desde el stepper o la revisión solo se puede volver a pasos ya completados */
  goToStep(target: number) {
    if (this.isSubmitting || target >= this.step) return;
    this.submitted = false;
    this.setStep(target);
  }

  private setStep(target: number) {
    this.step = target;
    this.scrollArea?.nativeElement.scrollTo({ top: 0, behavior: 'smooth' });
  }

  isCurrentStepValid(): boolean {
    const controlsByStep: Record<number, string[]> = {
      1: ['full_name', 'email', 'password', 'confirm_password', 'accept_terms'],
      2: ['businessname', 'ruc'],
      3: [] // revisión
    };
    const keys = controlsByStep[this.step] || [];
    keys.forEach(k => this.f[k].markAsTouched());
    return keys.every(k => this.f[k].valid) && !this.form.errors;
  }

submit() {
  if (this.isSubmitting) return;
  // Enter en los pasos 1 y 2 avanza en lugar de registrar con datos incompletos
  if (this.step < 3) {
    this.nextStep();
    return;
  }
  this.submitted = true;
  if (!this.isCurrentStepValid()) return;

  const fullName = toUpperText(this.form.value.full_name).trim();
  const legalName = toUpperText(this.form.value.businessname).trim();
  const [first_name, ...restParts] = fullName.split(/\s+/);
  const last_name = restParts.join(' ');
  const email = String(this.form.value.email || '').trim();
  const password = String(this.form.value.password || '');
  const businessPayload = {
    business_name: legalName,
    ruc: String(this.form.value.ruc || '').trim(),
    legal_name: legalName,
    trade_name: legalName,
    address: String(this.form.value.address || '').trim(),
    phone: String(this.form.value.company_phone || '').trim()
  };
  const userPayload = {
    email,
    password,
    first_name,
    last_name,
    phone: String(this.form.value.phone || '').trim()
  };

  this.isSubmitting = true;
  this.spinner.show();
  this.registerSvc.registerBusinessOpen({ user: userPayload, business: businessPayload }).pipe(
    switchMap((response: any) => {
      const data = response?.message?.data ?? response?.data ?? {};
      const businessName = String(data?.business?.name || '').trim();
      if (!businessName) {
        throw new Error('El registro no devolvió el negocio creado.');
      }
      localStorage.setItem('active_business', businessName);
      localStorage.setItem('businessId', businessName);
      return this.authService.login(email, password).pipe(
        switchMap(() => this.companyService.getLiteSetup(businessName)),
        switchMap((setup: any) => of({ data, setup, businessName }))
      );
    })
  ).subscribe({
    next: ({ data, businessName }: any) => {
      this.isSubmitting = false;
      this.spinner.hide();
      toast.success(`¡Listo! La empresa ${data?.business?.business_name || businessPayload.business_name} fue creada.`);
      this.form.reset();
      this.submitted = false;
      this.step = 1;
      this.router.navigate(['/settings/lite/readiness'], {
        queryParams: businessName ? { business: businessName } : undefined
      });
    },
    error: (err) => {
      this.isSubmitting = false;
      this.spinner.hide();
      toast.error(this.parseFrappeError(err));
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
