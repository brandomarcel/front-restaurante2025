import { CartService } from './cart.service';

describe('Carrito POS: insumos quitados y porciones de receta', () => {
  let cart: CartService;
  const burger = (portions: number | null = 18) =>
    ({ name: 'HAM', nombre: 'Hamburguesa', precio: 5, tax_value: 0, has_recipe: true, portions_available: portions, track_stock: 0 }) as any;

  beforeEach(() => (cart = new CartService()));

  it('agregar dos veces el mismo plato suma en una sola línea', () => {
    cart.addProduct(burger());
    cart.addProduct(burger());
    expect(cart.cart.length).toBe(1);
    expect(cart.cart[0].quantity).toBe(2);
  });

  it('una línea con insumo quitado no se mezcla con la normal', () => {
    cart.addProduct(burger());
    cart.setNote(cart.cart[0], 'Sin Lechuga', false, ['LECH']);
    cart.addProduct(burger());
    expect(cart.cart.length).toBe(2);
    expect(cart.cart.map((i) => i.removed_ingredients)).toEqual([['LECH'], []]);
  });

  it('con cantidad mayor a 1, «solo a 1» separa una unidad con el insumo quitado', () => {
    cart.addProduct(burger());
    cart.addProduct(burger());
    cart.setNote(cart.cart[0], 'Sin Tomate', true, ['TOM']);
    expect(cart.cart.map((i) => [i.quantity, i.removed_ingredients])).toEqual([[1, []], [1, ['TOM']]]);
  });

  it('dos líneas con la misma nota y los mismos quitados (en distinto orden) se unen', () => {
    cart.addProduct(burger());
    cart.setNote(cart.cart[0], 'Sin Lechuga, Sin Tomate', false, ['LECH', 'TOM']);
    cart.addProduct(burger());
    cart.setNote(cart.cart[1], 'Sin Lechuga, Sin Tomate', false, ['TOM', 'LECH']);
    expect(cart.cart.length).toBe(1);
    expect(cart.cart[0].quantity).toBe(2);
  });

  it('misma nota pero distinto insumo quitado queda en líneas separadas', () => {
    cart.addProduct(burger());
    cart.setNote(cart.cart[0], 'Sin extras', false, ['LECH']);
    cart.addProduct(burger());
    cart.setNote(cart.cart[1], 'Sin extras', false, ['TOM']);
    expect(cart.cart.length).toBe(2);
  });

  it('no deja pasar de las porciones que alcanzan', () => {
    expect(cart.addProduct(burger(2))).toBeTrue();
    expect(cart.addProduct(burger(2))).toBeTrue();
    expect(cart.addProduct(burger(2))).toBeFalse();
    expect(cart.cart[0].quantity).toBe(2);
  });

  it('un plato agotado (0 porciones) no se agrega', () => {
    expect(cart.addProduct(burger(0))).toBeFalse();
    expect(cart.cart.length).toBe(0);
  });

  it('sin dato de porciones no bloquea la venta (el backend valida)', () => {
    expect(cart.addProduct(burger(null))).toBeTrue();
  });
});
