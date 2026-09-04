import { Product } from 'src/app/core/models/product';

export type InventoryMovementType =
  | 'Entrada'
  | 'Salida'
  | 'Ajuste'
  | 'Venta'
  | 'Reversa Venta'
  | 'Consumo'
  | 'Devolucion';

export interface InventoryProduct extends Product {
  stock_actual?: number;
  stock_minimo?: number;
  unidad_inventario?: string;
  controlar_inventario?: number | boolean;
  permitir_stock_negativo?: number | boolean;
  ultima_actualizacion_stock?: string;
}

export interface InventoryMovementItem {
  product?: string;
  product_name?: string;
  quantity?: number;
  stock_before?: number;
  stock_after?: number;
}

export interface InventoryMovement {
  name?: string;
  creation?: string;
  posting_date?: string;
  movement_type?: InventoryMovementType | string;
  notes?: string;
  reference_doctype?: string;
  reference_name?: string;
  reference?: string;
  business?: string;
  item?: string;
  quantity?: number;
  stock_before?: number;
  stock_after?: number;
  total_items?: number;
  total_quantity?: number;
  items?: InventoryMovementItem[];
}

export interface InventoryMovementPayload {
  movement_type: InventoryMovementType;
  notes?: string;
  reference_doctype?: string;
  reference_name?: string;
  items: Array<{
    product: string;
    quantity: number;
  }>;
}

export interface InventorySummary {
  controlled_products?: number;
  tracked_items?: number;
  low_stock_products?: number;
  low_stock_items?: number;
  out_of_stock_products?: number;
  out_of_stock_items?: number | InventoryProduct[];
  products?: InventoryProduct[];
  items?: InventoryProduct[];
}

export interface LiteStockMovementPayload {
  business?: string;
  item: string;
  movement_type: 'Entrada' | 'Salida' | 'Ajuste';
  quantity?: number;
  target_stock?: number;
  notes?: string;
}
