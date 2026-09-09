import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgxSpinnerModule, NgxSpinnerService } from 'ngx-spinner';
import { RegisterCompanyService } from 'src/app/services/register-company.service';
import { toast } from 'ngx-sonner';
import { OnlyNumbersDirective } from 'src/app/core/directives/only-numbers.directive';
import { of, switchMap } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { CompanyService } from 'src/app/services/company.service';
@Component({
  selector: 'app-register-company',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgxSpinnerModule, RouterLink, OnlyNumbersDirective],
  templateUrl: './register-company.component.html',
  styleUrls: ['./register-company.component.css']
})
export class RegisterCompanyComponent {
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
        ruc: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
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

  // Navegación entre pasos con validación del paso actual
  nextStep() {
    this.submitted = true;
    if (!this.isCurrentStepValid()) return;
    this.submitted = false;
    this.step = Math.min(3, this.step + 1);
  }

  prevStep() {
    this.submitted = false;
    this.step = Math.max(1, this.step - 1);
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
  this.submitted = true;
  if (!this.isCurrentStepValid()) return;

  const fullName = String(this.form.value.full_name || '').trim();
  const [first_name, ...restParts] = fullName.split(/\s+/);
  const last_name = restParts.join(' ');
  const email = String(this.form.value.email || '').trim();
  const password = String(this.form.value.password || '');
  const businessPayload = {
    business_name: String(this.form.value.businessname || '').trim(),
    ruc: String(this.form.value.ruc || '').trim(),
    legal_name: String(this.form.value.businessname || '').trim(),
    trade_name: String(this.form.value.businessname || '').trim(),
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
