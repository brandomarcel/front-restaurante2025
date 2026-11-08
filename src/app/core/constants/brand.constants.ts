/**
 * Datos comerciales de FacturADA / BMARC-CORP que se muestran fuera del panel (carta digital pública).
 * Contacto comercial solo por WhatsApp (decisión de marca, ver PROPUESTA_MARCA_WEB.md del sitio).
 */
export const BRAND = {
  product: 'FacturADA',
  company: 'BMARC-CORP',
  siteUrl: 'https://bmarc-corp.com/',
  /** Código de país sin «+». */
  whatsapp: '593998885652',
} as const;

/** Enlace de WhatsApp con el mensaje ya escrito. */
export function brandWhatsappUrl(message: string): string {
  return `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(message)}`;
}
