import { TestBed } from '@angular/core/testing';
import { CartService } from '../services/cart.service';
import { LineNoteEditorComponent } from './line-note-editor.component';

describe('Editor de nota de cocina: «Sin <insumo>»', () => {
  let cart: CartService;
  let editor: LineNoteEditorComponent;
  const lech = { ingredient: 'LECH', name: 'Lechuga' };
  const tom = { ingredient: 'TOM', name: 'Tomate' };

  function open(item: any) {
    editor = TestBed.runInInjectionContext(() => new LineNoteEditorComponent(cart));
    editor.item = item;
    editor.ngOnInit();
  }

  beforeEach(() => {
    cart = new CartService();
    cart.addProduct({ name: 'HAM', nombre: 'Hamburguesa', precio: 5, tax_value: 0, removable_ingredients: [lech, tom] } as any);
  });

  it('muestra solo los insumos que el plato permite quitar', () => {
    open(cart.cart[0]);
    expect(editor.removable.map((r) => r.name)).toEqual(['Lechuga', 'Tomate']);
  });

  it('marcar «Sin Lechuga» agrega el texto a la nota y guarda el insumo quitado', () => {
    open(cart.cart[0]);
    editor.toggleRemoved(lech);
    expect(editor.isRemoved('LECH')).toBeTrue();
    expect(editor.draft).toBe('Sin Lechuga');
    editor.save(editor.draft);
    expect(cart.cart[0].notes).toBe('Sin Lechuga');
    expect(cart.cart[0].removed_ingredients).toEqual(['LECH']);
  });

  it('desmarcar quita el insumo y su texto de la nota', () => {
    open(cart.cart[0]);
    editor.toggleRemoved(lech);
    editor.toggleRemoved(tom);
    editor.toggleRemoved(lech);
    expect(editor.draft).toBe('Sin Tomate');
    editor.save(editor.draft);
    expect(cart.cart[0].removed_ingredients).toEqual(['TOM']);
  });

  it('quitar la nota también limpia los insumos quitados', () => {
    open(cart.cart[0]);
    editor.toggleRemoved(lech);
    editor.save(editor.draft);
    open(cart.cart[0]);
    editor.save('');
    expect(cart.cart[0].notes).toBe('');
    expect(cart.cart[0].removed_ingredients).toEqual([]);
  });

  it('recuerda los insumos quitados al reabrir el editor', () => {
    open(cart.cart[0]);
    editor.toggleRemoved(tom);
    editor.save(editor.draft);
    open(cart.cart[0]);
    expect(editor.isRemoved('TOM')).toBeTrue();
    expect(editor.isRemoved('LECH')).toBeFalse();
  });
});
