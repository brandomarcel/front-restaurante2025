import { TestBed } from '@angular/core/testing';
import { CompanyCapabilitiesService } from './company-capabilities.service';
import { UtilsService } from './utils.service';

describe('Bodegas: quién las ve según el tipo de negocio', () => {
  let service: CompanyCapabilitiesService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [{ provide: UtilsService, useValue: jasmine.createSpyObj('UtilsService', ['cambiarAmbiente']) }] });
    service = TestBed.inject(CompanyCapabilitiesService);
  });

  afterEach(() => localStorage.clear());

  function load(posExperience: string, restaurant: boolean, inventoryMode: 'Simple' | 'Por Bodega') {
    service.setFromResponse({
      business: { name: 'B', pos_experience: posExperience, inventory_mode: inventoryMode },
      features: { pos: true, generic_pos: true, restaurant, inventory: true },
      business_role: 'Administrador',
      permissions: ['*'],
    });
  }

  it('restaurante en modo Simple: no muestra nada de bodegas', () => {
    load('Restaurante', true, 'Simple');
    expect(service.isRestaurantBusiness).toBeTrue();
    expect(service.warehouseUiVisible).toBeFalse();
  });

  it('restaurante que activó Por Bodega: vuelve a mostrarlas', () => {
    load('Restaurante', true, 'Por Bodega');
    expect(service.warehouseUiVisible).toBeTrue();
  });

  it('comercio sin restaurante: siempre las ve, aunque use Simple', () => {
    load('General', false, 'Simple');
    expect(service.isRestaurantBusiness).toBeFalse();
    expect(service.warehouseUiVisible).toBeTrue();
  });

  it('comercio retail con restaurante activo: manda el comercio y ve las bodegas', () => {
    load('Retail', true, 'Simple');
    expect(service.isRestaurantBusiness).toBeFalse();
    expect(service.warehouseUiVisible).toBeTrue();
  });
});
