import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { toast } from 'ngx-sonner';
import { AlertService } from 'src/app/core/services/alert.service';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { CompanyService } from 'src/app/services/company.service';
import { UserService } from 'src/app/services/user.service';
import { UsersComponent } from './users.component';

/** Caracterización de Usuarios del negocio: reglas que el rediseño no debe cambiar. */
describe('Usuarios — reglas', () => {
  let fixture: ComponentFixture<UsersComponent>;
  let component: UsersComponent;
  let users: any;
  let capabilities: any;

  const roles = [
    { name: 'ADMINISTRADOR', label: 'Administrador' },
    { name: 'GERENTE', label: 'Gerente' },
    { name: 'CAJERO', label: 'Cajero', description: 'Vende y cobra en caja.' }
  ];
  const ana = { name: 'BU-1', business: 'NEG-1', user: 'ana@x.com', full_name: 'Ana', business_role: 'CAJERO', status: 'Activo', is_default: 1 };
  const luis = { name: 'BU-2', business: 'NEG-1', user: 'luis@x.com', full_name: 'Luis', business_role: 'CAJERO', status: 'Inactivo' };

  function setup(businessRole = 'ADMINISTRADOR'): void {
    capabilities = {
      activeBusinessId: 'NEG-1',
      activeBusiness: { business_name: 'Mi tienda' },
      businessRole,
      usersModuleVisible: true,
      hasPermission: () => false,
      canManageInModule: () => true,
      setFromResponse: jasmine.createSpy('setFromResponse')
    };
    users = {
      getBusinessUsers: jasmine.createSpy('getBusinessUsers').and.returnValue(of([ana, luis, { ...ana, name: 'BU-X', business: 'OTRO', user: 'x@x.com' }])),
      getAvailableBusinessRoles: jasmine.createSpy('roles').and.returnValue(of(roles)),
      searchFrappeUsers: jasmine.createSpy('search').and.returnValue(of([])),
      saveBusinessUser: jasmine.createSpy('save').and.returnValue(of({})),
      createFrappeUser: jasmine.createSpy('createUser').and.returnValue(of({})),
      deactivateBusinessUser: jasmine.createSpy('deactivate').and.returnValue(of({}))
    };
    TestBed.configureTestingModule({
      imports: [UsersComponent],
      providers: [
        { provide: UserService, useValue: users },
        { provide: CompanyService, useValue: { get_empresa: () => of({}) } },
        { provide: CompanyCapabilitiesService, useValue: capabilities },
        { provide: FrappeErrorService, useValue: { handle: () => 'Error del servidor' } },
        { provide: AlertService, useValue: { confirm: () => Promise.resolve({ isConfirmed: true }), error: () => undefined } }
      ]
    });
    fixture = TestBed.createComponent(UsersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    spyOn(toast, 'success');
    spyOn(toast, 'error');
    spyOn(window, 'confirm').and.returnValue(true);
  });

  it('solo muestra asignaciones del negocio activo', () => {
    setup();
    expect(component.users.map((u) => u.name)).toEqual(['BU-1', 'BU-2']);
  });

  it('un Gerente no puede asignar Administrador ni Gerente', () => {
    setup('GERENTE');
    expect(component.assignableRoles.map((r) => r.name)).toEqual(['CAJERO']);
  });

  it('crear un usuario nuevo exige nombres, apellidos y contraseña', () => {
    setup();
    component.openCreate();
    component.form.patchValue({ user: 'nuevo@x.com', business_role: 'CAJERO' });
    component.save();
    expect(users.createFrappeUser).not.toHaveBeenCalled();
    component.form.patchValue({ first_name: 'Nuevo', last_name: 'Usuario', new_password: 'Clave-123' });
    component.save();
    expect(users.createFrappeUser).toHaveBeenCalledWith(jasmine.objectContaining({
      business: 'NEG-1', email: 'nuevo@x.com', first_name: 'Nuevo', last_name: 'Usuario', business_role: 'CAJERO', send_welcome_email: 0
    }));
  });

  it('asignar un usuario existente usa saveBusinessUser sin crear otro', () => {
    setup();
    component.openCreate();
    component.selectFrappeUser({ user: 'pedro@x.com', full_name: 'Pedro', enabled: 1 });
    component.form.patchValue({ business_role: 'CAJERO' });
    component.save();
    expect(users.createFrappeUser).not.toHaveBeenCalled();
    expect(users.saveBusinessUser).toHaveBeenCalledWith(jasmine.objectContaining({ business: 'NEG-1', user: 'pedro@x.com', business_role: 'CAJERO', status: 'Activo' }));
  });

  it('no permite elegir candidatos deshabilitados o ya asignados', () => {
    setup();
    component.openCreate();
    component.selectFrappeUser({ user: 'off@x.com', enabled: 0 });
    expect(component.selectedFrappeUser).toBeNull();
    component.selectFrappeUser({ user: 'ya@x.com', enabled: 1, assignment: ana });
    expect(component.selectedFrappeUser).toBeNull();
  });

  it('bloquea asignar dos veces el mismo correo', () => {
    setup();
    component.openCreate();
    component.selectFrappeUser({ user: 'ANA@x.com', enabled: 1 });
    component.form.patchValue({ business_role: 'CAJERO' });
    component.save();
    expect(users.saveBusinessUser).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Este usuario ya está asignado al negocio seleccionado.');
  });

  it('editar actualiza la asignación existente', () => {
    setup();
    component.openEdit(ana as any);
    component.form.patchValue({ status: 'Inactivo' });
    component.save();
    expect(users.saveBusinessUser).toHaveBeenCalledWith(jasmine.objectContaining({ name: 'BU-1', user: 'ana@x.com', status: 'Inactivo', is_default: 1 }));
  });

  it('desactivar pide confirmación y no elimina al usuario Frappe', async () => {
    setup();
    component.deactivate(ana as any);
    await fixture.whenStable();
    expect(users.deactivateBusinessUser).toHaveBeenCalledWith('BU-1', 'NEG-1');
  });

  it('los conteos son del negocio completo y sirven de filtro rápido', () => {
    setup();
    component.search = 'ana';
    component.applyFilters();
    expect(component.activeCount).toBe(1);
    expect(component.inactiveCount).toBe(1);
    component.clearFilters();
    component.setStatusFilter('Inactivo');
    expect(component.filtered.map((u) => u.name)).toEqual(['BU-2']);
    component.setStatusFilter('Inactivo');
    expect(component.statusFilter).toBe('all');
  });

  it('el botón dice qué va a pasar: crear cuenta o solo dar acceso', () => {
    setup();
    component.openCreate();
    fixture.detectChanges();
    const submit = () => (fixture.nativeElement.querySelector('button[type="submit"]').textContent as string).trim();
    expect(submit()).toBe('Crear cuenta y dar acceso');
    component.selectFrappeUser({ user: 'pedro@x.com', full_name: 'Pedro', enabled: 1 });
    fixture.detectChanges();
    expect(submit()).toBe('Dar acceso');
    component.clearSelectedFrappeUser();
    expect(component.selectedFrappeUser).toBeNull();
    expect(component.form.get('user')?.value).toBe('');
  });

  it('muestra la descripción de cada rol que manda el backend', () => {
    setup();
    component.openCreate();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Vende y cobra en caja.');
  });
});
