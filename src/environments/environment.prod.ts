// Un solo build para todos los dominios: el sitio compartido
// (facturada.bmarc-corp.com/portal) y el dominio propio de cada cliente con
// contabilidad. Por eso las direcciones son relativas: la app habla siempre con
// el mismo dominio desde el que se abrió, y Nginx de ese dominio publica /api,
// /files y /socket.io hacia su sitio Frappe.
export const environment = {
  apiUrl: '/api',
  URL: '',
  // Respaldo para Socket.IO mientras llega `site` de get_user_context (que es lo
  // que manda). Es el sitio compartido.
  frappeSiteNamespace: 'facturada_main',
  production: true,
};
