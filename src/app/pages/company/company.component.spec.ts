import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { NgxSpinnerService } from 'ngx-spinner';
import { CompanyComponent } from './company.component';
import { CompanyService } from 'src/app/services/company.service';
import { AlertService } from 'src/app/core/services/alert.service';
import { UtilsService } from 'src/app/core/services/utils.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { MenuService } from 'src/app/modules/layout/services/menu.service';

describe('CompanyComponent', () => {
  let fixture: ComponentFixture<CompanyComponent>;
  beforeEach(async () => {
    const capabilities = {
      activeBusinessId: 'BUSINESS-TEST',
      activeBusiness: { name: 'BUSINESS-TEST', business_name: 'Empresa de pruebas' },
      isLiteMode: true,
      canManageBusinessSetup: true,
      liteSetupMissing: [],
      sequences: [],
      activeEstablishments: [],
      plan: null,
      businesses: [],
      isEnabled: () => false,
      activeEmissionPointsFor: () => [],
      setApiConfiguration: () => {},
      setLiteSetupState: () => {},
    };
    await TestBed.configureTestingModule({
      imports: [CompanyComponent],
      providers: [
        provideRouter([]),
        { provide: CompanyCapabilitiesService, useValue: capabilities },
        {
          provide: CompanyService,
          useValue: {
            getLiteSetup: () => of({}),
            getLiteContext: () => of({}),
            normalizeLiteSetup: () => null,
            saveLiteSetup: jasmine.createSpy('saveLiteSetup'),
            update: jasmine.createSpy('update'),
          },
        },
        { provide: AlertService, useValue: jasmine.createSpyObj('AlertService', ['error']) },
        { provide: UtilsService, useValue: {} },
        { provide: MenuService, useValue: {} },
        { provide: NgxSpinnerService, useValue: jasmine.createSpyObj('Spinner', ['show', 'hide']) },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CompanyComponent);
    fixture.detectChanges();
  });

  it('mantiene configuración tributaria sin ofrecer importación administrativa en Angular', () => {
    expect(fixture.componentInstance).toBeTruthy();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('Datos tributarios');
    expect(element.querySelector('a[href*="company-migration"]')).toBeNull();
    expect(element.textContent).not.toContain('Importar datos e historial');
  });
  it('empresa demo no selecciona ni guarda Producción en modo Lite', () => {
    const component = fixture.componentInstance;
    component.isDemo = true;
    component.companyId = 'BUSINESS-TEST';
    component.onLiteEnvironmentSelected('PRODUCCION');
    expect(component.previewEnvironment).toBe('PRUEBAS');
    component.form.patchValue({ sequence_environment: 'PRODUCCION' });
    component.saveLiteEnvironment();
    expect(TestBed.inject(CompanyService).saveLiteSetup).not.toHaveBeenCalled();
    expect(TestBed.inject(AlertService).error).toHaveBeenCalled();
  });

  it('empresa demo revierte el check clásico sin petición de actualización', () => {
    const component = fixture.componentInstance;
    const capabilities = TestBed.inject(CompanyCapabilitiesService) as any;
    capabilities.isLiteMode = false;
    component.isDemo = true;
    component.companyId = 'BUSINESS-TEST';
    component.form.patchValue({ ambiente: true });
    component.cambiarAmbiente();
    expect(component.form.value.ambiente).toBeFalse();
    expect(TestBed.inject(CompanyService).update).not.toHaveBeenCalled();
  });
});
