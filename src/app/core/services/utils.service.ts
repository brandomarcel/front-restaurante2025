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








  /**
   * Ambiente tributario compartido por toda la aplicación.
   *
   * El backend Lite lo entrega como `tax_profile.environment` (por ejemplo,
   * "Pruebas"), mientras que las vistas históricas comparan contra
   * `PRUEBAS`/`PRODUCCION`. Normalizamos en un único punto para evitar que
   * cada pantalla tenga que conocer ambos formatos.
   */
  private ambienteSubject = new BehaviorSubject<string>(
    this.normalizarAmbiente(this.readStoredAmbiente())
  );

  // Observable que pueden usar los componentes
  ambiente$ = this.ambienteSubject.asObservable();

  // Función para cambiar el ambiente
  cambiarAmbiente(nuevoAmbiente: unknown) {
    const ambiente = this.normalizarAmbiente(nuevoAmbiente);
    this.ambienteSubject.next(ambiente);
    if (ambiente) {
      localStorage.setItem('ambiente', ambiente);
    }
  }

  // Opcional: obtener el valor actual
  getAmbienteActual(): string {
    return this.ambienteSubject.value;
  }

  private readStoredAmbiente(): string {
    try {
      return localStorage.getItem('ambiente') || '';
    } catch {
      return '';
    }
  }

  private normalizarAmbiente(value: unknown): string {
    const normalized = String(value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase();

    if (!normalized) return '';
    if (normalized === 'PRODUCCION' || normalized.includes('PROD')) return 'PRODUCCION';
    if (normalized === 'PRUEBAS' || normalized === 'TEST' || normalized.includes('PRUEB')) return 'PRUEBAS';
    return normalized;
  }



  
}
