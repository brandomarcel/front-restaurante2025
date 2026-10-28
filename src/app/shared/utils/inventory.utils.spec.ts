import { canUseInventoryQuantity, isLowStockProduct, isOutOfStockProduct, recipePortions, resolveInventoryLabel } from './inventory.utils';

describe('Disponibilidad de platos por porciones de receta', () => {
  const dish = (portions: any) => ({ has_recipe: true, portions_available: portions, track_stock: 0 } as any);

  it('lee porciones numéricas y no inventa disponibilidad cuando falta el dato', () => {
    expect(recipePortions(dish('3'))).toBe(3);
    expect(recipePortions(dish(undefined))).toBeNull();
    expect(recipePortions(dish('invalid'))).toBeNull();
    expect(recipePortions({ has_recipe: false, portions_available: 3 } as any)).toBeNull();
  });

  it('cero porciones significa agotado, sin marcarlo también como bajo', () => {
    expect(isOutOfStockProduct(dish(0))).toBeTrue();
    expect(isLowStockProduct(dish(0))).toBeFalse();
  });

  it('marca bajo entre una y cinco porciones', () => {
    expect(isLowStockProduct(dish(1))).toBeTrue();
    expect(isLowStockProduct(dish(5))).toBeTrue();
    expect(isLowStockProduct(dish(6))).toBeFalse();
  });

  it('limita la cantidad incluso cuando el plato no tiene stock propio', () => {
    expect(canUseInventoryQuantity(dish(2), 2)).toBeTrue();
    expect(canUseInventoryQuantity(dish(2), 3)).toBeFalse();
  });

  it('presenta singular/plural de porciones', () => {
    expect(resolveInventoryLabel(dish(1))).toBe('1 porción');
    expect(resolveInventoryLabel(dish(2))).toBe('2 porciones');
  });

  it('el agrupador de variantes conserva su contrato y no usa stock propio', () => {
    const grouped = { ...dish(0), variant_count: 2, has_stock: true };
    expect(isOutOfStockProduct(grouped)).toBeFalse();
    expect(canUseInventoryQuantity(grouped, 10)).toBeTrue();
    expect(resolveInventoryLabel(grouped)).toBe('2 variantes');
  });
});
