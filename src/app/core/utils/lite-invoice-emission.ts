/** Normalized states exposed by the FacturADA Lite emission API. */
export type LiteEmissionState =
  | 'AUTHORIZED'
  | 'PROCESSING'
  | 'REJECTED'
  | 'PROVIDER_ERROR'
  | 'ERROR';

export interface LiteEmissionResult {
  emission: any;
  data: any;
  state: LiteEmissionState;
  messages: string[];
  invoiceName: string;
  accessKey: string;
  authorizationNumber: string;
  authorizationDatetime: string;
  [key: string]: any;
}

/** Frappe wraps successful responses in a single `message` property. */
export function frappeBody(response: any): any {
  return response?.message ?? response ?? {};
}

function normalized(value: any): string {
  return String(value ?? '').trim().toUpperCase();
}

const PROVIDER_ERROR_CODES = new Set([
  'PROVIDER_CONNECTION',
  'PROVIDER_TIMEOUT',
  'PROVIDER_HTTP_ERROR',
  'PROVIDER_EXCEPTION',
  'SRI_CONNECTION_RESET',
  'SRI_TIMEOUT',
  'SRI_CONNECTION_REFUSED',
  'SRI_PIPE',
  'SRI_TLS_ERROR',
  'SRI_CONNECTION_ERROR'
]);

export function liteEmissionState(emission: any): LiteEmissionState {
  const code = normalized(emission?.code);
  const sriCode = normalized(emission?.sri_code ?? emission?.sri_status_code ?? emission?.status_code);
  const status = normalized(emission?.status);
  const providerStatus = normalized(emission?.provider_status);
  const emissionMessage = normalized(emission?.message ?? emission?.sri_message);

  // El backend puede devolver el estado documental sin `ok` (por ejemplo en
  // `message.data.status`). Estos valores son autoritativos y deben
  // conservarse aunque la respuesta no incluya un código de emisión.
  if (status === 'AUTHORIZED' || status === 'AUTORIZADO' || status === 'AUTORIZADA' || status === 'SRI_AUTHORIZED' || providerStatus === 'AUTHORIZED') {
    return 'AUTHORIZED';
  }
  if (sriCode === '70' || code === '70' || sriCode === '43' || code === '43' || emissionMessage.includes('CLAVE ACCESO REGISTRADA') || status === 'PROCESSING' || status === 'PENDING' || status === 'PENDIENTE EMISION' || status === 'PENDIENTE EMISIÓN' ||
      status === 'EN COLA' || status === 'QUEUED' || (status === 'EMITIDA' && ['PROCESSING', 'RECEIVED', 'PENDING'].includes(providerStatus))) {
    return 'PROCESSING';
  }
  if (status === 'REJECTED' || status === 'RECHAZADO' || status === 'RECHAZADA' || status === 'NOT_AUTHORIZED' || status === 'SRI_REJECTED') {
    return 'REJECTED';
  }
  if (status === 'ERROR' || status === 'ERROR DE ENVIO' || status === 'ERROR DE ENVÍO') {
    return PROVIDER_ERROR_CODES.has(code) ? 'PROVIDER_ERROR' : 'ERROR';
  }

  // A response with ok=true and status ERROR is explicitly invalid.
  if (status === 'ERROR' || emission?.ok === false) {
    if (PROVIDER_ERROR_CODES.has(code)) return 'PROVIDER_ERROR';
    if (code === 'SRI_REJECTED' || status === 'NOT_AUTHORIZED') return 'REJECTED';
    return 'ERROR';
  }
  if (emission?.ok === true && (code === 'SRI_AUTHORIZED' || status === 'AUTORIZADO' || status === 'AUTORIZADA' || providerStatus === 'AUTHORIZED')) return 'AUTHORIZED';
  if (emission?.ok === true && (code === 'SRI_RECEIVED' || status === 'PROCESSING' || providerStatus === 'PROCESSING' || providerStatus === 'RECEIVED' || providerStatus === 'PENDING')) return 'PROCESSING';
  if (PROVIDER_ERROR_CODES.has(code)) return 'PROVIDER_ERROR';
  if (code === 'SRI_REJECTED' || status === 'NOT_AUTHORIZED') return 'REJECTED';
  return emission?.ok === true ? 'PROCESSING' : 'ERROR';
}

export function liteEmissionMessages(emission: any): string[] {
  const rawValues = [
    emission?.messages,
    emission?.message,
    emission?.sri_message,
    emission?.emission_error,
    emission?.electronic?.sri_message,
    emission?.electronic?.emission_error,
    emission?.sri?.sri_message,
    emission?.sri?.messages
  ].filter((value) => value !== undefined && value !== null && value !== '');
  const values = rawValues.flatMap((raw: any) => Array.isArray(raw) ? raw : [raw]);
  return Array.from(new Set(values
    .map((value: any) => {
      if (typeof value === 'string') return value.replace(/<[^>]+>/g, '').trim();
      if (value && typeof value === 'object') {
        return String(value.message ?? value.text ?? value.detail ?? '').replace(/<[^>]+>/g, '').trim();
      }
      return String(value ?? '').trim();
    })
    .filter(Boolean)));
}

/** Keeps `emission` and `data` together; do not unwrap twice. */
export function normalizeLiteEmissionResponse(response: any): LiteEmissionResult {
  const body = frappeBody(response);
  const bodyData = body?.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data : null;
  const rootData = response?.data && typeof response.data === 'object' && !Array.isArray(response.data) ? response.data : null;
  const explicitEmission = body?.emission && typeof body.emission === 'object'
    ? body.emission
    : bodyData?.emission && typeof bodyData.emission === 'object'
      ? bodyData.emission
      : rootData?.emission && typeof rootData.emission === 'object'
        ? rootData.emission
        : null;
  const data = bodyData ?? rootData ?? null;
  // Unificamos los campos de estado para respuestas como `message.data` o
  // `data`, sin perder el objeto original que consume la UI.
  const emission = {
    ...(explicitEmission ?? {}),
    status: explicitEmission?.status ?? data?.status ?? body?.status ?? response?.status,
    provider_status: explicitEmission?.provider_status ?? data?.provider_status ?? body?.provider_status ?? response?.provider_status ?? data?.electronic?.provider_status,
    code: explicitEmission?.code ?? data?.code ?? body?.code,
    sri_code: explicitEmission?.sri_code ?? data?.sri_code ?? body?.sri_code ?? data?.electronic?.sri_code,
    status_code: explicitEmission?.status_code ?? data?.status_code ?? body?.status_code,
    ok: explicitEmission?.ok ?? data?.ok ?? body?.ok
  };
  const state = liteEmissionState(emission);
  const messages = Array.from(new Set([
    ...liteEmissionMessages(emission),
    ...liteEmissionMessages(data),
    ...liteEmissionMessages(body)
  ]));
  const invoiceName = String(
    (typeof data === 'string' ? data : undefined) ?? data?.invoice_name ?? data?.name ?? data?.invoice?.name ??
    body?.invoice_name ?? body?.invoice ?? body?.name ?? emission?.invoice_name ?? ''
  ).trim();
  const accessKey = String(
    emission?.access_key ?? emission?.accessKey ?? data?.access_key ?? data?.accessKey ?? data?.clave_acceso ?? body?.access_key ?? ''
  ).trim();
  const authorizationNumber = String(emission?.authorization_number ?? emission?.authorizationNumber ?? data?.authorization_number ?? '').trim();
  const authorizationDatetime = String(emission?.authorization_datetime ?? emission?.authorizationDatetime ?? data?.authorization_datetime ?? '').trim();

  return {
    ...body,
    emission: { ...emission, ok: state === 'AUTHORIZED' || state === 'PROCESSING' },
    data,
    state,
    messages,
    invoiceName,
    accessKey,
    authorizationNumber,
    authorizationDatetime
  };
}
