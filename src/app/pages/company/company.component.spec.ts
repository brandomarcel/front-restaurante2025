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
      activeBusinessId: 'BUSINESS-TEST', activeBusiness: { name: 'BUSINESS-TEST', business_name: 'Empresa de pruebas' },
      isLiteMode: true, canManageBusinessSetup: true, liteSetupMissing: [], sequences: [], activeEstablishments: [],
      plan: null, businesses: [], isEnabled: () => false, activeEmissionPointsFor: () => [],
      setApiConfiguration: () => {}, setLiteSetupState: () => {},
    };
    await TestBed.configureTestingModule({
      imports: [CompanyComponent], providers: [provideRouter([]),
        { provide: CompanyCapabilitiesService, useValue: capabilities },
        { provide: CompanyService, useValue: { getLiteSetup: () => of({}), getLiteContext: () => of({}), normalizeLiteSetup: () => null } },
        { provide: AlertService, useValue: jasmine.createSpyObj('AlertService', ['error']) },
        { provide: UtilsService, useValue: {} }, { provide: MenuService, useValue: {} },
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
});
