import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FrappeErrorService {

  handle(error: any) {

    const serverMessage = this.extractServerMessage(error?.error?._server_messages);
    if (serverMessage) {
      console.log('serverMessage',serverMessage);
      return (serverMessage);
    }

    if (error?.error?.exception) {
      return this.extractExceptionMessage(error.error);
    }

    if (error instanceof HttpErrorResponse) {
      return (error.message || 'Error del servidor');
    }

    return 'Error inesperado';
  }

  private extractServerMessage(_server_messages: any): string | null {
    try {
      const decoded = typeof _server_messages === 'string'
        ? decodeURIComponent(_server_messages)
        : _server_messages;

      const msgs = JSON.parse(decoded);
      if (Array.isArray(msgs) && msgs.length) {
        // concatena todos por si vienen varios
        const texts = msgs.map(m => {
          const obj = JSON.parse(m);
          const raw = obj.message || obj;
          // quitar tags simples
          return String(raw).replace(/<[^>]+>/g, '').trim();
        }).filter(Boolean);

        if (texts.length) return texts.join(' | ');
      }
    } catch (_) {
      console.warn('No se pudo parsear _server_messages');
    }
    return null;
  }


  private extractExceptionMessage(exc: any): string {
    const raw = (exc.message || '').toLowerCase();
    if (raw.includes('duplicate')) return 'Este registro ya existe.';
    if (raw.includes('not permitted')) return 'No tienes permisos para esta acción.';
    if (raw.includes('not found')) return 'No se encontró el registro.';
    if (raw.includes('validation')) return 'Error de validación. Por favor, revisa los datos ingresados.';
    if (raw.includes('forbidden')) return 'Acción prohibida.';
    if (raw.includes('internal server error')) return 'Error interno del servidor.';
    if (raw.includes('bad request')) return 'Solicitud incorrecta. Por favor, revisa los datos ingresados.';
    if (raw.includes('unauthorized')) return 'No autorizado. Por favor, inicia sesión nuevamente.';
    if (raw.includes('not allowed')) return 'Operación no permitida.';
    if (raw.includes('timeout')) return 'La solicitud ha expirado. Por favor, inténtalo de nuevo más tarde.';
    if (raw.includes('conflict')) return 'Conflicto de datos. Por favor, revisa los datos ingresados.';
    if (raw.includes('service unavailable')) return 'Servicio no disponible. Por favor, inténtalo de nuevo más tarde.';
    if (raw.includes('gateway timeout')) return 'Tiempo de espera agotado. Por favor, inténtalo de nuevo más tarde.';
    if (raw.includes('not implemented')) return 'Funcionalidad no implementada. Por favor, contacta al administrador.';
    if (raw.includes('unprocessable entity')) return 'Entidad no procesable. Por favor, revisa los datos ingresados.';
    if (raw.includes('method not allowed')) return 'Método no permitido. Por favor, revisa la solicitud.';
    if (raw.includes('service unavailable')) return 'Servicio no disponible. Por favor, inténtalo de nuevo más tarde.';
    if (raw.includes('request entity too large')) return 'La entidad de la solicitud es demasiado grande. Por favor, reduce el tamaño y vuelve a intentarlo.';
    if (raw.includes('unsupported media type')) return 'Tipo de medio no soportado. Por favor, revisa el formato de los datos enviados.';
    if (raw.includes('invalid token')) return 'Token inválido. Por favor, inicia sesión nuevamente.';
    if (raw.includes('invalid login')) return 'Credenciales inválidas. Por favor, verifica tu usuario y contraseña.';
    if (raw.includes('invalid credentials')) return 'Credenciales inválidas. Por favor, verifica tu usuario y contraseña.';
    return exc.message || 'Ocurrió un error en Frappe.';
  }
}
