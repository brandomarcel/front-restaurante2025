export interface Supplier {
  name: string;
  codigo: string;
  razon_social: string;
  nombre_comercial: string;
  tipo_identificacion: string;
  num_identificacion: string;
  contacto_principal: string;
  correo: string;
  telefono: string;
  direccion: string;
  dias_credito: number;
  observacion: string;
  isactive: boolean;
}

export type SupplierPayload = Partial<Supplier>;
