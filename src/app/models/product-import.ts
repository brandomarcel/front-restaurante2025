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
  initial_stock?: number;
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
