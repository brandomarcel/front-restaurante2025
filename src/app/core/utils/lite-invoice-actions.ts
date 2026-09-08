export type LiteInvoiceAction = 'consult' | 'retry' | 'none';

function normalized(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

/**
 * Decide la única acción segura para un comprobante Lite ya creado.
 * Los códigos 43 y 70 significan que se debe consultar al SRI: jamás emitir
 * otra vez el mismo documento mientras está en procesamiento.
 */
export function getLiteInvoiceAction(invoice: any): LiteInvoiceAction {
  const sri = invoice?.sri && typeof invoice.sri === 'object' ? invoice.sri : {};
  const electronic = invoice?.electronic && typeof invoice.electronic === 'object' ? invoice.electronic : {};
  const emission = invoice?.emission && typeof invoice.emission === 'object' ? invoice.emission : {};

  const status = normalized(invoice?.status ?? invoice?.einvoice_status ?? sri?.status);
  const provider = normalized(sri?.provider_status ?? electronic?.provider_status ?? invoice?.provider_status ?? emission?.provider_status);
  const emissionStatus = normalized(emission?.status);
  const code = [
    sri?.sri_code, sri?.status_code, sri?.code,
    electronic?.sri_code, electronic?.status_code, electronic?.code,
    invoice?.sri_code, invoice?.sri_status_code, invoice?.status_code, invoice?.provider_status_code,
    emission?.sri_code, emission?.sri_status_code, emission?.status_code, emission?.code
  ].map(normalized).find(Boolean) || '';
  const messages = [
    sri?.sri_message, sri?.message, electronic?.sri_message,
    invoice?.sri_message, invoice?.emission_error, emission?.sri_message,
    emission?.message, emission?.messages
  ].flatMap((value: any) => Array.isArray(value) ? value : [value])
    .map(normalized)
    .join(' | ');

  const authorized = ['AUTORIZADO', 'AUTORIZADA', 'AUTHORIZED', 'SRI_AUTHORIZED'].includes(status)
    || provider === 'AUTHORIZED'
    || emissionStatus === 'AUTHORIZED';
  const blocked = ['BORRADOR', 'DRAFT', 'REEMPLAZADA', 'REPLACED'].includes(status);
  const processing = code === '43'
    || code === '70'
    || messages.includes('CLAVE ACCESO REGISTRADA')
    || ['PROCESSING', 'RECEIVED', 'PENDING'].includes(provider)
    || ['PROCESSING', 'PENDING'].includes(emissionStatus)
    || ['PROCESSING', 'EMITIDA'].includes(status);

  if (authorized || blocked) return 'none';
  if (processing) return 'consult';

  const retryableStatus = [
    'ERROR DE ENVIO', 'RECHAZADA', 'RECHAZADO', 'REJECTED',
    'NOT_AUTHORIZED', 'PENDIENTE EMISION'
  ].includes(status);
  // En una respuesta de acción puede llegar primero emission.status; se usa
  // solo como complemento si aún no se actualizó status del documento.
  const retryableEmission = !status && ['ERROR', 'REJECTED', 'NOT_AUTHORIZED'].includes(emissionStatus);
  return retryableStatus || retryableEmission ? 'retry' : 'none';
}

export function canConsultLiteInvoice(invoice: any): boolean {
  return getLiteInvoiceAction(invoice) === 'consult';
}

export function canRetryLiteInvoice(invoice: any): boolean {
  return getLiteInvoiceAction(invoice) === 'retry';
}
