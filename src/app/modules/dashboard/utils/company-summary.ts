import { frappeData } from 'src/app/core/utils/frappe-response';
import { CompanySummary, SignatureStatus } from '../dashboard.models';
import { daysUntil, isRecord, normalizeText, toBoolean } from './dashboard-values';

const UNUSABLE_CERTIFICATE_STATUSES = ['NO CONFIGURADO', 'NO VIGENTE', 'ERROR DE LECTURA'];

/**
 * Lee nombre, ambiente y certificado desde `facturada_lite.api.setup.get_lite_setup`.
 * Es la única fuente con la firma: `get_user_context` no incluye el certificado.
 */
export function parseCompanySummary(response: unknown): CompanySummary | null {
  const data = frappeData<any>(response);
  if (!isRecord(data)) return null;
  const business: Record<string, any> = isRecord(data['business']) ? data['business'] : data;
  const tax: Record<string, any> = isRecord(data['tax_profile'])
    ? data['tax_profile']
    : (isRecord(business['tax_profile']) ? business['tax_profile'] : {});

  const certificateReference = `${tax['certificate_reference'] ?? business['certificate_reference'] ?? ''}`.trim();
  const hasPassword = tax['has_certificate_password'];
  const configured = hasPassword !== undefined && hasPassword !== null ? toBoolean(hasPassword) : !!certificateReference;
  const status = normalizeText(tax['certificate_status'] ?? business['certificate_status']);

  return {
    name: String(
      business['business_name'] || business['businessname'] || business['trade_name']
      || business['legal_name'] || business['name'] || ''
    ),
    environment: String(tax['environment'] || tax['ambiente'] || business['environment'] || business['ambiente'] || ''),
    certificateMissing: !configured || UNUSABLE_CERTIFICATE_STATUSES.includes(status),
    certificateExpired: status === 'VENCIDO',
    certificateValidTo: String(tax['certificate_valid_to'] || business['cert_not_after'] || '')
  };
}

/** Estado de la firma electrónica para la cabecera, avisos y acciones sugeridas. */
export function signatureStatus(company: CompanySummary | null, today: Date = new Date()): SignatureStatus {
  if (company?.certificateMissing) {
    return { label: 'Sin firma', tone: 'danger', missing: true, expired: false, daysLeft: null };
  }
  const daysLeft = company ? daysUntil(company.certificateValidTo, today) : null;
  if (company?.certificateExpired || (daysLeft !== null && daysLeft <= 0)) {
    return { label: 'Vencida', tone: 'danger', missing: false, expired: true, daysLeft };
  }
  if (daysLeft === null) {
    return { label: 'Pendiente de validar', tone: 'warning', missing: false, expired: false, daysLeft };
  }
  if (daysLeft <= 30) {
    return { label: `Vence en ${daysLeft} días`, tone: 'warning', missing: false, expired: false, daysLeft };
  }
  return { label: 'Al día', tone: 'success', missing: false, expired: false, daysLeft };
}
