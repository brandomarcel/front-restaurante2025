import { FormBuilder } from '@angular/forms';
import { convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { InventoryComponent } from './inventory.component';

describe('Inventario: abrir el movimiento de un producto que viene de su ficha', () => {
  let component: InventoryComponent;
  let router: any;
  let alerts: any;
  const controlled = { name: 'A', nombre: 'Arroz', maneja_stock: 1, stock_actual: 50, stock_minimo: 5 };
  const notControlled = { name: 'N', nombre: 'Servicio', maneja_stock: 0 };

  function build(adjust: string, catalog: any[]) {
    const capabilities = { isLiteMode: false, isEnabled: () => true, hasPermission: () => true, isWarehouseMode: false, activeWarehouses: [], warehouses: [] };
    const route = { queryParamMap: of(convertToParamMap(adjust ? { adjust } : {})) };
    const productsService = { getAll: () => of({ message: { data: catalog } }) };
    router = { navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
    alerts = { error: jasmine.createSpy('error') };
    const destroyRef = { onDestroy: () => () => undefined };
    component = new InventoryComponent({} as any, productsService as any, new FormBuilder(), {} as any, {} as any, alerts,
      capabilities as any, route as any, router, destroyRef as any);
    component.initMovementForm();
  }

  it('abre el movimiento con el producto ya elegido y limpia la URL', () => {
    build('A', [controlled]);
    component.cargarOpcionesProducto();
    expect(component.showMovementModal).toBeTrue();
    expect(component.movementItems.at(0).value.product).toBe('A');
    expect(router.navigate).toHaveBeenCalledWith([], jasmine.objectContaining({ queryParams: { adjust: null }, replaceUrl: true }));
  });

  it('no vuelve a abrirlo al recargar las opciones', () => {
    build('A', [controlled]);
    component.cargarOpcionesProducto();
    component.cerrarMovimientoModal();
    component.cargarOpcionesProducto();
    expect(component.showMovementModal).toBeFalse();
  });

  it('si el producto no controla inventario, avisa y no abre nada', () => {
    build('N', [controlled, notControlled]);
    component.cargarOpcionesProducto();
    expect(component.showMovementModal).toBeFalse();
    expect(alerts.error).toHaveBeenCalled();
  });

  it('sin parámetro no abre ningún movimiento', () => {
    build('', [controlled]);
    component.cargarOpcionesProducto();
    expect(component.showMovementModal).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
