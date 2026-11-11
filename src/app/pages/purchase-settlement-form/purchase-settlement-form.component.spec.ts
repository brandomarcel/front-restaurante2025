import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { Subject, of } from 'rxjs';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { LiteSupplier, LiteSuppliersService } from 'src/app/services/lite-suppliers.service';
import { PurchaseSettlementSetup, PurchaseSettlementsService } from 'src/app/services/purchase-settlements.service';
import { PurchaseSettlementFormComponent } from './purchase-settlement-form.component';

describe('PurchaseSettlementFormComponent', () => {
  let service: jasmine.SpyObj<PurchaseSettlementsService>;
  let capabilities: any;
  const supplier: LiteSupplier = {
    name: 'SUP-TEST',
    supplier_name: 'Persona ficticia',
    identification_type: '05',
    identification: '1803296829',
    related_party: false,
    is_active: true,
  };
  const setup: PurchaseSettlementSetup = {
    block_message: null,
    withholding_agent: true,
    tax_codes: [
      { code: '0', label: 'IVA 0 %', rate: 0 },
      { code: '4', label: 'IVA 15 %', rate: 15 },
    ],
    payment_methods: [
      { code: '01', label: 'Efectivo' },
      { code: '20', label: 'Transferencia' },
    ],
    identification_types: [
      { code: '05', label: 'Cédula' },
      { code: '06', label: 'Pasaporte' },
      { code: '08', label: 'Exterior' },
    ],
  };

  beforeEach(() => {
    service = jasmine.createSpyObj<PurchaseSettlementsService>('PurchaseSettlementsService', [
      'getSetup',
      'getDetail',
      'saveDraft',
      'createAndEmit',
      'emitDraft',
    ]);
    service.getSetup.and.returnValue(of(setup));
    service.saveDraft.and.returnValue(of({ name: 'LIQ-TEST' }));
    capabilities = {
      business: { environment: 'Pruebas' },
      activeEstablishments: [{ name: 'EST-TEST', is_main: true }],
      activeEmissionPointsFor: () => [{ name: 'POINT-TEST' }],
      hasActiveSequence: jasmine.createSpy().and.returnValue(true),
      hasPermission: jasmine.createSpy().and.returnValue(true),
      getEmissionBlockMessage: jasmine.createSpy().and.returnValue(''),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: PurchaseSettlementsService, useValue: service },
        { provide: LiteSuppliersService, useValue: { search: () => of({ data: [] }) } },
        { provide: CompanyCapabilitiesService, useValue: capabilities },
        { provide: FrappeErrorService, useValue: { handle: () => 'Error simulado' } },
        {
          provide: NgxSpinnerService,
          useValue: { show: jasmine.createSpy(), hide: jasmine.createSpy(), getSpinner: () => of({ show: false }) },
        },
      ],
    });
  });

  function create() {
    const fixture = TestBed.createComponent(PurchaseSettlementFormComponent);
    fixture.detectChanges();
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    return fixture;
  }
  function valid(component: PurchaseSettlementFormComponent) {
    component.supplier = supplier;
    component.items
      .at(0)
      .patchValue({ descripcion: 'Compra ficticia', cantidad: 2, precio_unitario: 10, tax_code: '0' });
  }

  it('selects sequence 03 and defaults to zero VAT and permitted supplier identifications', () => {
    const component = create().componentInstance;
    expect(component.form.value.establishment).toBe('EST-TEST');
    expect(component.form.value.emission_point).toBe('POINT-TEST');
    expect(component.items.at(0).value.tax_code).toBe('0');
    expect(component.allowedIdentificationTypes).toEqual(['05', '06', '08']);
    expect(capabilities.hasActiveSequence).toHaveBeenCalledWith(
      'Liquidacion de Compra',
      'EST-TEST',
      'POINT-TEST',
      'Pruebas',
    );
  });

  it('calculates per-line discounts and grouped VAT totals', () => {
    const component = create().componentInstance;
    valid(component);
    component.items.at(0).patchValue({ descuento: 3, tax_code: '4' });
    component.addItem();
    component.items.at(1).patchValue({ descripcion: 'Otro producto', cantidad: 1, precio_unitario: 5, tax_code: '0' });
    expect(component.subtotal).toBe(22);
    expect(component.totalDiscount).toBe(3);
    expect(component.totalIva).toBe(2.55);
    expect(component.total).toBe(24.55);
    expect(component.totalsByRate).toEqual([
      { label: 'IVA 15 %', base: 17, iva: 2.55 },
      { label: 'IVA 0 %', base: 5, iva: 0 },
    ]);
  });

  it('blocks RUC suppliers and invalid lines before any backend request', () => {
    const component = create().componentInstance;
    valid(component);
    component.supplier = { ...supplier, identification_type: '04', identification: '1790012345001' };
    component.items.at(0).patchValue({ cantidad: 0, descuento: 2 });
    component.emitir();
    expect(component.validationSummary.some((message) => message.includes('Quien tiene RUC'))).toBeTrue();
    expect(component.validationSummary.some((message) => message.includes('cantidad debe ser mayor'))).toBeTrue();
    expect(component.validationSummary.some((message) => message.includes('descuento no puede superar'))).toBeTrue();
    expect(service.createAndEmit).not.toHaveBeenCalled();
  });

  it('warns on cash above 1000 without making the otherwise valid form unissuable', () => {
    const fixture = create(),
      component = fixture.componentInstance;
    valid(component);
    component.items.at(0).patchValue({ cantidad: 1, precio_unitario: 1001 });
    component.submitted = true;
    expect(component.cashOverLimit).toBeTrue();
    expect(component.validationSummary).toEqual([]);
    expect(component.canEmit).toBeTrue();
    component.form.get('forma_pago')!.setValue('20');
    expect(component.cashOverLimit).toBeFalse();
  });

  it('saves trimmed line input and leaves computed values and issue date to the backend', () => {
    const component = create().componentInstance;
    valid(component);
    component.items
      .at(0)
      .patchValue({ descripcion: ' Compra ficticia ', unidad_medida: ' kg ', cantidad: 2.5, descuento: 1.23 });
    component.guardarBorrador();
    expect(service.saveDraft).toHaveBeenCalledOnceWith({
      supplier: 'SUP-TEST',
      establishment: 'EST-TEST',
      emission_point: 'POINT-TEST',
      environment: 'Pruebas',
      forma_pago: '01',
      items: [
        {
          descripcion: 'Compra ficticia',
          unidad_medida: 'kg',
          cantidad: 2.5,
          precio_unitario: 10,
          descuento: 1.23,
          tax_code: '0',
        },
      ],
    });
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/dashboard/purchase-settlements', 'LIQ-TEST']);
  });

  it('requires sequence and the common emission guard before creating a fiscal identity', () => {
    const component = create().componentInstance;
    valid(component);
    capabilities.hasActiveSequence.and.returnValue(false);
    component.emitir();
    expect(service.createAndEmit).not.toHaveBeenCalled();
    capabilities.hasActiveSequence.and.returnValue(true);
    capabilities.getEmissionBlockMessage.and.returnValue('Plan agotado');
    component.emitir();
    expect(service.createAndEmit).not.toHaveBeenCalled();
  });

  it('saves an edited draft before attempting its emission', () => {
    const component = create().componentInstance;
    valid(component);
    component.settlementName = 'LIQ-EDIT';
    const save = new Subject<any>();
    service.saveDraft.and.returnValue(save);
    service.emitDraft.and.returnValue(of({ state: 'PROCESSING', data: { name: 'LIQ-EDIT' } } as any));
    component.emitir();
    expect(service.emitDraft).not.toHaveBeenCalled();
    save.next({ name: 'LIQ-EDIT' });
    save.complete();
    expect(service.emitDraft).toHaveBeenCalledOnceWith('LIQ-EDIT');
    expect(component.submitting).toBeFalse();
  });
});
