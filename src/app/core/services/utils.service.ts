import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UtilsService {

  constructor() { }

public getFechaHoraEcuador(): string {
  const date = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' })
  );

  const pad = (n: number) => n.toString().padStart(2, '0');

  const fechaHora = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
                    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

  return fechaHora;
}



  public getSoloFechaEcuador(): string | Date {

    const date = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Guayaquil' })
    );
    const fechaFormateada = date.toLocaleDateString('en-CA'); // Formato ISO: yyyy-mm-dd
    // const fechaFinal = fechaFormateada.replace(/-/g, '/'); // Cambiar - por / si lo prefieres
    return fechaFormateada

  }








  private ambienteSubject = new BehaviorSubject<string>('');

  // Observable que pueden usar los componentes
  ambiente$ = this.ambienteSubject.asObservable();

  // Función para cambiar el ambiente
  cambiarAmbiente(nuevoAmbiente: string) {
    this.ambienteSubject.next(nuevoAmbiente);
  }

  // Opcional: obtener el valor actual
  getAmbienteActual(): string {
    return this.ambienteSubject.value;
  }



  
}
