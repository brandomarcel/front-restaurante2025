export type ProductImportMode = 'create_only' | 'upsert';

export interface ProductImportRow {
  row_number: number;
  code: string;
  name: string;
  /** Columna `codigo_barras` de la plantilla. Opcional. */
  barcode?: string;
  codigo_barras?: string;
  /** Solo viene en algunas plantillas; se leen alias por si el backend cambia el nombre. */
  type?: string;
  category?: string;
  price?: number;
  track_stock?: boolean;
  stock_initial?: number;
  /** Columna `stock_minimo`: solo tiene sentido en variantes (o productos sin variantes). */
  minimum_stock?: number;
  stock_minimo?: number;
  /**
   * Columna `atributos` (ej. "Color=Negro"): lo que distingue a una variante
   * de otra. El backend puede devolverlo como texto plano o ya parseado en
   * un arreglo de `{attribute, value}`; por eso el tipo queda abierto.
   */
  attributes?: string | Array<{ attribute?: string; atributo?: string; name?: string; value?: string; valor?: string }>;
  atributos?: string | Array<{ attribute?: string; atributo?: string; name?: string; value?: string; valor?: string }>;
  is_variant: boolean;
  parent_code?: string;
  status?: string;
  errors: string[];
}

export interface ProductImportSummary {
  total: number;
  valid: number;
  invalid: number;
}

export interface ProductImportPreview {
  business: string;
  mode: ProductImportMode;
  rows: ProductImportRow[];
  summary: ProductImportSummary;
  can_confirm: boolean;
}

export interface ProductImportConfirmResult {
  business: string;
  mode: ProductImportMode;
  created: number;
  updated: number;
  stock_movements: number;
  total: number;
}
