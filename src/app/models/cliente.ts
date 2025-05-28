export interface Cliente {
  id: string;                 // mapear de "name"
  fullName: string;          // de "nombre"
  identification: string;    // de "num_identificacion"
  phone: string;             // de "telefono"
  email: string;             // de "correo"
  address: string;           // de "direccion"
  identificationType: string; // de "tipo_identificacion"
  isActive: boolean;         // de "isactive"
}
