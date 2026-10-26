import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom, isObservable, of, throwError } from 'rxjs';
import { toast } from 'ngx-sonner';
import { CompanyService } from 'src/app/services/company.service';
import { CompanyCapabilitiesService } from '../services/company-capabilities.service';
import { RoleAccessGuard } from './role-access.guard';

describe('RoleAccessGuard: feature, permiso y rol', () => {
  let guard: RoleAccessGuard;
  let capabilities: any;
  let company: jasmine.SpyObj<CompanyService>;
  const state = { url: '/dashboard/invoices' } as RouterStateSnapshot;

  beforeEach(() => {
    localStorage.removeItem('user');
    capabilities = {
      isLoaded: true, businessRole: 'Cajero', isLiteMode: true, isApiOnlyMode: false,
      isEnabled: jasmine.createSpy('isEnabled').and.returnValue(true),
      hasPermission: jasmine.createSpy('hasPermission').and.returnValue(true),
      validateFeatureUse: jasmine.createSpy('validateFeatureUse').and.returnValue({ allowed: true }),
      getLandingRoute: jasmine.createSpy('getLandingRoute').and.returnValue('/dashboard/home'),
      setFromResponse: jasmine.createSpy('setFromResponse')
    };
    company = jasmine.createSpyObj('CompanyService', ['get_empresa']);
    TestBed.configureTestingModule({ providers: [provideRouter([]),
      { provide: CompanyCapabilitiesService, useValue: capabilities },
      { provide: CompanyService, useValue: company }
    ] });
    guard = TestBed.inject(RoleAccessGuard);
    spyOn(toast, 'error');
    spyOn(toast, 'info');
  });

  afterEach(() => localStorage.removeItem('user'));

  async function evaluate(data: Record<string, any>): Promise<boolean | UrlTree> {
    const result = guard.canActivate({ data } as ActivatedRouteSnapshot, state);
    return isObservable(result) ? firstValueFrom(result) : result;
  }

  async function expectBlocked(data: Record<string, any>, reason: string): Promise<void> {
    const result = await evaluate(data);
    expect(result instanceof UrlTree).toBeTrue();
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toContain(`blocked=${reason}`);
  }

  it('permite el acceso solo cuando coinciden los tres ejes', async () => {
    expect(await evaluate({ featureKey: 'direct_invoice', permissionKey: 'billing.read', allowedRoles: ['CAJERO'] })).toBeTrue();
  });

  it('el rol administrador no evita la ausencia de feature', async () => {
    capabilities.businessRole = 'Administrador';
    capabilities.validateFeatureUse.and.returnValue({ allowed: false });
    await expectBlocked({ featureKey: 'direct_invoice' }, 'feature');
  });

  it('el rol administrador no evita la ausencia de permiso', async () => {
    capabilities.businessRole = 'Administrador';
    capabilities.hasPermission.and.returnValue(false);
    await expectBlocked({ permissionKey: 'billing.create' }, 'permission');
  });

  it('bloquea un rol no autorizado aunque tenga feature y permiso', async () => {
    await expectBlocked({ allowedRoles: ['GERENTE'], permissionKey: 'billing.read' }, 'rol');
  });

  it('respeta roles denegados explícitamente', async () => {
    await expectBlocked({ deniedRoles: ['CAJERO'] }, 'rol');
  });

  it('permite consultar históricos aunque no se pueda emitir', async () => {
    capabilities.validateFeatureUse.and.returnValue({ allowed: false });
    expect(await evaluate({ readOnlyFeature: true, featureKey: 'billing', permissionKey: 'billing.read' })).toBeTrue();
    expect(capabilities.validateFeatureUse).not.toHaveBeenCalled();
  });

  it('exige todas las features requeridas', async () => {
    capabilities.isEnabled.and.callFake((key: string) => key === 'pos');
    await expectBlocked({ requiredFeatures: ['pos', 'restaurant'] }, 'feature');
  });

  it('admite una de las features alternativas, pero conserva el permiso', async () => {
    capabilities.isEnabled.and.callFake((key: string) => key === 'billing');
    expect(await evaluate({ featureKeys: ['restaurant', 'billing'], permissionKey: 'billing.read' })).toBeTrue();
    capabilities.hasPermission.and.returnValue(false);
    await expectBlocked({ featureKeys: ['restaurant', 'billing'], permissionKey: 'billing.read' }, 'permission');
  });

  it('exige al menos uno de los permisos alternativos', async () => {
    capabilities.hasPermission.and.returnValue(false);
    await expectBlocked({ anyPermissionKeys: ['billing.read', 'pos.read'] }, 'permission');
    capabilities.hasPermission.and.callFake((key: string) => key === 'pos.read');
    expect(await evaluate({ anyPermissionKeys: ['billing.read', 'pos.read'] })).toBeTrue();
  });

  it('bloquea pantallas operativas de un negocio API-only', async () => {
    capabilities.isApiOnlyMode = true;
    await expectBlocked({ apiOnlyBlocked: true }, 'api-only');
  });

  it('carga contexto antes de evaluar y rechaza fallos de contexto', async () => {
    capabilities.isLoaded = false;
    company.get_empresa.and.returnValue(of({ message: { business: { name: 'TEST-BUSINESS' } } }));
    expect(await evaluate({ allowedRoles: ['CAJERO'] })).toBeTrue();
    expect(capabilities.setFromResponse).toHaveBeenCalled();
    company.get_empresa.and.returnValue(throwError(() => new Error('context failed')));
    await expectBlocked({}, 'context');
  });

  it('tolera almacenamiento de usuario dañado sin conceder un rol adicional', async () => {
    localStorage.setItem('user', '{invalid');
    await expectBlocked({ allowedRoles: ['GERENTE'] }, 'rol');
  });
});
