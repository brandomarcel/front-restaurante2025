export interface ProductAttributeValue {
  attribute: string;
  value: string;
}

export interface Product {
  name: string;
  nombre: string;
  precio: number;
  /** 1 cuando el registro es una variante concreta; 0/undefined en el producto agrupador o en un producto simple sin variantes. */
  is_variant?: number | boolean;
  /** `name` del producto principal cuando este registro es una variante. */
  variant_of?: string | null;
  /** Cantidad de variantes activas de este producto (0 en un producto simple o en una variante). */
  variant_count?: number;
  /** Solo relevante cuando `variant_count > 0`: true si alguna variante activa está disponible para vender. `null` cuando no aplica (producto sin variantes). */
  has_stock?: boolean | null;
  /** `item_name` del producto principal. Solo viene cuando este registro es una variante devuelta con `flatten_variants=1`. */
  variant_of_name?: string;
  /** Combinación de atributos (Color, Talla, etc.) que identifica a la variante. */
  attributes?: ProductAttributeValue[];
  standard_rate?: number;
  rate?: number;
  categoria: string;
  category?: string;
  codigo: string;
  item_code?: string;
  item_name?: string;
  tipo?: string;
  unidad?: string;
  descripcion: string;
  imagen?: string;
  image?: string;
  image_url?: string;
  tax?: string;
  isactive: number | boolean;
  is_out_of_stock: number | boolean;
  company_id: string;
  tax_id?: string;
  tax_value?: number;
  iva?: number;
  tax_rate?: number;
  controlar_inventario?: number | boolean;
  maneja_stock?: number | boolean;
  manage_stock?: number | boolean;
  manages_stock?: number | boolean;
  unidad_inventario?: string;
  stock_actual?: number;
  current_stock?: number;
  track_stock?: boolean | number;
  minimum_stock?: number;
  is_low_stock?: boolean | number;
  stock?: number;
  stock_minimo?: number;
  permitir_stock_negativo?: number | boolean;
  ultima_actualizacion_stock?: string;
  stock_inicial?: number;
  stock_ajuste?: number;
}
