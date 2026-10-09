import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { FormBuilder } from '@angular/forms';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { InvoicesService } from 'src/app/services/invoices.service';
import { CompanyComponent } from '../company/company.component';
import { InvoicingComponent } from './invoicing.component';

// Use the real capability store and HTTP adapter to verify the selected location.
describe('Invoice fiscal location selection', () => {
  let component: InvoicingComponent;
  let capabilities: CompanyCapabilitiesService;
  let http: HttpTestingController;
  let saved: Record<string, string>;
  const establishments = [
    { name: 'EST-1', business: 'BIZ-1', establishment_code: '001', status: 'Activo' },
    { name: 'EST-2', business: 'BIZ-1', establishment_code: '002', status: 'Activo' },
    { name: 'EST-OFF', business: 'BIZ-1', status: 'Inactivo' },
    { name: 'EST-OTHER', business: 'BIZ-2', status: 'Activo' }
  ];
  const points = [
    { name: 'POINT-1', business: 'BIZ-1', establishment: 'EST-1', emission_point_code: '001', status: 'Activo' },
    { name: 'POINT-2', business: 'BIZ-1', establishment: 'EST-1', emission_point_code: '002', status: 'Activo' },
    { name: 'POINT-3', business: 'BIZ-1', establishment: 'EST-2', emission_point_code: '001', status: 'Activo' },
    { name: 'POINT-OFF', business: 'BIZ-1', establishment: 'EST-1', status: 'Inactivo' },
    { name: 'POINT-OTHER', business: 'BIZ-2', establishment: 'EST-1', status: 'Activo' }
  ];
  const terminal = { name: 'TERMINAL-1', business: 'BIZ-1', establishment: 'EST-1', emission_point: 'POINT-1', status: 'Activo' };

  function setup(config: any = {}) {
    localStorage.setItem('active_business', 'BIZ-1');
    localStorage.setItem('company_capabilities', JSON.stringify({
      features: { billing: true, direct_invoice: true, pos_terminal: false },
      business: { name: 'BIZ-1', environment: 'Pruebas' }, businesses: [{ name: 'BIZ-1' }],
      establishments, emissionPoints: points, posTerminals: [terminal],
      sequences: points.map(point => ({ name: `SEQ-${point.name}`, business: 'BIZ-1',
        establishment: point.establishment, emission_point: point.name,
        document_type: 'Factura', environment: 'Pruebas', status: 'Activo' })), loaded: true, ...config
    }));
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    capabilities = TestBed.inject(CompanyCapabilitiesService);
    http = TestBed.inject(HttpTestingController);
    const mock = {} as any;
    component = new InvoicingComponent(mock, mock, mock, mock, mock, mock, new FormBuilder(),
      TestBed.inject(InvoicesService), mock, { getSoloFechaEcuador: () => '2026-10-08' } as any, capabilities);
    (component as any).ensureFiscalSelection();
  }
  beforeEach(() => {
    saved = {};
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index)!;
      saved[key] = localStorage.getItem(key)!;
    }
    localStorage.clear();
  });
  afterEach(() => {
    http.verify();
    localStorage.clear();
    Object.entries(saved).forEach(([key, value]) => localStorage.setItem(key, value));
  });

  it('shows only active locations belonging to the current business', () => {
    setup();
    expect(component.canSelectFiscalLocation).toBeTrue();
    expect(component.fiscalEstablishments.map(item => item.name)).toEqual(['EST-1', 'EST-2']);
    component.selectFiscalEstablishment('EST-1');
    expect(component.fiscalEmissionPoints.map(item => item.name)).toEqual(['POINT-1', 'POINT-2']);
    expect(component.selectedEmissionPointId).toBe('');
  });

  it('clears the previous point and automatically selects a sole point after changing establishment', () => {
    setup();
    component.selectFiscalEstablishment('EST-1');
    component.selectFiscalEmissionPoint('POINT-2');
    component.selectFiscalEstablishment('EST-2');
    expect(component.selectedEmissionPointId).toBe('POINT-3');
    component.selectFiscalEstablishment('EST-1');
    expect(component.selectedEmissionPointId).toBe('');
  });

  it('automatically selects the single establishment and point', () => {
    setup({ establishments: [establishments[1]], emissionPoints: [points[2]] });
    expect(component.selectedEstablishmentId).toBe('EST-2');
    expect(component.selectedEmissionPointId).toBe('POINT-3');
  });

  it('prevents mismatched or foreign points and requires a matching invoice sequence', () => {
    setup();
    component.selectFiscalEstablishment('EST-1');
    component.selectFiscalEmissionPoint('POINT-3');
    expect(component.selectedEmissionPointId).toBe('');
    expect(capabilities.getLiteDocumentConfiguration('Factura', 'Pruebas')).toBeNull();
    component.selectFiscalEmissionPoint('POINT-2');
    expect(capabilities.getLiteDocumentConfiguration('Factura', 'Pruebas')?.sequence.name).toBe('SEQ-POINT-2');
    expect(capabilities.getLiteDocumentConfiguration('Factura', 'Produccion')).toBeNull();
  });

  it('sends the chosen fiscal location without injecting a disabled POS terminal', () => {
    setup();
    component.selectFiscalEstablishment('EST-2');
    const config = capabilities.getLiteDocumentConfiguration('Factura', 'Pruebas')!;
    TestBed.inject(InvoicesService).create_and_emit_from_ui_v2({
      establishment: config.establishment.name, emission_point: config.emissionPoint.name, items: [], payments: []
    }).subscribe();
    const request = http.expectOne(req => req.url.includes('create_and_emit_from_ui_v2'));
    expect(request.request.body.business).toBe('BIZ-1');
    expect(request.request.body.establishment).toBe('EST-2');
    expect(request.request.body.emission_point).toBe('POINT-3');
    expect(request.request.body.pos_terminal).toBeUndefined();
    request.flush({ message: { data: { name: 'INV-1' }, emission: { ok: true, code: 'SRI_RECEIVED' } } });
  });

  it('locks the selection during emission and after the invoice has been sent', () => {
    setup();
    component.selectFiscalEstablishment('EST-2');
    component.isEmitting = true;
    component.selectFiscalEstablishment('EST-1');
    expect(component.selectedEstablishmentId).toBe('EST-2');
    component.isEmitting = false;
    component.emissionInvoiceName = 'INV-PENDING';
    component.selectFiscalEmissionPoint('');
    expect(component.selectedEmissionPointId).toBe('POINT-3');
  });

  it('preserves the fixed fiscal location when POS terminals are enabled', () => {
    setup({ features: { billing: true, direct_invoice: true, pos_terminal: true } });
    expect(component.canSelectFiscalLocation).toBeFalse();
    component.selectFiscalEstablishment('EST-2');
    expect(capabilities.getLiteDocumentConfiguration('Factura', 'Pruebas')?.emissionPoint.name).toBe('POINT-1');
  });

  it('keeps the fiscal selection separate for each business', () => {
    setup();
    component.selectFiscalEstablishment('EST-2');
    localStorage.setItem('active_business', 'BIZ-2');
    (capabilities as any).state.set({ ...capabilities.config(), business: { name: 'BIZ-2' }, activeBusiness: { name: 'BIZ-2' }, businesses: [{ name: 'BIZ-2' }] });
    expect(component.selectedEstablishmentId).toBe('');
    expect(component.selectedEmissionPointId).toBe('');
  });

  function settings(): CompanyComponent {
    const mock = {} as any;
    const company = new CompanyComponent(new FormBuilder(), mock, mock, mock, mock, capabilities, mock, { url: '/settings/lite/general' } as any);
    (company as any).initForm();
    company.companyId = 'BIZ-1';
    company.liteSequences = capabilities.sequences;
    (company as any).syncLiteDocumentSelection();
    return company;
  }

  it('shares changes in Settings with New invoice and retains the establishment when clearing the point', () => {
    setup({ permissions: { '*': true } });
    const company = settings();
    company.onLiteEstablishmentSelected('EST-1');
    company.onLiteEmissionPointSelected('POINT-2');
    expect(component.selectedEmissionPointId).toBe('POINT-2');
    company.onLiteEmissionPointSelected('');
    expect(component.selectedEstablishmentId).toBe('EST-1');
    expect(company.selectedLiteEstablishment?.name).toBe('EST-1');
    expect(component.selectedEmissionPointId).toBe('');
    company.onLiteEstablishmentSelected('EST-2');
    expect(company.form.get('selected_emission_point')?.value).toBe('POINT-3');
    expect(company.activeInvoiceSequence?.name).toBe('SEQ-POINT-3');
  });

  it('retains the chosen location when setup refreshes its backend defaults', () => {
    setup();
    component.selectFiscalEstablishment('EST-2');
    capabilities.setLiteSetupState({ business: { name: 'BIZ-1' }, establishments, emission_points: points,
      tax_context: { establishment: 'EST-1', emission_point: 'POINT-1' } });
    expect(component.selectedEstablishmentId).toBe('EST-2');
    expect(component.selectedEmissionPointId).toBe('POINT-3');
    const company = settings();
    expect(company.form.get('selected_establishment')?.value).toBe('EST-2');
  });

  it('reconciles a removed point and falls back to an available single point', () => {
    setup();
    component.selectFiscalEstablishment('EST-1');
    component.selectFiscalEmissionPoint('POINT-2');
    capabilities.setLiteSetupState({ business: { name: 'BIZ-1' }, establishments,
      emission_points: [points[0], points[2]] });
    expect(component.selectedEmissionPointId).toBe('POINT-1');
  });

  it('ignores a late setup response for a different business', () => {
    setup();
    component.selectFiscalEstablishment('EST-2');
    capabilities.setLiteSetupState({ business: { name: 'BIZ-2' }, establishments: [], emission_points: [], sequences: [] });
    expect(component.selectedEstablishmentId).toBe('EST-2');
    expect(component.selectedEmissionPointId).toBe('POINT-3');
    expect(capabilities.sequences.length).toBe(points.length);
  });

  it('keeps settings sequence preview tied to its selection instead of the active POS terminal', () => {
    setup({ features: { billing: true, direct_invoice: true, pos_terminal: true }, permissions: { '*': true } });
    const company = settings();
    company.onLiteEstablishmentSelected('EST-2');
    expect(company.activeInvoiceSequence?.name).toBe('SEQ-POINT-3');
    expect(capabilities.getLiteDocumentConfiguration('Factura', 'Pruebas')?.sequence.name).toBe('SEQ-POINT-1');
  });

  it('saves only the environment through its dedicated action without location or sequence counters', () => {
    setup({ permissions: { '*': true } });
    const company = settings();
    company.onLiteEstablishmentSelected('EST-2');
    const general = (company as any).buildLiteSetupPayload();
    expect(general.current_number).toBeUndefined();
    expect(general.establishment_code).toBeUndefined();
    expect(general.emission_point_code).toBeUndefined();
    const fiscal = (company as any).buildLiteEmissionConfigurationPayload('PRUEBAS');
    expect(fiscal).toEqual({ business: 'BIZ-1', environment: 'Pruebas' });
  });


  it('filters invoice locations by active invoice sequences in the saved environment', () => {
    setup({ sequences: [
      { name: 'TEST', business: 'BIZ-1', establishment: 'EST-1', emission_point: 'POINT-2', document_type: 'Factura', environment: 'Pruebas', status: 'Activo' },
      { name: 'PROD', business: 'BIZ-1', establishment: 'EST-2', emission_point: 'POINT-3', document_type: 'Factura', environment: 'Produccion', status: 'Activo' },
      { name: 'INACTIVE', business: 'BIZ-1', establishment: 'EST-1', emission_point: 'POINT-1', document_type: 'Factura', environment: 'Pruebas', status: 'Inactivo' }
    ] });
    expect(component.fiscalEstablishments.map(item => item.name)).toEqual(['EST-1']);
    expect(component.selectedEmissionPointId).toBe('POINT-2');
    component.selectFiscalEmissionPoint('POINT-1');
    expect(component.selectedEmissionPointId).toBe('POINT-2');
    (capabilities as any).state.set({ ...capabilities.config(), business: { name: 'BIZ-1', environment: 'Produccion' } });
    (component as any).ensureFiscalSelection();
    expect(component.fiscalEstablishments.map(item => item.name)).toEqual(['EST-2']);
    expect(component.selectedEmissionPointId).toBe('POINT-3');
    expect(component.invoiceEnvironment).toBe('Produccion');
  });

  it('shows no eligible location when no invoice sequence exists for the environment', () => {
    setup({ sequences: [] });
    expect(component.fiscalEstablishments).toEqual([]);
    expect(component.selectedEstablishmentId).toBe('');
    expect(component.selectedEmissionPointId).toBe('');
  });

  it('does not treat changing invoice location as a pending environment setting', () => {
    setup({ permissions: { '*': true } });
    const company = settings();
    company.ambiente = 'PRUEBAS';
    company.onLiteEstablishmentSelected('EST-2');
    expect(company.hasPendingLiteEmissionConfiguration).toBeFalse();
    company.onLiteEnvironmentSelected('PRODUCCION');
    expect(company.hasPendingLiteEmissionConfiguration).toBeTrue();
    expect((company as any).buildLiteEmissionConfigurationPayload('PRODUCCION')).toEqual({ business: 'BIZ-1', environment: 'Produccion' });
  });

  it('automatically assigns a single payment after quantity, price and discount changes', () => {
    setup();
    prepareInvoice();
    component.paymentRows[0].amount = 0;
    component.updateCartTotals();
    expect(component.paymentRows[0].amount).toBe(10);
    component.cartItems[0].quantity = 3;
    component.cartItems[0].price = 20;
    component.cartItems[0].discount_percentage = 10;
    component.updateCartTotals();
    expect(component.paymentRows[0].amount).toBe(54);
    expect(component.paymentRemaining).toBe(0);
    component.cartItems = [];
    component.updateCartTotals();
    expect(component.paymentRows[0].amount).toBe(0);
  });

  it('preserves split amounts, fills the remainder and restores the total when one method remains', () => {
    setup();
    prepareInvoice();
    component.payments.push({ name: 'TRANSFER', codigo: '20', nombre: 'Transferencia' });
    component.addPaymentRow();
    expect(component.paymentRows[1].amount).toBe(0);
    component.paymentRows[0].amount = 4;
    component.updateCartTotals();
    expect(component.paymentRows[0].amount).toBe(4);
    component.completePaymentAmount(1);
    expect(component.paymentRows[1].amount).toBe(6);
    component.completePaymentAmount(1);
    expect(component.paymentRows[1].amount).toBe(6);
    component.removePaymentRow(0);
    expect(component.paymentRows[0]).toEqual({ method: 'TRANSFER', amount: 10 });
  });

  function prepareInvoice(): void {
    component.payments = [{ name: 'CASH', codigo: '01', nombre: 'Efectivo', description: 'Efectivo' }];
    (component as any).initializeForms();
    component.invoiceForm.patchValue({ selectedCustomer: 'CUSTOMER-1', paymentMethod: 'CASH' });
    component.selectedCustomer = { name: 'CUSTOMER-1', identification_number: '0912345678' } as any;
    component.cartItems = [{ name: 'ITEM-1', codigo: 'ITEM-1', quantity: 1, price: 10,
      discount_percentage: 0, discount_amount: 0, base_imponible: 10, iva: 0, total: 10 }];
    component.paymentRows = [{ method: 'CASH', amount: 10 }];
    component.selectFiscalEstablishment('EST-2');
    spyOn(capabilities, 'getPlanBlockMessage').and.returnValue(null);
    (component as any).productsService = { getAll: () => of([]) };
    (component as any).spinner = { show: () => {}, hide: () => {} };
  }

  it('restores cash defaults, clears credit validators and old payments for the next invoice', () => {
    setup({ permissions: { '*': true } });
    prepareInvoice();
    component.invoiceForm.patchValue({ payment_condition: 'Credito', payment_due_date: '2026-10-30',
      initial_collection_method: 'CASH', initial_collection_amount: 5, initial_collection_notes: 'Previous' });
    component.onPaymentConditionChange();
    component.paymentRows.push({ method: 'TRANSFER', amount: 5 });
    component.addAdditionalField({ field_name: 'Previous', field_value: 'Value' });
    component.emissionInvoiceName = 'INV-AUTHORIZED';
    component.emissionState = 'AUTHORIZED';
    (component as any).clearInvoiceForm();
    expect(component.invoiceForm.get('payment_condition')?.value).toBe('Contado');
    expect(component.invoiceForm.get('payment_condition')?.valid).toBeTrue();
    expect(component.invoiceForm.get('payment_due_date')?.value).toBe('');
    expect(component.invoiceForm.get('payment_due_date')?.valid).toBeTrue();
    expect(component.initialCollectionAmount).toBe(0);
    expect(component.paymentRows).toEqual([{ method: 'CASH', amount: 0 }]);
    expect(component.additionalFields.length).toBe(0);
    expect(component.cartItems).toEqual([]);
    expect(component.selectedEmissionPointId).toBe('POINT-3');
    component.invoiceForm.patchValue({ selectedCustomer: 'CUSTOMER-2' });
    expect(component.invoiceForm.valid).toBeTrue();
  });

  it('starts a fresh draft without sending or reissuing a pending document', () => {
    setup({ permissions: { '*': true } });
    prepareInvoice();
    component.emissionInvoiceName = 'INV-PENDING';
    component.emissionState = 'PROCESSING';
    component.startNewInvoice();
    expect(component.previousInvoice?.name).toBe('INV-PENDING');
    expect(component.previousInvoice?.state).toBe('PROCESSING');
    expect(component.emissionInvoiceName).toBe('');
    expect(component.canEmitInvoice).toBeTrue();
    http.expectNone(req => req.url.includes('create_and_emit') || req.url.includes('retry'));
  });

  it('does not discard an invoice while its submission or confirmation is in progress', () => {
    setup({ permissions: { '*': true } });
    prepareInvoice();
    component.emissionInvoiceName = 'INV-1';
    component.isEmitting = true;
    component.startNewInvoice();
    expect(component.emissionInvoiceName).toBe('INV-1');
    component.isEmitting = false;
    component.isConfirmingEmission = true;
    component.startNewInvoice();
    expect(component.emissionInvoiceName).toBe('INV-1');
  });

  it('uses direct invoicing eligibility when both billing and POS are enabled', () => {
    setup({ features: { billing: true, direct_invoice: true, generic_pos: true }, permissions: { '*': true } });
    prepareInvoice();
    expect(component.canEmitInvoice).toBeTrue();
    expect(capabilities.getPlanBlockMessage).toHaveBeenCalledWith('direct_invoice');
    (capabilities as any).state.set({ ...capabilities.config(), features: { ...capabilities.features, direct_invoice: false } });
    expect(component.canEmitInvoice).toBeFalse();
  });

  it('blocks duplicate confirmation and allows continuing after a processing result', async () => {
    setup({ permissions: { '*': true } });
    prepareInvoice();
    const confirm = jasmine.createSpy('confirm').and.returnValue(Promise.resolve({ isConfirmed: true }));
    (component as any).alertService = { confirm };
    component.finalizeInvoice();
    component.finalizeInvoice();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(component.fiscalSelectionLocked).toBeTrue();
    await Promise.resolve();
    await Promise.resolve();
    const request = http.expectOne(req => req.url.includes('create_and_emit_from_ui_v2'));
    request.flush({ message: { data: { name: 'INV-PENDING' }, emission: { ok: true, code: 'SRI_RECEIVED' } } });
    expect(component.emissionState).toBe('PROCESSING');
    expect(component.canEmitInvoice).toBeFalse();
    component.startNewInvoice();
    expect(component.previousInvoice?.name).toBe('INV-PENDING');
    expect(component.canEmitInvoice).toBeTrue();
  });

  it('refuses submission if the company changes while confirmation is open', async () => {
    setup({ permissions: { '*': true } });
    prepareInvoice();
    (component as any).alertService = { confirm: () => Promise.resolve({ isConfirmed: true }) };
    component.finalizeInvoice();
    (capabilities as any).state.set({ ...capabilities.config(), business: { name: 'BIZ-2' }, activeBusiness: { name: 'BIZ-2' }, businesses: [{ name: 'BIZ-2' }] });
    localStorage.setItem('active_business', 'BIZ-2');
    await Promise.resolve();
    await Promise.resolve();
    expect(component.isConfirmingEmission).toBeFalse();
    http.expectNone(req => req.url.includes('create_and_emit_from_ui_v2'));
  });


  it('keeps the next draft when a previous authorized invoice print dialog closes', async () => {
    setup({ permissions: { '*': true } });
    prepareInvoice();
    let resolvePrint!: (value: any) => void;
    const printChoice = new Promise(resolve => resolvePrint = resolve);
    const confirm = jasmine.createSpy('confirm').and.returnValues(Promise.resolve({ isConfirmed: true }), printChoice);
    (component as any).alertService = { confirm };
    component.finalizeInvoice();
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne(req => req.url.includes('create_and_emit_from_ui_v2')).flush({
      message: { data: { name: 'INV-AUTHORIZED' }, emission: { ok: true, code: 'SRI_AUTHORIZED' } }
    });
    component.startNewInvoice();
    component.invoiceForm.patchValue({ selectedCustomer: 'CUSTOMER-NEXT' });
    resolvePrint({ isConfirmed: false });
    await printChoice;
    expect(component.invoiceForm.get('selectedCustomer')?.value).toBe('CUSTOMER-NEXT');
    expect(component.previousInvoice?.name).toBe('INV-AUTHORIZED');
  });

});
