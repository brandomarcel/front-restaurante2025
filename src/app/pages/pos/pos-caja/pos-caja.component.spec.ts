import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { faMinus, faPlus, faTimes } from '@fortawesome/free-solid-svg-icons';
import { of } from 'rxjs';
import { CartService } from '../services/cart.service';
import { PosCajaComponent } from './pos-caja.component';
import { PosCartLinesComponent } from './ui/pos-cart-lines.component';
import { PosProductCardComponent } from './ui/pos-product-card.component';

describe('POS caja — interfaz', () => {
  let component: PosCajaComponent;
  let cart: CartService;

  beforeEach(() => {
    cart = new CartService();
    const capabilities = {
      isEnabled: () => true, hasPermission: () => true, canEmit: () => true,
      getPosTerminalBlockMessage: () => null, getPlanBlockMessage: () => null,
      activeBusinessId: 'BIZ-1', business: { environment: 'Pruebas' }, features: {}
    };
    component = new PosCajaComponent({} as any, { getAll: () => of([]) } as any, {} as any, {} as any,
      {} as any, {} as any, {} as any, { getReceivables: () => of({ message: { data: [] } }) } as any,
      { show: () => undefined, hide: () => undefined } as any, {} as any, cart, {} as any, capabilities as any, {} as any,
      { url: '/dashboard/pos-generic', navigate: () => undefined } as any);
    component.customer = { name: 'C-1' };
  });

  it('explica por qué todavía no se puede cobrar', () => {
    component.customer = null;
    expect(component.checkoutHint).toBe('Agrega productos para cobrar.');
    cart.addProduct({ name: 'P-1', precio: 10, tax_value: 0 });
    expect(component.checkoutHint).toBe('Selecciona un cliente para cobrar.');
    component.customer = { name: 'C-1' };
    expect(component.checkoutHint).toBe('');
  });

  it('cuenta unidades, no líneas', () => {
    cart.addProduct({ name: 'P-1', precio: 10, tax_value: 0 });
    cart.addProduct({ name: 'P-1', precio: 10, tax_value: 0 });
    cart.addProduct({ name: 'P-2', precio: 5, tax_value: 0 });
    expect(component.cartItemsCount).toBe(3);
  });

  it('resincroniza la única forma de pago cuando un descuento cambia el total dentro del cobro', () => {
    cart.addProduct({ name: 'P-1', precio: 10, tax_value: 0 });
    component.paymentRows = [{ method: 'Efectivo', amount: 0 }];
    component.abrirModalPago();
    expect(component.paymentRows[0].amount).toBe(10);
    cart.setDiscountPercentage(cart.cart[0], 50);
    component.onCartChanged();
    expect(component.paymentRows[0].amount).toBe(5);
    expect(component.paymentRemaining).toBe(0);
  });

  it('no toca los montos cuando hay varias formas de pago', () => {
    cart.addProduct({ name: 'P-1', precio: 10, tax_value: 0 });
    component.abrirModalPago();
    component.paymentRows = [{ method: 'Efectivo', amount: 4 }, { method: 'Tarjeta', amount: 6 }];
    cart.setDiscountPercentage(cart.cart[0], 50);
    component.onCartChanged();
    expect(component.paymentRows.map(row => row.amount)).toEqual([4, 6]);
  });

  it('Escape cierra la cartera, que ahora tiene acceso desde la barra del POS', () => {
    component.openReceivables();
    expect(component.showReceivablesModal).toBeTrue();
    component.handleKeyboardShortcut(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(component.showReceivablesModal).toBeFalse();
  });

  it('muestra el ambiente de producción en verde solo cuando corresponde', () => {
    component.ambiente = 'Pruebas';
    expect(component.isProductionEnvironment).toBeFalse();
    component.ambiente = 'Produccion';
    expect(component.isProductionEnvironment).toBeTrue();
  });
});

describe('POS — componentes de interfaz', () => {
  it('la tarjeta emite el producto al tocarla y el favorito no lo agrega', () => {
    TestBed.configureTestingModule({ imports: [PosProductCardComponent] });
    const fixture: ComponentFixture<PosProductCardComponent> = TestBed.createComponent(PosProductCardComponent);
    const product = { name: 'P-1', nombre: 'Camisa', precio: 10, maneja_stock: 1, stock_actual: 0 };
    fixture.componentRef.setInput('product', product);
    fixture.componentRef.setInput('canAdd', false);
    const picked: any[] = [];
    const favorites: any[] = [];
    fixture.componentInstance.pick.subscribe((value: any) => picked.push(value));
    fixture.componentInstance.toggleFavorite.subscribe((value: any) => favorites.push(value));
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('AGOTADO');
    (element.querySelector('[role="button"]') as HTMLElement).click();
    expect(picked).toEqual([product]);
    const star = element.querySelector('button[aria-label="Agregar a favoritos"]') as HTMLButtonElement;
    expect(star.disabled).toBeTrue();
  });

  it('el panel de venta es compacto: cantidades sí, descuentos no', () => {
    TestBed.configureTestingModule({ imports: [PosCartLinesComponent] });
    TestBed.inject(FaIconLibrary).addIcons(faMinus, faPlus, faTimes);
    const cart = TestBed.inject(CartService);
    cart.clear();
    cart.addProduct({ name: 'P-1', nombre: 'Camisa', precio: 10, tax_value: 0 });
    const fixture = TestBed.createComponent(PosCartLinesComponent);
    fixture.componentRef.setInput('variant', 'panel');
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('button[aria-label="Sumar uno"]')).not.toBeNull();
    expect(element.querySelector('input[aria-label^="Descuento"]')).toBeNull();
    // Un descuento ya aplicado en el cobro se ve como dato, sin campos.
    cart.setDiscountAmount(cart.cart[0], 2);
    fixture.detectChanges();
    expect(element.textContent).toContain('Desc. −$2.00');
    cart.clear();
  });

  it('en el cobro cada línea tiene sus casillas de descuento directas y la cantidad es de solo lectura', () => {
    TestBed.configureTestingModule({ imports: [PosCartLinesComponent] });
    TestBed.inject(FaIconLibrary).addIcons(faMinus, faPlus, faTimes);
    const cart = TestBed.inject(CartService);
    cart.clear();
    cart.addProduct({ name: 'P-1', nombre: 'Camisa', precio: 10, tax_value: 0 });
    const fixture = TestBed.createComponent(PosCartLinesComponent);
    fixture.componentRef.setInput('variant', 'checkout');
    let changes = 0;
    fixture.componentInstance.changed.subscribe(() => changes++);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('button[aria-label="Sumar uno"]')).toBeNull();
    expect(element.querySelector('button[role="radio"]')).toBeNull();
    expect(element.querySelector('input[aria-label="Descuento en porcentaje de Camisa"]')).not.toBeNull();
    expect(element.querySelector('input[aria-label="Descuento en dólares de Camisa"]')).not.toBeNull();

    // % y $ se combinan como antes: 10 % de 10 = 1, más 2 fijos = 3.
    fixture.componentInstance.applyPercent(cart.cart[0], 10);
    fixture.componentInstance.applyAmount(cart.cart[0], 2);
    fixture.detectChanges();
    expect(cart.cart[0].discount_total).toBe(3);
    expect(cart.cart[0].total).toBe(7);
    expect(element.textContent).toContain('ahorra $3.00');
    expect(changes).toBe(2);
    cart.clear();
  });
});
