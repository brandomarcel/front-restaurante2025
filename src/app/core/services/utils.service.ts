import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class UtilsService {

  constructor() { }

  public getFechaEcuador(): string | Date {

    const date = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' })
    );
    const fechaFormateada = date.toLocaleDateString('en-CA'); // Formato ISO: yyyy-mm-dd
    // const fechaFinal = fechaFormateada.replace(/-/g, '/'); // Cambiar - por / si lo prefieres
    return fechaFormateada

  }
}
