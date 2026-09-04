/**
 * Desenvuelve respuestas estándar de Frappe.
 *
 * Frappe puede responder directamente en `message` o envolver el resultado
 * en `message.data`. Los componentes no deberían conocer esa diferencia.
 */
export function frappeData<T = any>(response: any): T {
  const body = response?.message ?? response;
  if (body && typeof body === 'object' && !Array.isArray(body) && 'data' in body) {
    return body.data as T;
  }
  return body as T;
}

export function frappeList<T = any>(response: any): T[] {
  const data = frappeData<any>(response);
  return Array.isArray(data) ? data as T[] : [];
}
