import { FiscalSetupHeaderComponent } from './fiscal-setup-header.component';

describe('Fiscal setup steps', () => {
  function build(state: { establishments: any[]; points: Record<string, any[]>; sequences: any[]; environment?: string }) {
    const capabilities = {
      activeBusiness: { business_name: 'Mi negocio', environment: state.environment ?? 'Pruebas' },
      business: null,
      activeEstablishments: state.establishments,
      activeEmissionPointsFor: (item: any) => state.points[item?.name] || [],
      sequences: state.sequences
    };
    return new FiscalSetupHeaderComponent(capabilities as any);
  }
  const done = (component: FiscalSetupHeaderComponent) => component.steps.map(step => step.done);

  it('starts with every step pending', () => {
    expect(done(build({ establishments: [], points: {}, sequences: [] }))).toEqual([false, false, false]);
  });

  it('only completes sequences with an active invoice sequence in the profile environment', () => {
    const base = { establishments: [{ name: 'EST-1' }], points: { 'EST-1': [{ name: 'P-1' }] } };
    expect(done(build({ ...base, sequences: [{ document_type: 'Factura', environment: 'Produccion', status: 'Activo' }] })))
      .toEqual([true, true, false]);
    expect(done(build({ ...base, sequences: [{ document_type: 'Factura', environment: 'Pruebas', status: 'Activo' }] })))
      .toEqual([true, true, true]);
    expect(done(build({ ...base, sequences: [{ document_type: 'Factura', environment: 'Pruebas', status: 'Inactivo' }] })))
      .toEqual([true, true, false]);
  });
});
