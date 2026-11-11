/**
 * Datos de cada tipo de comprobante electrónico que comparten el panel de estado SRI, las actualizaciones en tiempo
 * real y la revisión manual. Agregar un comprobante nuevo = una entrada aquí, no más condiciones en los componentes.
 */
export type ElectronicDocumentKind = 'invoice' | 'credit-note' | 'guide' | 'withholding' | 'purchase-settlement';

export interface ElectronicDocumentKindConfig {
  /** DocType de Frappe (eventos de Socket.IO). */
  doctype: string;
  /** Método de `facturada_lite.api.frontend` que devuelve el detalle (`name`, `business`). */
  detailMethod: string;
  /** Método de revisión manual y nombre del parámetro con el documento. */
  reviewMethod: string;
  reviewNameParam: string;
  /**
   * Facturas y notas de crédito: verificación de inexistencia en el SRI, regeneración con el mismo secuencial,
   * factura reemplazante y ventana de revisión manual por fecha. Guías, retenciones y liquidaciones de compra no tienen
   * nada de eso.
   */
  invoiceLike: boolean;
  /** Ruta del detalle de la factura reemplazante (solo `invoiceLike`). */
  replacementRoute: string | null;
}

export const ELECTRONIC_DOCUMENT_KINDS: Record<ElectronicDocumentKind, ElectronicDocumentKindConfig> = {
  invoice: {
    doctype: 'FacturADA Lite Invoice',
    detailMethod: 'get_lite_invoice_detail',
    reviewMethod: 'confirm_lite_invoice_electronic_review',
    reviewNameParam: 'invoice_name',
    invoiceLike: true,
    replacementRoute: '/dashboard/invoices'
  },
  // La nota de crédito es una FacturADA Lite Invoice: mismo DocType y mismos métodos.
  'credit-note': {
    doctype: 'FacturADA Lite Invoice',
    detailMethod: 'get_lite_invoice_detail',
    reviewMethod: 'confirm_lite_invoice_electronic_review',
    reviewNameParam: 'invoice_name',
    invoiceLike: true,
    replacementRoute: '/dashboard/credit-note'
  },
  guide: {
    doctype: 'FacturADA Lite Remission Guide',
    detailMethod: 'get_lite_remission_guide_detail',
    reviewMethod: 'confirm_lite_remission_guide_electronic_review',
    reviewNameParam: 'guide_name',
    invoiceLike: false,
    replacementRoute: null
  },
  withholding: {
    doctype: 'FacturADA Lite Withholding',
    detailMethod: 'get_lite_withholding_detail',
    reviewMethod: 'confirm_lite_withholding_electronic_review',
    reviewNameParam: 'withholding_name',
    invoiceLike: false,
    replacementRoute: null
  },
  'purchase-settlement': {
    doctype: 'FacturADA Lite Purchase Settlement',
    detailMethod: 'get_lite_purchase_settlement_detail',
    reviewMethod: 'confirm_lite_purchase_settlement_electronic_review',
    reviewNameParam: 'settlement_name',
    invoiceLike: false,
    replacementRoute: null
  }
};

/** Acepta el booleano antiguo (`true` = guía, `false` = factura) para no romper llamadas existentes. */
export function electronicDocumentKind(value: ElectronicDocumentKind | boolean): ElectronicDocumentKind {
  if (value === true) return 'guide';
  if (value === false) return 'invoice';
  return value;
}

export function electronicDocumentKindConfig(value: ElectronicDocumentKind | boolean): ElectronicDocumentKindConfig {
  return ELECTRONIC_DOCUMENT_KINDS[electronicDocumentKind(value)];
}
