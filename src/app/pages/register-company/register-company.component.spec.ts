import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { importProvidersFrom } from '@angular/core';

import { RegisterCompanyComponent } from './register-company.component';
import { RegisterCompanyService } from 'src/app/services/register-company.service';
import { AuthService } from 'src/app/services/auth.service';
import { CompanyService } from 'src/app/services/company.service';

describe('RegisterCompanyComponent', () => {
  let component: RegisterCompanyComponent;
  let fixture: ComponentFixture<RegisterCompanyComponent>;
  let registerSvc: jasmine.SpyObj<RegisterCompanyService>;

  const validAccount = {
    full_name: 'maría pérez',
    email: 'maria@correo.com',
    password: 'Clave2026!',
    confirm_password: 'Clave2026!',
    accept_terms: true,
  };

  beforeEach(async () => {
    registerSvc = jasmine.createSpyObj('RegisterCompanyService', ['registerBusinessOpen']);
    registerSvc.registerBusinessOpen.and.returnValue(of({ message: { data: { business: { name: 'BIZ-1' } } } }));

    await TestBed.configureTestingModule({
      imports: [RegisterCompanyComponent],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        importProvidersFrom(AngularSvgIconModule.forRoot()),
        { provide: RegisterCompanyService, useValue: registerSvc },
        { provide: AuthService, useValue: { login: () => of({}) } },
        { provide: CompanyService, useValue: { getLiteSetup: () => of({}) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterCompanyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('enviar el formulario en el paso 1 valida y avanza, sin registrar', () => {
    component.form.patchValue(validAccount);
    component.submit();
    expect(component.step).toBe(2);
    expect(registerSvc.registerBusinessOpen).not.toHaveBeenCalled();
  });

  it('no avanza del paso 1 con datos inválidos', () => {
    component.submit();
    expect(component.step).toBe(1);
    expect(component.showError('full_name')).toBeTrue();
  });

  it('exige que el RUC tenga 13 dígitos y termine en 001', () => {
    const ruc = component.form.controls['ruc'];
    ruc.setValue('179001234500');
    expect(component.rucError).toContain('13 dígitos');
    ruc.setValue('1790012345002');
    expect(component.rucError).toBe('El RUC debe terminar en 001');
    ruc.setValue('1790012345001');
    expect(ruc.valid).toBeTrue();
  });

  it('solo permite volver a pasos ya completados desde el stepper', () => {
    component.step = 2;
    component.goToStep(3);
    expect(component.step).toBe(2);
    component.goToStep(1);
    expect(component.step).toBe(1);
  });

  it('envía nombre y razón social en mayúsculas', () => {
    component.form.patchValue({ ...validAccount, businessname: 'comercial peña s.a.', ruc: '1790012345001' });
    component.step = 3;
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    component.submit();

    const payload = registerSvc.registerBusinessOpen.calls.mostRecent().args[0] as any;
    expect(payload.user.first_name).toBe('MARÍA');
    expect(payload.user.last_name).toBe('PÉREZ');
    expect(payload.business.business_name).toBe('COMERCIAL PEÑA S.A.');
    expect(payload.business.legal_name).toBe('COMERCIAL PEÑA S.A.');
  });
});
