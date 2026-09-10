export const environment = {
  apiUrl: 'https://facturada.bmarc-corp.com/api',
  URL: 'https://facturada.bmarc-corp.com',
  // Nginx debe publicar /socket.io y reenviarlo al Socket.IO local (:9000),
  // conservando este site como namespace/host lógico de Frappe.
  frappeSiteNamespace: 'facturada_core_simple_test',
  production: true,
};
