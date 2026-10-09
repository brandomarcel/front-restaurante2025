import { FormBuilder } from '@angular/forms';
import { of } from 'rxjs';
import { LitePosTerminalsComponent } from './lite-pos-terminals.component';

describe('POS terminal setup', () => {
  let component: LitePosTerminalsComponent;
  let warehouseMode = false;

  beforeEach(() => {
    warehouseMode = false;
    const capabilities = {
      activeBusinessId: 'BIZ-1',
      hasPermission: () => true,
      isEnabled: () => false,
      get isWarehouseMode() { return warehouseMode; },
      activeWarehouses: [],
      activeEstablishments: [{ name: 'EST-1', establishment_code: '001' }],
      activeEmissionPointsFor: (id: string) => id === 'EST-1' ? [{ name: 'P-1', emission_point_code: '002' }] : []
    };
    const company = { getLitePosTerminal: () => of(null) };
    component = new LitePosTerminalsComponent(new FormBuilder(), company as any, {} as any, capabilities as any, {} as any, {} as any);
    (component as any).form = new FormBuilder().group({ terminal_name: [''], establishment: [''], emission_point: [''], warehouse: [''], status: ['Activo'] });
  });

  it('preselects the only establishment and point when creating', () => {
    component.openCreate();
    expect(component.form.get('establishment')?.value).toBe('EST-1');
    expect(component.form.get('emission_point')?.value).toBe('P-1');
    expect(component.formSeries).toBe('001-002');
  });

  it('locks the fiscal location when editing but still sends it', () => {
    component.openEdit({ name: 'T-1', terminal_name: 'Caja 1', establishment: 'EST-1', emission_point: 'P-1' });
    expect(component.form.get('establishment')?.disabled).toBeTrue();
    expect(component.form.getRawValue().establishment).toBe('EST-1');
    component.openCreate();
    expect(component.form.get('establishment')?.enabled).toBeTrue();
  });

  it('warns about terminals nobody can use or that cannot sell', () => {
    const terminal = { name: 'T-1', status: 'Activo', users: [] };
    expect(component.warnings(terminal).length).toBe(1);
    warehouseMode = true;
    expect(component.warnings(terminal).length).toBe(2);
    expect(component.warnings({ ...terminal, status: 'Inactivo' })).toEqual([]);
  });
});
