import { Component, Input } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { of, throwError } from 'rxjs';
import { AuthService } from 'src/app/services/auth.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { MenuService } from 'src/app/modules/layout/services/menu.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { PwaService } from 'src/app/core/services/pwa.service';
import { SignInComponent } from './sign-in.component';

@Component({ selector: 'svg-icon', standalone: true, template: '' })
class TestIcon {
  @Input() src = '';
  @Input() svgClass = '';
}

describe('SignInComponent: acceso y selección de negocio', () => {
  let fixture: ComponentFixture<SignInComponent>, component: SignInComponent;
  let auth: jasmine.SpyObj<AuthService>, errors: jasmine.SpyObj<FrappeErrorService>;
  let navigate: jasmine.Spy, menu: jasmine.SpyObj<MenuService>;
  const businesses = [
    { name: 'B-ONE', business_name: 'Tienda de prueba' },
    { name: 'B-TWO', business_name: 'Café de prueba' },
  ];
  let stored: (string | null)[];
  beforeEach(async () => {
    stored = ['active_business', 'businessId'].map((key) => localStorage.getItem(key));
    auth = jasmine.createSpyObj('Auth', ['login', 'getCurrentUser', 'getPendingLiteBusinesses', 'selectLiteBusiness']);
    auth.login.and.returnValue(of({} as any));
    auth.selectLiteBusiness.and.returnValue(of({} as any));
    auth.getCurrentUser.and.returnValue({ roles: ['ADMINISTRADOR'] } as any);
    auth.getPendingLiteBusinesses.and.returnValue(businesses as any);
    errors = jasmine.createSpyObj('Errors', ['handle']);
    errors.handle.and.returnValue('Mensaje del servidor');
    menu = jasmine.createSpyObj('Menu', ['setMenuForRoles']);
    await TestBed.configureTestingModule({
      imports: [SignInComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: FrappeErrorService, useValue: errors },
        { provide: MenuService, useValue: menu },
        { provide: PwaService, useValue: { canShowInstall: () => false } },
        { provide: CompanyCapabilitiesService, useValue: { getLandingRoute: () => '/dashboard/main' } },
      ],
    })
      .overrideComponent(SignInComponent, { remove: { imports: [AngularSvgIconModule] }, add: { imports: [TestIcon] } })
      .compileComponents();
    navigate = spyOn(TestBed.inject(Router), 'navigateByUrl').and.resolveTo(true);
    fixture = TestBed.createComponent(SignInComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() =>
    ['active_business', 'businessId'].forEach((key, i) =>
      stored[i] === null ? localStorage.removeItem(key) : localStorage.setItem(key, stored[i]!),
    ),
  );
  function valid() {
    component.form.setValue({ email: ' usuario@example.com ', password: 'solo-pruebas' });
  }

  it('muestra errores accesibles de campos vacíos sin llamar al servidor', () => {
    component.onSubmit();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Escribe tu usuario o correo.');
    expect(element.textContent).toContain('Escribe tu contraseña.');
    expect(element.querySelector('#email')?.getAttribute('aria-invalid')).toBe('true');
    expect(auth.login).not.toHaveBeenCalled();
  });
  for (const [status, message] of [
    [401, 'El usuario o la contraseña no son correctos.'],
    [0, 'No hay conexión'],
    [429, 'Hubo demasiados intentos'],
  ] as const) {
    it(`explica el error HTTP ${status} junto al formulario`, () => {
      valid();
      auth.login.and.returnValue(throwError(() => new HttpErrorResponse({ status, url: '/api/method/login' })));
      component.onSubmit();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(message);
      expect(component.isSubmitting).toBeFalse();
      expect(errors.handle).not.toHaveBeenCalled();
    });
  }
  it('mantiene el error del backend para fallos fuera del login', () => {
    valid();
    auth.login.and.returnValue(throwError(() => ({ status: 403, url: '/api/method/context' })));
    component.onSubmit();
    expect(component.formError).toBe('Mensaje del servidor');
    expect(errors.handle).toHaveBeenCalled();
  });
  it('limpia el error anterior cuando se editan credenciales', () => {
    component.formError = 'Error anterior';
    component.form.controls['email'].setValue('otro');
    expect(component.formError).toBe('');
  });
  it('permite mostrar contraseña e informa de Bloq Mayús', () => {
    const event = new KeyboardEvent('keydown', { key: 'A' });
    spyOn(event, 'getModifierState').and.callFake((key) => key === 'CapsLock');
    component.checkCapsLock(event);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Bloq Mayús');
    fixture.nativeElement.querySelector('[aria-label="Mostrar contraseña"]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#password').type).toBe('text');
  });
  it('muestra ayuda de recuperación sin abandonar el formulario', () => {
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(
      (item) => item.textContent?.includes('¿Olvidaste'),
    )!;
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('#forgot-help').textContent).toContain('administrador');
    expect(navigate).not.toHaveBeenCalled();
    expect(auth.login).not.toHaveBeenCalled();
  });
  it('presenta los negocios y selecciona explícitamente el elegido', fakeAsync(() => {
    valid();
    auth.login.and.returnValue(throwError(() => new Error('__LITE_BUSINESS_SELECTION_REQUIRED__')));
    component.onSubmit();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Elige el negocio');
    component.chooseBusiness(businesses[1]);
    flushMicrotasks();
    expect(auth.selectLiteBusiness).toHaveBeenCalledOnceWith('B-TWO');
    expect(navigate).toHaveBeenCalledWith('/dashboard/main');
  }));
  it('al recibir 403 de un negocio limpia la selección y permite elegir otro', () => {
    component.businessOptions = businesses;
    component.needsBusinessSelection = true;
    localStorage.setItem('active_business', 'B-ONE');
    localStorage.setItem('businessId', 'B-ONE');
    auth.selectLiteBusiness.and.returnValue(throwError(() => ({ status: 403 })));
    component.chooseBusiness(businesses[0]);
    expect(localStorage.getItem('active_business')).toBeNull();
    expect(localStorage.getItem('businessId')).toBeNull();
    expect(component.needsBusinessSelection).toBeTrue();
    expect(component.formError).toContain('Elige otro');
  });
  it('informa cuando no existe ningún negocio asignado', () => {
    valid();
    auth.getPendingLiteBusinesses.and.returnValue([]);
    auth.login.and.returnValue(throwError(() => new Error('__LITE_BUSINESS_SELECTION_REQUIRED__')));
    component.onSubmit();
    expect(component.needsBusinessSelection).toBeFalse();
    expect(component.formError).toContain('no tiene un negocio asignado');
  });
  it('normaliza usuario y configura el menú al entrar', fakeAsync(() => {
    valid();
    component.onSubmit();
    flushMicrotasks();
    expect(auth.login).toHaveBeenCalledWith('usuario@example.com', 'solo-pruebas');
    expect(menu.setMenuForRoles).toHaveBeenCalledWith(['ADMINISTRADOR']);
    expect(component.isSubmitting).toBeFalse();
  }));
  it('muestra error cuando el guard cancela la navegación', fakeAsync(() => {
    spyOn(console, 'error');
    navigate.and.resolveTo(false);
    valid();
    component.onSubmit();
    flushMicrotasks();
    expect(component.formError).toContain('No se pudo abrir');
    expect(component.isSubmitting).toBeFalse();
  }));
});
