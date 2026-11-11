import { Page } from '@playwright/test';

export const BUSINESS = 'BUS-WITHHOLDING-TEST';
export const KEY = '1'.repeat(49);
export const supplier = { name: 'FLSUP-TEST', supplier_name: 'Proveedor ficticio', identification_type: '04',
  identification: '1790012345001', email: 'proveedor@example.com', related_party: false, is_active: true };
export const individualSupplier = { ...supplier, identification_type: '05', identification: '1710034065' };
export const establishment = { name: 'EST-TEST', business: BUSINESS, establishment_name: 'Matriz ficticia', status: 'Activo', is_main: 1 };
export const point = { name: 'POINT-TEST', business: BUSINESS, establishment: establishment.name,
  emission_point_name: 'Punto ficticio', status: 'Activo', is_default: 1 };
const sequence = { name: 'SEQ-TEST', business: BUSINESS, establishment: establishment.name,
  emission_point: point.name, document_type: 'Comprobante de Retencion', environment: 'Pruebas', status: 'Activo' };
const settlementSequence = { ...sequence, name: 'SEQ-03-TEST', document_type: 'Liquidacion de Compra' };
const business = { name: BUSINESS, business_name: 'Empresa ficticia', environment: 'Pruebas', tax_id: '1790012345001' };
const setup = {
  withholding_agent: true, block_message: null,
  support_codes: [{ code: '01', label: 'Crédito tributario' }, { code: '02', label: 'Costo sin crédito tributario' }],
  document_types: [{ code: '01', label: 'Factura' }, { code: '03', label: 'Liquidación de compra' }],
  tax_codes: [{ code: '4', label: 'IVA 15 %', rate: 15 }, { code: '0', label: 'IVA 0 %', rate: 0 }], vat_withholding_rates: [10, 20, 30, 50, 70, 100],
  payment_methods: [{ code: '20', label: 'Transferencia' }, { code: '01', label: 'Efectivo' }],
  income_concepts: [{ code: '312', form_103: '312', label: 'Compra de bienes', percentage: 2, variable: false },
    { code: '332', form_103: '332', label: 'Otras compras sin retención', percentage: 0, variable: false },
    { code: '311', form_103: '311', label: 'Liquidaciones de compra', percentage: 3, variable: false }],
};

export async function isolate(page: Page, dark: boolean, options: {
  agent?: boolean; processing?: boolean; draftZero?: boolean;
  settlement?: boolean; vat?: number; blockedAnnulment?: boolean; draftRuc?: boolean;
} = {}) {
  const calls: { method: string; url: URL; body: any }[] = [];
  const errors: string[] = [];
  const authorized = !options.processing;
  const document: any = {
    name: 'FLRET-TEST', business: BUSINESS, establishment: establishment.name, emission_point: point.name,
    document_type: 'Comprobante de Retencion', environment: 'Pruebas', version: '2.0.0',
    posting_date: '2026-11-10', periodo_fiscal: '11/2026', status: options.draftZero ? 'Borrador' : authorized ? 'Autorizada' : 'Emitida',
    supplier, support: { cod_sustento: '01', cod_doc_sustento: '01', num_doc_sustento: '001-001-000000123',
      fecha_emision_doc_sustento: '2026-11-10', num_aut_doc_sustento: KEY, forma_pago: '20',
      total_sin_impuestos: 100, total_iva: 15, importe_total: 115, taxes: [] },
    retentions: [{ tax_type: 'Renta', codigo: '1', codigo_retencion: options.draftZero ? '332' : '312',
      base_imponible: 100, porcentaje: options.draftZero ? 0 : 2, valor_retenido: options.draftZero ? 0 : 2 }],
    total_renta: options.draftZero ? 0 : 2, total_iva_retenido: 0, total_retenido: options.draftZero ? 0 : 2, late: false, days_since_support: 0,
    additional_fields: [], email: { status: 'No enviado' },
    sri_annulment: { available: authorized, allowed: true, block_reason: null },
    electronic: options.draftZero ? { provider_status: 'UNKNOWN' } : { access_key: '2'.repeat(49), document_number: '001-001-000000001',
      provider_status: authorized ? 'AUTHORIZED' : 'PROCESSING', code: authorized ? 'SRI_AUTHORIZED' : '70',
      authorization_status: authorized ? 'AUTORIZADO' : 'PENDIENTE', reception_confirmed: !authorized,
      authorization_number: authorized ? '2'.repeat(49) : null,
      authorization_datetime: authorized ? '2026-11-10 12:00:00' : null },
  };
  const vat = options.vat ?? 15;
  const currentSupplier = options.settlement && !options.draftRuc ? individualSupplier : supplier;
  const settlement: any = {
    name: 'FLLIQ-TEST', business: BUSINESS, establishment: establishment.name, emission_point: point.name,
    document_type: 'Liquidacion de Compra', environment: 'Pruebas', version: '1.1.0',
    posting_date: '2026-11-11', status: options.draftRuc ? 'Borrador' : 'Autorizada', supplier: currentSupplier,
    forma_pago: '20', forma_pago_label: 'Transferencia',
    items: [{ descripcion: 'Café ficticio', codigo: 'CAFE-TEST', unidad_medida: 'kg', cantidad: 2,
      precio_unitario: 50, descuento: 10, tax_code: vat ? '4' : '0', tax_label: `IVA ${vat} %`, tarifa: vat,
      subtotal: 90, iva: 90 * vat / 100, total: 90 * (1 + vat / 100) }],
    taxes: [{ tax_code: vat ? '4' : '0', label: `IVA ${vat} %`, tarifa: vat, base_imponible: 90, valor: 90 * vat / 100 }],
    total_sin_impuestos: 90, total_descuento: 10, total_iva: 90 * vat / 100, importe_total: 90 * (1 + vat / 100),
    electronic: options.draftRuc ? {} : { access_key: '3'.repeat(49), document_number: '001-001-000000002',
      provider_status: 'AUTHORIZED', code: 'SRI_AUTHORIZED', authorization_status: 'AUTORIZADO',
      authorization_number: '3'.repeat(49), authorization_datetime: '2026-11-11 12:00:00' },
    withholding: null, additional_fields: [], email: { status: 'No enviado' },
    sri_annulment: { available: !options.blockedAnnulment, allowed: true,
      block_reason: options.blockedAnnulment ? 'La liquidación tiene una retención vigente. Anule primero la retención.' : null },
  };
  const capabilities = { loaded: true, features: { billing: true, direct_invoice: true, credit_note: true },
    plan: { plan_name: 'Plan ficticio', status: 'ACTIVO', active: true, unlimited_documents: true },
    business, activeBusiness: business, businesses: [business], roles: ['ADMINISTRADOR'], businessRole: 'Administrador',
    permissions: ['*'], certificateStatus: 'VALIDO', liteSetupReady: true, liteSetupMissing: [],
    establishments: [establishment], emissionPoints: [point], sequences: [sequence, settlementSequence],
    uiCapabilities: { modules: { withholdings: { visible: options.agent !== false, can_create: true, can_manage: true },
      purchase_settlements: { visible: true, can_create: true, can_manage: true } } } };
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ capabilities, dark }) => {
    localStorage.clear();
    localStorage.setItem('company_capabilities', JSON.stringify(capabilities));
    localStorage.setItem('active_business', capabilities.business.name);
    localStorage.setItem('businessId', capabilities.business.name);
    localStorage.setItem('access_token', 'mock-session');
    localStorage.setItem('user', JSON.stringify({ email: 'usuario@example.com', fullName: 'Usuario ficticio', roles: ['ADMINISTRADOR'], businessId: capabilities.business.name }));
    localStorage.setItem('theme', JSON.stringify({ mode: dark ? 'dark' : 'light', color: 'facturada', direction: 'ltr' }));
    localStorage.setItem('theme_palette', 'facturada');
  }, { capabilities, dark });
  // WebSockets must not bypass HTTP interception and reach a live backend.
  await page.routeWebSocket('**/*', socket => socket.close());
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.pathname.includes('/socket.io/')) return route.abort();
    if (!url.pathname.startsWith('/api/'))
      return url.origin === 'http://127.0.0.1:4230' ? route.continue() : route.abort();
    const headers = { 'access-control-allow-origin': 'http://127.0.0.1:4230', 'access-control-allow-credentials': 'true',
      'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    const method = url.pathname.split('.').pop();
    const body = request.postData() ? request.postDataJSON() : null;
    calls.push({ method: request.method(), url, body });
    let message: any = { data: [] };
    if (method === 'get_logged_user') message = 'usuario@example.com';
    if (method === 'get_lite_setup') message = { data: { business, ready: true, missing: [],
      tax_profile: { environment: 'Pruebas', withholding_agent: options.agent !== false,
        certificate_status: 'VALIDO', has_certificate_password: true },
      establishments: [establishment], emission_points: [point], sequences: [sequence, settlementSequence] } };
    if (method === 'get_withholding_setup') message = { data: { ...setup, withholding_agent: options.agent !== false } };
    if (method === 'get_purchase_settlement_setup') message = { data: { ...setup,
      identification_types: [{ code: '05', label: 'Cédula' }, { code: '06', label: 'Pasaporte' }, { code: '08', label: 'Exterior' }] } };
    if (method === 'get_businesses') message = { data: [business] };
    if (method === 'get_lite_suppliers') message = { data: [currentSupplier], total: 1 };
    if (method === 'lookup_lite_access_key') message = { data: { valid: true, test_environment: true,
      document_type: '01', number: '001-001-000000123', issue_date: '2026-11-10', ruc: supplier.identification, supplier: null } };
    if (method === 'save_lite_supplier') message = { data: currentSupplier };
    if (method === 'create_and_emit_lite_withholding') message = { data: document,
      emission: { ok: true, status: authorized ? 'AUTHORIZED' : 'PROCESSING', code: authorized ? 'SRI_AUTHORIZED' : '70', messages: [] } };
    if (method === 'get_lite_withholding_detail' || method === 'refresh_lite_withholding_status') message = { data: document,
      emission: { ok: true, status: authorized ? 'AUTHORIZED' : 'PROCESSING', code: authorized ? 'SRI_AUTHORIZED' : '70' } };
    if (method === 'get_all_withholdings') message = { data: [document], total: 1, limit: 10, offset: 0, has_next: false,
      status_counts: { ALL: 1, Autorizada: authorized ? 1 : 0, EN_PROCESO: authorized ? 0 : 1, CON_ERROR: 0, Anulada: 0 } };
    if (method === 'get_lite_purchase_settlement_detail') message = { data: settlement };
    if (method === 'get_all_purchase_settlements') message = { data: [settlement], total: 1, limit: 10, offset: 0,
      has_next: false, status_counts: { ALL: 1, Autorizada: 1, EN_PROCESO: 0, CON_ERROR: 0, Anulada: 0 } };
    if (method === 'create_and_emit_lite_purchase_settlement') message = { data: settlement,
      emission: { ok: true, status: 'AUTHORIZED', code: 'SRI_AUTHORIZED', messages: [] } };
    if (method === 'register_lite_purchase_settlement_sri_annulment' || method === 'register_lite_withholding_sri_annulment') {
      const target = method === 'register_lite_purchase_settlement_sri_annulment' ? settlement : document;
      Object.assign(target, { status: 'Anulada', sri_annulment_date: body.sri_annulment_date,
        annulment_reason: body.reason, annulled_at: '2026-11-11 12:30:00', annulled_by: 'usuario@example.com',
        annulled_by_name: 'Usuario ficticio' });
      message = { data: target };
    }
    return route.fulfill({ headers, contentType: 'application/json', body: JSON.stringify({ message }) });
  });
  return { calls, errors };
}

