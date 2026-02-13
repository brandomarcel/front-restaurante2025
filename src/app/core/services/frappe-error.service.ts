import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class FrappeErrorService {

  handle(error: any): string {

    if (!error) return 'Error inesperado';

    // 🔹 1. Frappe _server_messages (prioridad máxima)
    const serverMessage = this.extractServerMessage(error?.error?._server_messages);
    if (serverMessage) return serverMessage;

    // 🔹 2. Frappe _error_message (muy común en throw)
    if (error?.error?._error_message) {
      return this.cleanHtml(error.error._error_message);
    }

    // 🔹 3. Exception estructurada de Frappe
    if (error?.error?.exception) {
      return this.extractExceptionMessage(error.error);
    }

    // 🔹 4. HttpErrorResponse estándar
    if (error instanceof HttpErrorResponse) {
      return error.error?.message || error.message || 'Error del servidor';
    }

    return 'Error inesperado';
  }

  // =============================================
  // 🔥 Parse real de _server_messages (Frappe)
  // =============================================
  private extractServerMessage(_server_messages: any): string | null {
    try {
      if (!_server_messages) return null;

      let decoded = _server_messages;

      // A veces viene como string JSON stringificado 2 veces
      if (typeof decoded === 'string') {
        decoded = decodeURIComponent(decoded);
        decoded = JSON.parse(decoded);
      }

      if (!Array.isArray(decoded)) return null;

      const messages = decoded
        .map((m: any) => {
          const obj = typeof m === 'string' ? JSON.parse(m) : m;
          return this.cleanHtml(obj.message || obj);
        })
        .filter(Boolean);

      return messages.length ? messages.join(' | ') : null;

    } catch {
      console.warn('No se pudo parsear _server_messages');
      return null;
    }
  }

  // =============================================
  // 🔥 Limpia HTML de Frappe
  // =============================================
  private cleanHtml(text: string): string {
    return String(text || '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // =============================================
  // 🔥 Traducción inteligente de excepciones
  // =============================================
  private extractExceptionMessage(exc: any): string {
    const raw = (exc?.message || '').toLowerCase();

    const map: Record<string, string> = {
      'duplicate': 'Este registro ya existe.',
      'not permitted': 'No tienes permisos para esta acción.',
      'permission': 'No tienes permisos para esta acción.',
      'not found': 'No se encontró el registro.',
      'validation': 'Error de validación. Revisa los datos ingresados.',
      'forbidden': 'Acción prohibida.',
      'internal server error': 'Error interno del servidor.',
      'bad request': 'Solicitud incorrecta.',
      'unauthorized': 'No autorizado. Inicia sesión nuevamente.',
      'not allowed': 'Operación no permitida.',
      'timeout': 'La solicitud ha expirado.',
      'conflict': 'Conflicto de datos.',
      'service unavailable': 'Servicio no disponible.',
      'gateway timeout': 'Tiempo de espera agotado.',
      'not implemented': 'Funcionalidad no implementada.',
      'unprocessable entity': 'Entidad no procesable.',
      'method not allowed': 'Método no permitido.',
      'request entity too large': 'Archivo demasiado grande.',
      'unsupported media type': 'Formato no soportado.',
      'invalid token': 'Sesión inválida. Inicia sesión nuevamente.',
      'invalid login': 'Credenciales inválidas.',
      'invalid credentials': 'Credenciales inválidas.'
    };

    for (const key of Object.keys(map)) {
      if (raw.includes(key)) {
        return map[key];
      }
    }

    return exc?.message || 'Ocurrió un error en el servidor.';
  }
}
