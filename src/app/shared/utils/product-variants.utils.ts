import { Product, ProductAttributeValue } from 'src/app/core/models/product';
import { toInventoryBool } from './inventory.utils';

/** Definición de un atributo (p. ej. Color) con los valores disponibles, en el orden en que aparecen entre las variantes activas. */
export interface VariantAttributeDefinition {
  attribute: string;
  values: string[];
}

function normalizeAttributes(product: Partial<Product> | null | undefined): ProductAttributeValue[] {
  const raw = product?.attributes;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      attribute: String(item?.attribute ?? '').trim(),
      value: String(item?.value ?? '').trim()
    }))
    .filter((item) => !!item.attribute && !!item.value);
}

/** Una variante inactiva nunca debe ofrecerse para la venta ni para editar como base de otra. */
export function isVariantActive(variant: Partial<Product> | null | undefined): boolean {
  if (!variant) return false;
  const status = String((variant as any)?.status || '').trim().toLowerCase();
  if (status) return status === 'activo';
  return toInventoryBool(variant.isactive ?? true);
}

/**
 * Recolecta los atributos disponibles (Color, Talla, ...) y sus valores únicos
 * a partir de las variantes activas, preservando el orden de aparición para
 * que el selector siempre muestre primero el mismo atributo (p. ej. Color).
 */
export function getVariantAttributeDefinitions(variants: Product[]): VariantAttributeDefinition[] {
  const definitions: VariantAttributeDefinition[] = [];
  for (const variant of variants) {
    if (!isVariantActive(variant)) continue;
    for (const { attribute, value } of normalizeAttributes(variant)) {
      let definition = definitions.find((d) => d.attribute === attribute);
      if (!definition) {
        definition = { attribute, values: [] };
        definitions.push(definition);
      }
      if (!definition.values.includes(value)) definition.values.push(value);
    }
  }
  return definitions;
}

/** Busca la variante activa cuya combinación de atributos coincide exactamente con la selección. */
export function findMatchingVariant(variants: Product[], selection: Record<string, string>): Product | null {
  const selectionEntries = Object.entries(selection).filter(([, value]) => !!value);
  if (!selectionEntries.length) return null;

  return variants.find((variant) => {
    if (!isVariantActive(variant)) return false;
    const attrs = normalizeAttributes(variant);
    if (attrs.length !== selectionEntries.length) return false;
    return selectionEntries.every(([attribute, value]) =>
      attrs.some((attr) => attr.attribute === attribute && attr.value === value)
    );
  }) || null;
}

/** true cuando la selección actual cubre todos los atributos disponibles. */
export function isSelectionComplete(definitions: VariantAttributeDefinition[], selection: Record<string, string>): boolean {
  return definitions.length > 0 && definitions.every((definition) => !!selection[definition.attribute]);
}

/** Nombre completo para mostrar en el POS, p. ej. "Jean clásico - Azul - Talla 32". */
export function buildVariantDisplayName(parent: Partial<Product> | null | undefined, variant: Partial<Product> | null | undefined): string {
  const baseName = String(parent?.nombre ?? parent?.item_name ?? '').trim();
  const attrs = normalizeAttributes(variant);
  const suffix = attrs.map((attr) => attr.value).join(' - ');
  if (!baseName) return String(variant?.nombre ?? '').trim();
  return suffix ? `${baseName} - ${suffix}` : baseName;
}

/** Etiqueta corta de atributos para tablas/listas, p. ej. "Color: Azul · Talla: 32". */
export function formatVariantAttributes(variant: Partial<Product> | null | undefined): string {
  const attrs = normalizeAttributes(variant);
  if (!attrs.length) return '—';
  return attrs.map((attr) => `${attr.attribute}: ${attr.value}`).join(' · ');
}
