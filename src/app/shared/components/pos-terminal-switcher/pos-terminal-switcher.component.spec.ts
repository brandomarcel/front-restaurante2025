import { PosTerminalSwitcherComponent } from './pos-terminal-switcher.component';

describe('Selector global de terminal POS', () => {
  const caja1 = { name: 'T-1', terminal_name: 'Caja 1', establishment_code: '001', emission_point_code: '001', status: 'Activo' };
  const caja2 = { name: 'T-2', terminal_name: 'Caja 2', establishment_code: '001', emission_point_code: '002', status: 'Activo' };
  let state: any;
  let component: PosTerminalSwitcherComponent;
  let reloads: number;

  beforeEach(() => {
    state = { model: true, terminals: [caja1, caja2], active: null, accessRequired: false, hasAccess: true, requiresSelection: false };
    const capabilities = {
      get usesPosTerminalModel() { return state.model; },
      get posTerminals() { return state.terminals; },
      get activePosTerminal() { return state.active; },
      get terminalAccessRequired() { return state.accessRequired; },
      get hasTerminalAccess() { return state.hasAccess; },
      get requiresTerminalSelection() { return state.requiresSelection; },
      get needsPosTerminalSelection() { return state.terminals.length > 1 && !state.active; },
      setActivePosTerminal: (terminal: any) => { state.active = terminal; return true; }
    };
    reloads = 0;
    component = new PosTerminalSwitcherComponent(capabilities as any);
    (component as any).reload = () => reloads++;
  });

  it('no aparece en negocios sin modelo de terminales', () => {
    state.model = false;
    expect(component.visible).toBeFalse();
  });

  it('pide elegir cuando hay varias terminales y ninguna activa', () => {
    expect(component.visible).toBeTrue();
    expect(component.state).toBe('pending');
    expect(component.message).toContain('Elige la terminal');
    expect(component.canChange).toBeTrue();
  });

  it('elegir otra terminal la activa y recarga para refrescar stock y serie', () => {
    component.select(caja2);
    expect(state.active).toBe(caja2);
    expect(reloads).toBe(1);
    component.select(caja2);
    expect(reloads).toBe(1);
  });

  it('avisa cuando el usuario no tiene terminal asignada', () => {
    state.accessRequired = true;
    state.hasAccess = false;
    state.terminals = [];
    expect(component.visible).toBeTrue();
    expect(component.state).toBe('blocked');
    expect(component.message).toContain('Contacta al administrador');
  });

  it('con una sola terminal la muestra sin permitir cambiarla', () => {
    state.terminals = [caja1];
    state.active = caja1;
    expect(component.state).toBe('ok');
    expect(component.canChange).toBeFalse();
    expect(component.series(caja1)).toBe('001-001');
  });
});
