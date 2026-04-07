export type SupplierIdentificationType =
  | '04 - RUC'
  | '05 - Cedula'
  | '06 - Pasaporte'
  | '07 - Identificacion del exterior';

export interface Supplier {
  name: string;
  nombre: string;
  nombre_comercial?: string;
  contacto_principal?: string;
  telefono?: string;
  direccion?: string;
  tipo_identificacion?: SupplierIdentificationType | string;
  num_identificacion: string;
  correo?: string;
  website?: string;
  plazo_credito_dias?: number;
  notas?: string;
  isactive?: number | boolean;
  creation?: string;
  modified?: string;
}

export interface SupplierQueryParams {
  isactive?: number;
  search?: string;
}

export interface CreateProveedorPayload {
  nombre: string;
  nombre_comercial?: string;
  contacto_principal?: string;
  telefono?: string;
  direccion?: string;
  tipo_identificacion?: SupplierIdentificationType | string;
  num_identificacion: string;
  correo?: string;
  website?: string;
  plazo_credito_dias?: number;
  notas?: string;
  isactive?: number | boolean;
}

export interface UpdateProveedorPayload extends Partial<CreateProveedorPayload> {
  name: string;
}
