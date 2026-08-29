import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class FrappeErrorService {

  handle(error: any): string {

    if (!error) return 'Error inesperado';

    const planMessage = this.extractPlanErrorMessage(error);
    if (planMessage) return planMessage;

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
  // 🔥 Errores del sistema de planes
  // =============================================
  private extractPlanErrorMessage(error: any): string | null {
    const candidates = [
      error?.plan_error,
      error?.error?.plan_error,
      error?.error?.message?.plan_error,
      error?.message?.plan_error
    ];

    for (const candidate of candidates) {
      const message = this.readPlanError(candidate);
      if (message) return message;
    }

    const raw = JSON.stringify(error || {});
    const planCodes = [
      'PLAN_REQUIRED',
      'PLAN_INACTIVE',
      'PLAN_MODE_NOT_ALLOWED',
      'PLAN_FEATURE_NOT_ALLOWED',
      'PLAN_VOUCHERS_EXHAUSTED'
    ];

    const found = planCodes.find((code) => raw.includes(code));
    if (!found) return null;

    const fallback: Record<string, string> = {
      PLAN_REQUIRED: 'La empresa no tiene un plan asignado.',
      PLAN_INACTIVE: 'El plan de la empresa no está activo.',
      PLAN_MODE_NOT_ALLOWED: 'El plan actual no permite este modo de operación.',
      PLAN_FEATURE_NOT_ALLOWED: 'El plan actual no permite usar esta función.',
      PLAN_VOUCHERS_EXHAUSTED: 'No quedan comprobantes disponibles en el plan actual.'
    };

    return fallback[found];
  }

  private readPlanError(value: any): string | null {
    try {
      if (!value) return null;

      if (typeof value === 'string') {
        const decoded = decodeURIComponent(value);
        try {
          return this.readPlanError(JSON.parse(decoded));
        } catch {
          return this.cleanHtml(decoded);
        }
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          const message = this.readPlanError(item);
          if (message) return message;
        }
        return null;
      }

      if (typeof value === 'object') {
        if (value.plan_error) return this.readPlanError(value.plan_error);
        if (value.message && typeof value.message === 'string') return this.cleanHtml(value.message);
        if (value.message) return this.readPlanError(value.message);
      }
    } catch { }

    return null;
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
