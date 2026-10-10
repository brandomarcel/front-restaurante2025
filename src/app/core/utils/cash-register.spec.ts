import { cashDifferenceKind, cashOpeningName, isClosedCashStatus, readCashBackendMessage, sumDenominations } from './cash-register';

describe('cash-register utils', () => {
  it('reconoce estados cerrados en español e inglés, con o sin tilde', () => {
    expect(isClosedCashStatus('Cerrada')).toBeTrue();
    expect(isClosedCashStatus('closed')).toBeTrue();
    expect(isClosedCashStatus('Abierta')).toBeFalse();
  });

  it('lee el id de la apertura en texto o registro', () => {
    expect(cashOpeningName(' AP-1 ')).toBe('AP-1');
    expect(cashOpeningName({ cash_opening: 'AP-2' })).toBe('AP-2');
    expect(cashOpeningName(null)).toBe('');
  });

  it('lee _server_messages de Frappe', () => {
    expect(readCashBackendMessage({ error: { _server_messages: JSON.stringify([{ message: 'Caja cerrada' }]) } })).toBe('Caja cerrada');
  });

  it('suma billetes y monedas sin errores de coma flotante', () => {
    // 2×$20 + 1×$5 + 3×25¢ + 7×1¢ (índices 2, 4, 8, 11)
    const quantities = [0, 0, 2, 0, 1, 0, 0, 0, 3, 0, 0, 7];
    expect(sumDenominations(quantities)).toBe(45.82);
    expect(sumDenominations([0, 0, 0, 0, 0, 0, 0, 0, 0, 3])).toBe(0.3);
  });

  it('clasifica la diferencia', () => {
    expect(cashDifferenceKind(-0.004)).toBe('even');
    expect(cashDifferenceKind(-2)).toBe('short');
    expect(cashDifferenceKind(1.5)).toBe('over');
  });
});
