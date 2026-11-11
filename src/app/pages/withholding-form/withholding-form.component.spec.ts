import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { NgxSpinnerService } from 'ngx-spinner';
import { Subject, of } from 'rxjs';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { FrappeErrorService } from 'src/app/core/services/frappe-error.service';
import { LiteSupplier, LiteSuppliersService } from 'src/app/services/lite-suppliers.service';
import { WithholdingSetup, WithholdingsService } from 'src/app/services/withholdings.service';
import { WithholdingFormComponent } from './withholding-form.component';

const supplier: LiteSupplier = {
  name: 'SUP-TEST',
  supplier_name: 'Empresa ficticia',
  identification_type: '04',
  identification: '1790012345001',
  related_party: false,
  is_active: true,
};
const setupData = (): WithholdingSetup => ({
  withholding_agent: true,
  block_message: null,
  support_codes: [{ code: '01', label: 'Crédito tributario' }],
  document_types: [{ code: '01', label: 'Factura' }],
  tax_codes: [
    { code: '4', label: 'IVA 15 %', rate: 15 },
    { code: '0', label: 'IVA 0 %', rate: 0 },
  ],
  vat_withholding_rates: [10, 20, 30, 50, 70, 100],
  payment_methods: [{ code: '20', label: 'Transferencia' }],
  income_concepts: [
    { code: '312', label: 'Concepto de prueba', form_103: '312', percentage: 2, variable: false },
    { code: '332', label: 'Sin retención', form_103: '332', percentage: 0, variable: false },
  ],
});

describe('WithholdingFormComponent', () => {
  let service: jasmine.SpyObj<WithholdingsService>;
  let capabilities: any;
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 10, 10, 12));
    service = jasmine.createSpyObj<WithholdingsService>('WithholdingsService', [
      'getSetup',
      'getDetail',
      'lookupAccessKey',
      'saveDraft',
      'createAndEmit',
      'emitDraft',
      'getPurchaseSettlement',
    ]);
    service.getSetup.and.returnValue(of(setupData()));
    service.saveDraft.and.returnValue(of({ name: 'WH-TEST' }));
    capabilities = {
      business: { environment: 'Pruebas' },
      activeEstablishments: [{ name: 'EST-MAIN', is_main: true }, { name: 'EST-RET' }],
      activeEmissionPointsFor: (est: string) => [
        { name: est === 'EST-RET' ? 'POINT-RET' : 'POINT-MAIN', is_default: true },
      ],
      hasActiveSequence: jasmine.createSpy().and.callFake((_type: string, est: string) => est === 'EST-RET'),
      hasPermission: jasmine.createSpy().and.returnValue(true),
      getEmissionBlockMessage: jasmine.createSpy().and.returnValue(''),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: WithholdingsService, useValue: service },
        { provide: LiteSuppliersService, useValue: { search: () => of({ data: [] }), save: () => of(supplier) } },
        { provide: CompanyCapabilitiesService, useValue: capabilities },
        { provide: FrappeErrorService, useValue: { handle: () => 'Error simulado' } },
        {
          provide: NgxSpinnerService,
          useValue: { show: jasmine.createSpy(), hide: jasmine.createSpy(), getSpinner: () => of({ show: false }) },
        },
      ],
    });
  });
  afterEach(() => jasmine.clock().uninstall());

  function create() {
    const fixture = TestBed.createComponent(WithholdingFormComponent);
    fixture.detectChanges();
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    return fixture;
  }

  function valid(component: WithholdingFormComponent) {
    component.supplier = supplier;
    component.form.patchValue({ num_doc_sustento: '001-001-000000123', fecha_emision_doc_sustento: '2026-11-10' });
    component.taxes.at(0).get('base_imponible')!.setValue(100);
    component.retentions.at(0).get('codigo_retencion')!.setValue('312');
  }

  for (const [vat, expectedSupport, taxCode] of [[15, '01', '4'], [0, '02', '0']] as const) {
    it(`prefills support ${expectedSupport} from a purchase settlement ${vat ? 'with' : 'without'} VAT`, () => {
      TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { paramMap: convertToParamMap({}),
        queryParamMap: convertToParamMap({ liquidacion: 'LIQ-TEST' }) } } });
      const data = setupData();
      data.support_codes.push({ code: '02', label: 'Costo o gasto' });
      data.income_concepts.push({ code: '311', label: 'Liquidaciones', form_103: '311', percentage: 3, variable: false });
      service.getSetup.and.returnValue(of(data));
      service.getPurchaseSettlement.and.returnValue(of({ name: 'LIQ-TEST', status: 'Autorizada', supplier: { ...supplier,
        identification_type: '05', identification: '1803296829' }, total_iva: vat, total_sin_impuestos: 100,
        posting_date: '2026-11-10', forma_pago: '20', taxes: [{ tax_code: taxCode, base_imponible: 100 }],
        electronic: { document_number: '001-001-000000123', access_key: '1'.repeat(49) } }));
      const component = create().componentInstance;
      expect(service.getPurchaseSettlement).toHaveBeenCalledOnceWith('LIQ-TEST');
      expect(component.form.value.cod_doc_sustento).toBe('03');
      expect(component.form.value.cod_sustento).toBe(expectedSupport);
      expect(component.form.value.num_doc_sustento).toBe('001-001-000000123');
      expect(component.retentions.at(0).value).toEqual({ tax_type: 'Renta', codigo_retencion: '311', porcentaje: 3, base_imponible: 100 });
      expect(component.retentions.length).toBe(vat ? 2 : 1);
      if (vat) expect(component.retentions.at(1).value.porcentaje).toBe(100);
      expect(service.lookupAccessKey).not.toHaveBeenCalled();
      expect(component.supplierMismatch).toBeFalse();
    });
  }

  it('warns instead of prefilling a purchase settlement already annulled in SRI', () => {
    TestBed.overrideProvider(ActivatedRoute, { useValue: { snapshot: { paramMap: convertToParamMap({}),
      queryParamMap: convertToParamMap({ liquidacion: 'LIQ-VOID' }) } } });
    service.getPurchaseSettlement.and.returnValue(of({ name: 'LIQ-VOID', status: 'Anulada' }));
    const fixture = create(), component = fixture.componentInstance;
    expect(component.keyWarnings[0]).toContain('está anulada');
    expect(component.form.value.num_doc_sustento).toBe('');
    expect(service.createAndEmit).not.toHaveBeenCalled();
  });

  it('prefers a location with a retention sequence over the main establishment', () => {
    const component = create().componentInstance;
    expect(component.form.value.establishment).toBe('EST-RET');
    expect(component.form.value.emission_point).toBe('POINT-RET');
    expect(capabilities.hasActiveSequence).toHaveBeenCalledWith(
      'Comprobante de Retencion',
      'EST-RET',
      'POINT-RET',
      'Pruebas',
    );
    expect(component.taxes.at(0).value.tax_code).toBe('4');
  });

  it('renders the non-agent block and does not offer emission', () => {
    service.getSetup.and.returnValue(of({ ...setupData(), withholding_agent: false }));
    const fixture = create();
    expect(fixture.nativeElement.textContent).toContain('Tu negocio no está marcado como agente de retención');
    expect(fixture.componentInstance.canSaveDraft).toBeFalse();
    fixture.componentInstance.emitir();
    expect(service.createAndEmit).not.toHaveBeenCalled();
  });

  it('uses the catalog percentage, blocks mismatches and accepts the zero-percent concept', () => {
    const component = create().componentInstance;
    valid(component);
    const row = component.retentions.at(0);
    expect(row.get('porcentaje')!.value).toBe(2);
    row.get('porcentaje')!.setValue(1.75);
    component.submitted = true;
    expect(component.validationSummary.some((message) => message.includes('312 se retiene al 2 %'))).toBeTrue();
    row.get('codigo_retencion')!.setValue('332');
    expect(row.get('porcentaje')!.value).toBe(0);
    expect(row.valid).toBeTrue();
    expect(component.validationSummary).toEqual([]);
    expect(component.totalRenta).toBe(0);
  });

  it('follows invoice bases until the user changes a retention base', () => {
    const component = create().componentInstance;
    valid(component);
    component.addRetention('IVA');
    const vat = component.retentions.at(1);
    expect(vat.get('base_imponible')!.value).toBe(15);
    component.taxes.at(0).get('base_imponible')!.setValue(200);
    expect(component.retentions.at(0).get('base_imponible')!.value).toBe(200);
    expect(vat.get('base_imponible')!.value).toBe(30);
    vat.get('base_imponible')!.markAsDirty();
    vat.get('base_imponible')!.setValue(17);
    component.taxes.at(0).get('base_imponible')!.setValue(300);
    expect(vat.get('base_imponible')!.value).toBe(17);
    expect(component.invoiceTotal).toBe(345);
  });

  it('reports future date, malformed authorization and excessive retained bases without sending', () => {
    const component = create().componentInstance;
    valid(component);
    component.form.patchValue({ fecha_emision_doc_sustento: '2026-11-11', num_aut_doc_sustento: '1234' });
    const row = component.retentions.at(0);
    row.get('base_imponible')!.markAsDirty();
    row.get('base_imponible')!.setValue(101);
    component.emitir();
    expect(component.validationSummary.some((message) => message.includes('posterior a hoy'))).toBeTrue();
    expect(component.validationSummary.some((message) => message.includes('49, 37 o 10'))).toBeTrue();
    expect(
      component.validationSummary.some((message) => message.includes('no puede superar el valor sin IVA')),
    ).toBeTrue();
    expect(service.createAndEmit).not.toHaveBeenCalled();
  });

  it('looks up a cleaned access key once and fills the known supplier and support data', () => {
    service.lookupAccessKey.and.returnValue(
      of({
        valid: true,
        ruc: supplier.identification,
        supplier,
        test_environment: true,
        document_type: '01',
        number: '001-001-000000123',
        issue_date: '2026-11-09',
      }),
    );
    const component = create().componentInstance;
    component.form.get('num_aut_doc_sustento')!.setValue('1'.repeat(24) + ' ' + '1'.repeat(25));
    expect(service.lookupAccessKey).toHaveBeenCalledOnceWith('1'.repeat(49));
    expect(component.form.value.num_doc_sustento).toBe('001-001-000000123');
    expect(component.form.value.fecha_emision_doc_sustento).toBe('2026-11-09');
    expect(component.supplier!.name).toBe('SUP-TEST');
    expect(component.keyWarnings[0]).toContain('pruebas');
    component.form.get('num_aut_doc_sustento')!.setValue('1'.repeat(49));
    expect(service.lookupAccessKey).toHaveBeenCalledTimes(1);
  });

  it('opens a new supplier with the key RUC when no matching supplier exists', () => {
    service.lookupAccessKey.and.returnValue(
      of({
        valid: true,
        ruc: supplier.identification,
        supplier: null,
        test_environment: false,
        document_type: '01',
        number: '001-001-000000123',
        issue_date: '2026-11-09',
      }),
    );
    const fixture = create(),
      component = fixture.componentInstance;
    const open = spyOn(component.supplierPicker!, 'openNew');
    component.form.get('num_aut_doc_sustento')!.setValue('1'.repeat(49));
    jasmine.clock().tick(0);
    expect(component.supplier).toBeNull();
    expect(open).toHaveBeenCalledOnceWith({ identification: '1790012345001', identification_type: '04' });
  });

  it('keeps invalid access keys as warnings without populating support fields', () => {
    service.lookupAccessKey.and.returnValue(
      of({
        valid: false,
        message: 'Clave inválida',
        ruc: '',
        supplier: null,
        test_environment: false,
        document_type: '',
        number: '',
        issue_date: '',
      }),
    );
    const component = create().componentInstance;
    component.form.get('num_aut_doc_sustento')!.setValue('1'.repeat(49));
    expect(component.keyWarnings).toEqual(['Clave inválida']);
    expect(component.form.value.num_doc_sustento).toBe('');
  });

  it('warns after five calendar days while keeping a valid draft available', () => {
    const component = create().componentInstance;
    valid(component);
    component.form.get('fecha_emision_doc_sustento')!.setValue('2026-11-05');
    expect(component.isLate).toBeFalse();
    component.form.get('fecha_emision_doc_sustento')!.setValue('2026-11-04');
    expect(component.isLate).toBeTrue();
    expect(component.canSaveDraft).toBeTrue();
  });

  it('saves the supplier/support/retention payload without trusting calculated tax or retained values', () => {
    const component = create().componentInstance;
    valid(component);
    component.guardarBorrador();
    expect(service.saveDraft).toHaveBeenCalledOnceWith({
      establishment: 'EST-RET',
      emission_point: 'POINT-RET',
      environment: 'Pruebas',
      supplier: 'SUP-TEST',
      support: {
        cod_sustento: '01',
        cod_doc_sustento: '01',
        num_doc_sustento: '001-001-000000123',
        fecha_emision_doc_sustento: '2026-11-10',
        forma_pago: '20',
        taxes: [{ tax_code: '4', base_imponible: 100 }],
      },
      retentions: [{ tax_type: 'Renta', codigo_retencion: '312', base_imponible: 100, porcentaje: 2 }],
    });
    expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/dashboard/withholdings', 'WH-TEST']);
  });

  it('prevents emission without a sequence or when the common emission guard blocks it', () => {
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

  it('waits for the draft save before emitting an edited withholding', () => {
    const component = create().componentInstance;
    valid(component);
    component.withholdingName = 'WH-EDIT';
    const save = new Subject<any>();
    service.saveDraft.and.returnValue(save);
    service.emitDraft.and.returnValue(of({ state: 'PROCESSING', data: { name: 'WH-EDIT' } } as any));
    component.emitir();
    expect(service.emitDraft).not.toHaveBeenCalled();
    save.next({ name: 'WH-EDIT' });
    save.complete();
    expect(service.emitDraft).toHaveBeenCalledOnceWith('WH-EDIT');
    expect(component.submitting).toBeFalse();
  });

  it('preserves the valid zero percentage when reopening a saved 332 draft', () => {
    TestBed.overrideProvider(ActivatedRoute, {
      useValue: { snapshot: { paramMap: convertToParamMap({ id: 'WH-ZERO' }) } },
    });
    service.getDetail.and.returnValue(
      of({
        name: 'WH-ZERO',
        status: 'Borrador',
        supplier,
        establishment: 'EST-RET',
        emission_point: 'POINT-RET',
        environment: 'Pruebas',
        support: {
          num_doc_sustento: '001-001-000000123',
          fecha_emision_doc_sustento: '2026-11-10',
          taxes: [{ tax_code: '4', base_imponible: 100 }],
        },
        retentions: [{ tax_type: 'Renta', codigo_retencion: '332', base_imponible: 100, porcentaje: 0 }],
      }),
    );
    const component = create().componentInstance;
    expect(component.retentions.at(0).get('porcentaje')!.value).toBe(0);
    component.submitted = true;
    expect(component.validationSummary).toEqual([]);
  });
});
