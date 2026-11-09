import { AuthComponent } from './auth.component';

describe('AuthComponent: ticket de ejemplo', () => {
  for (let index = 0; index < 5; index++) {
    it(`cuadra subtotal, IVA y total del ejemplo ${index + 1}`, () => {
      spyOn(Math, 'random').and.returnValue(index / 5);
      const component = new AuthComponent();
      const round = (value: number) => Math.round(value * 100) / 100;
      expect(component.subtotal).toBe(
        round(component.sample.lines.reduce((sum, line) => sum + line.qty * line.price, 0)),
      );
      expect(component.vat).toBe(round(component.subtotal * 0.15));
      expect(component.total).toBe(round(component.subtotal + component.vat));
      expect(component.money(8.3)).toBe('8,30');
    });
  }
  it('no toma el logo del último negocio del almacenamiento', () => {
    const read = spyOn(localStorage, 'getItem').and.callThrough();
    new AuthComponent();
    expect(read).not.toHaveBeenCalledWith('logo');
  });
});
