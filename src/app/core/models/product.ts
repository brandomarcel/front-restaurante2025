export interface Product {
  name: string;
  nombre: string;
  precio: number;
  categoria: string;
  codigo: string;
  descripcion: string;
  imagen?: string;
  tax?: string;
  isactive: number;
  is_out_of_stock: number;
  company_id: string;
  tax_id?: string;
  tax_value?: number;
}
