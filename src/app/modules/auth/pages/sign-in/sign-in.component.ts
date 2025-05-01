import { NgClass, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { AuthService } from 'src/app/services/auth.service';
import { toast } from 'ngx-sonner';


@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css'],
  imports: [FormsModule, ReactiveFormsModule, AngularSvgIconModule, NgIf, ButtonComponent, NgClass],
})
export class SignInComponent implements OnInit {
  form!: FormGroup;
  submitted = false;
  passwordTextType!: boolean;

  constructor(private readonly _formBuilder: FormBuilder, private authService: AuthService, private readonly _router: Router) {}
  ngOnInit(): void {

    this.form = this._formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }
 

  get f() {
    return this.form.controls;
  }

  togglePasswordTextType() {
    this.passwordTextType = !this.passwordTextType;
  }

  // onSubmit() {
  //   this.submitted = true;
  //   const { email, password } = this.form.value;

  //   if (this.form.invalid) {
  //     return;
  //   }

  //   this._router.navigate(['/dashboard']);
  // }

  onSubmit() {
    this.submitted = true;

    if (this.form.invalid) return;

    this.authService.login(this.form.value).subscribe({
      next: (res) => {
        console.log(res);

        // Guarda el token y el usuario
        localStorage.setItem('access_token', res.access_token);
        localStorage.setItem('user', JSON.stringify(res.user));

        // Redirige al dashboard u otra página
        this._router.navigate(['/dashboard']);
      },
      error: (err) => {
        toast.error('Credenciales incorrectas');
        console.error('Error de login:', err.message);
        // Aquí podrías mostrar una alerta o toast
      }
    });
  }
}
