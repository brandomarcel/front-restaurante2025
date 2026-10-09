import { LiteDocumentSequencesComponent } from './lite-document-sequences.component';

describe('Document sequence matrix', () => {
  let component: LiteDocumentSequencesComponent;
  const establishment = { name: 'EST-1', establishment_code: '001', establishment_name: 'Matriz' };
  const point = { name: 'P-1', emission_point_code: '002', emission_point_name: 'Caja', establishment: 'EST-1' };

  beforeEach(() => {
    const capabilities = {
      activeBusinessId: 'BIZ-1',
      activeEstablishments: [establishment],
      activeEmissionPointsFor: () => [point],
      business: { environment: 'Pruebas' }
    };
    const route = { snapshot: { queryParamMap: { get: () => null } } };
    component = new LiteDocumentSequencesComponent({} as any, {} as any, capabilities as any, {} as any, route as any);
    component.selectedEstablishmentId = 'EST-1';
    component.selectedEmissionPointId = 'P-1';
  });

  const sequence = (overrides: any) => ({
    business: 'BIZ-1', establishment: 'EST-1', emission_point: 'P-1',
    document_type: 'Factura', environment: 'Pruebas', status: 'Activo', current_number: 25, ...overrides
  });

  it('shows the active sequence of a combination and keeps the inactive one in history', () => {
    component.sequences = [
      sequence({ name: 'OLD', status: 'Inactivo', current_number: 3 }),
      sequence({ name: 'NEW' })
    ];
    expect(component.sequenceFor('Factura', 'Pruebas')?.name).toBe('NEW');
    expect(component.historySequences.map((item: any) => item.name)).toEqual(['OLD']);
  });

  it('previews the full printed number of the next document', () => {
    component.sequences = [sequence({ name: 'NEW' })];
    expect(component.nextDocumentNumber(component.sequenceFor('Factura', 'Pruebas'))).toBe('001-002-000000026');
    expect(component.selectedSeries).toBe('001-002');
  });

  it('is ready to invoice only with an active invoice sequence in the profile environment', () => {
    component.sequences = [sequence({ name: 'PROD', environment: 'Produccion' })];
    expect(component.pointReadyForProfile).toBeFalse();
    component.sequences = [sequence({ name: 'TEST' })];
    expect(component.pointReadyForProfile).toBeTrue();
  });

  it('never shows sequences from another emission point', () => {
    component.sequences = [sequence({ name: 'OTHER', emission_point: 'P-9' })];
    expect(component.sequenceFor('Factura', 'Pruebas')).toBeNull();
  });
});
