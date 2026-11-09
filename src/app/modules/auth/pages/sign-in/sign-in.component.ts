import { NgFor, NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { AuthService } from 'src/app/services/auth.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { MenuService } from 'src/app/modules/layout/services/menu.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { PwaService } from 'src/app/core/services/pwa.service';

const LANDING_FAILED = 'No se pudo abrir la sección inicial de tu cuenta. Si se repite, avisa al administrador.';

/**
 * Inicio de sesión. Los errores se muestran junto al formulario (no en avisos flotantes) y hay un solo indicador de
 * carga, en el botón. Si el usuario trabaja en varios negocios, un segundo paso le pide elegir uno.
 */
@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.css'],
  imports: [ReactiveFormsModule, AngularSvgIconModule, NgIf, NgFor, RouterLink],
})
export class SignInComponent implements OnInit, AfterViewInit {
  form!: FormGroup;
  submitted = false;
  passwordTextType = false;
  isSubmitting = false;
  needsBusinessSelection = false;
  businessOptions: any[] = [];
  selectedBusinessId = '';
  /** Error que viene del servidor o del flujo (no de validación de campos). */
  formError = '';
  capsLockOn = false;
  showForgotHelp = false;
  readonly pwa = inject(PwaService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('emailInput') private emailInput?: ElementRef<HTMLInputElement>;

  constructor(
    private readonly _formBuilder: FormBuilder,
    private authService: AuthService,
    private readonly _router: Router,
    private frappeErrorService: FrappeErrorService,
    private menu: MenuService,
    private capabilities: CompanyCapabilitiesService,
  ) { }

  ngOnInit(): void {
    this.form = this._formBuilder.group({
      email: ['', [Validators.required]],
      password: ['', Validators.required],
    });
    // Al corregir los datos, el error anterior ya no aplica.
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => (this.formError = ''));
  }

  ngAfterViewInit(): void {
    // Cursor listo en el usuario, salvo en pantallas táctiles: ahí abriría el teclado y taparía la pantalla.
    if (typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches) {
      setTimeout(() => this.emailInput?.nativeElement.focus());
    }
  }

  get f() {
    return this.form.controls;
  }

  togglePasswordTextType() {
    this.passwordTextType = !this.passwordTextType;
  }

  /** Bloq Mayús activado mientras escribe la contraseña. */
  checkCapsLock(event: KeyboardEvent): void {
    this.capsLockOn = typeof event.getModifierState === 'function' && event.getModifierState('CapsLock');
  }

  businessId(business: any): string {
    return String(business?.name || business?.business || '');
  }

  businessLabel(business: any): string {
    return business?.business_name || business?.businessname || business?.name || business?.business || '';
  }

  chooseBusiness(business: any): void {
    if (this.isSubmitting) return;
    this.selectedBusinessId = this.businessId(business);
    this.selectBusiness();
  }

  onSubmit() {
    if (this.needsBusinessSelection) {
      this.selectBusiness();
      return;
    }
    this.submitted = true;
    this.formError = '';

    if (this.form.invalid) return;
    const username = String(this.form.value.email || '').trim();
    const password = String(this.form.value.password || '');
    if (!username || !password) return;

    this.isSubmitting = true;
    this.authService.login(username, password).subscribe({
      next: () => {
        const role: any = this.authService.getCurrentUser();
        this.menu.setMenuForRoles(Array.isArray(role?.roles) ? role.roles : []);
        this.goToLanding(role?.roles);
      },
      error: (error: any) => {
        this.isSubmitting = false;
        if (error?.message === '__LITE_BUSINESS_SELECTION_REQUIRED__') {
          this.businessOptions = this.authService.getPendingLiteBusinesses();
          this.selectedBusinessId = '';
          this.needsBusinessSelection = this.businessOptions.length > 1;
          if (!this.needsBusinessSelection) {
            this.formError = 'Tu usuario no tiene un negocio asignado. Pide al administrador que te agregue.';
          }
          return;
        }
        this.formError = this.loginErrorMessage(error);
      },
    });
  }

  selectBusiness(): void {
    const selected = String(this.selectedBusinessId || '').trim();
    if (!selected || this.isSubmitting) return;
    this.isSubmitting = true;
    this.formError = '';
    this.authService.selectLiteBusiness(selected).subscribe({
      next: () => {
        const user: any = this.authService.getCurrentUser();
        this.menu.setMenuForRoles(Array.isArray(user?.roles) ? user.roles : []);
        // Se queda en este paso mientras navega, para no mostrar otra vez el formulario de acceso.
        this.goToLanding(user?.roles);
      },
      error: (error: any) => {
        this.isSubmitting = false;
        this.selectedBusinessId = '';
        if (error?.status === 403) {
          localStorage.removeItem('active_business');
          localStorage.removeItem('businessId');
          this.needsBusinessSelection = this.businessOptions.length > 1;
          this.formError = 'No tienes acceso a ese negocio. Elige otro.';
        } else {
          this.formError = this.frappeErrorService.handle(error);
        }
      },
    });
  }

  private goToLanding(roles: unknown): void {
    const landingRoute = this.capabilities.getLandingRoute(roles);
    // navigateByUrl no lanza excepción si la navegación se cancela (por ejemplo, un guard redirige a otro lado que a
    // su vez falla): sin este aviso el usuario quedaba en el login sin saber qué pasó.
    this._router.navigateByUrl(landingRoute).then(
      (success) => {
        this.isSubmitting = false;
        if (!success) {
          console.error('[FacturADA][Login] La navegación a la ruta de aterrizaje fue cancelada.', { landingRoute });
          this.formError = LANDING_FAILED;
        }
      },
      () => {
        this.isSubmitting = false;
        this.formError = LANDING_FAILED;
      },
    );
  }

  /** Mensaje claro para los fallos más comunes al entrar; el resto, el texto que manda el backend. */
  private loginErrorMessage(error: any): string {
    const status = error instanceof HttpErrorResponse ? error.status : Number(error?.status);
    const fromLogin = String(error?.url || '').includes('/method/login');
    if (status === 0) return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';
    if (status === 429) return 'Hubo demasiados intentos. Espera unos minutos e intenta de nuevo.';
    if (fromLogin && status === 401) return 'El usuario o la contraseña no son correctos.';
    return this.frappeErrorService.handle(error);
  }
}
