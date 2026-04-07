export interface Product {
  name: string;
  nombre: string;
  precio: number;
  categoria: string;
  codigo: string;
  descripcion: string;
  imagen?: string;
  tax?: string;
  isactive: number | boolean;
  is_out_of_stock: number | boolean;
  company_id: string;
  tax_id?: string;
  tax_value?: number;
  controlar_inventario?: number | boolean;
  unidad_inventario?: string;
  stock_actual?: number;
  stock_minimo?: number;
  permitir_stock_negativo?: number | boolean;
  ultima_actualizacion_stock?: string;
  stock_inicial?: number;
  stock_ajuste?: number;
}
