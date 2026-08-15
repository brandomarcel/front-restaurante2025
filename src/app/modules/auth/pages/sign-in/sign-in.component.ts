import { NgClass, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { AuthService } from 'src/app/services/auth.service';
import { NgxSpinnerComponent, NgxSpinnerService } from 'ngx-spinner';
import { AlertService } from 'src/app/core/services/alert.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { MenuService } from 'src/app/modules/layout/services/menu.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';


@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css'],
  imports: [FormsModule, ReactiveFormsModule, AngularSvgIconModule, NgIf, ButtonComponent, NgClass, NgxSpinnerComponent, RouterLink],
})
export class SignInComponent implements OnInit {
  form!: FormGroup;
  submitted = false;
  passwordTextType = false;
  isSubmitting = false;

  constructor(
    private readonly _formBuilder: FormBuilder,
    private authService: AuthService,
    private readonly _router: Router,
    private spinner: NgxSpinnerService,
    private frappeErrorService: FrappeErrorService,
    private alertService: AlertService,
    private menu: MenuService,
    private capabilities: CompanyCapabilitiesService,
  ) { }

  ngOnInit(): void {
    this.form = this._formBuilder.group({
      email: ['', [Validators.required]],
      password: ['', Validators.required],
    });
  }

  get f() {
    return this.form.controls;
  }

  togglePasswordTextType() {
    this.passwordTextType = !this.passwordTextType;
  }

  onSubmit() {
    this.submitted = true;

    if (this.form.invalid) return;
    const username = String(this.form.value.email || '').trim();
    const password = String(this.form.value.password || '');
    if (!username || !password) return;

    this.isSubmitting = true;
    this.spinner.show();
    this.authService.login(username, password).subscribe({
      next: () => {
        const role: any = this.authService.getCurrentUser();
        this.menu.setMenuForRoles(Array.isArray(role?.roles) ? role.roles : []);
        this.spinner.hide();
        this.isSubmitting = false;
        this._router.navigateByUrl(this.capabilities.getLandingRoute(role?.roles));
      },
      error: (error: any) => {
        const mensaje: any = this.frappeErrorService.handle(error);
        this.alertService.error(mensaje);
        this.spinner.hide();
        this.isSubmitting = false;
      }
    });
  }
}
