# Contrato de estados electronicos para el frontend

Implementa este contrato para facturas, notas de credito y guias de remision.
Conserva los valores enviados por el backend; usa las etiquetas siguientes para
presentarlos al usuario. No cambies estados fiscales desde el formulario.

## Estado general del documento

| Valor de `status` | Etiqueta visible | Significado |
| --- | --- | --- |
| `Borrador` | Borrador | Documento guardado, sin emision completada. |
| `Pendiente Emision` | Pendiente de emision | Falta completar la emision o su configuracion. |
| `Emitida` | Autorizacion pendiente | En procesamiento; no confirma autorizacion ni recepcion directa. |
| `Autorizada` | Autorizada | Autorizacion SRI confirmada. |
| `Rechazada` | Rechazada | Revisar las fases para distinguir devuelta de no autorizada. |
| `Error de Envio` | Error de envio | Estado compatible con registros anteriores; la entrega puede ser incierta. |
| `En Revision` | En revision | Resultado incierto; consultar y revisar. |
| `Reemplazada` | Reemplazada | Factura original sustituida; abrir el documento relacionado. |
| `Anulada` | Anulada | Documento marcado como anulado en el sistema. |

Facturas y notas de credito usan todos estos valores. Las guias actualmente usan
los primeros siete: no presentar Reemplazada ni Anulada como acciones de guias.
No confundir `status` con `docstatus`: un documento puede tener `docstatus=0` y
estar autorizado fiscalmente. Tampoco confundirlo con `collection_status`, que
describe el saldo y los abonos.

## Fases SRI

En el detalle, leer `documento.electronic`:

| Campo | Valores exactos | Etiquetas |
| --- | --- | --- |
| `reception_status` | `NOT_SENT`, `RECIBIDA`, `DEVUELTA`, `UNKNOWN` | Sin envio, Recibida, Devuelta, Recepcion incierta |
| `authorization_status` | `NOT_REQUESTED`, `PENDIENTE`, `AUTORIZADO`, `NO_AUTORIZADO`, `UNKNOWN` | Sin consulta, Pendiente, Autorizada, No autorizada, Autorizacion incierta |

- Si `status=Rechazada` y `authorization_status=NO_AUTORIZADO`, mostrar No autorizada.
- Si `status=Rechazada` y `reception_status=DEVUELTA`, mostrar Devuelta.
- `RECIBIDA` no es autorizacion. Mostrar por separado las dos fases.
- `reception_confirmed` puede llegar como 0/1 o booleano. Normalizar con
  `value === true || value === 1 || value === '1'`.
- Nunca inferir RECIBIDA solamente por `code=SRI_RECEIVED`, por HTTP exitoso
  o por `ok=true`. Los contratos anteriores podian devolver pendientes inciertos.
- Para registros historicos con fases vacias, mostrar No informado. No inventar
  una confirmacion de recepcion o autorizacion.

Los campos de compatibilidad siguen disponibles: `provider_status`,
`authorization_number`, `authorization_datetime`, `sri_message`, `emission_error`.
Tambien se incluyen `access_key`, `idempotency_key` (facturas), `code`, `trace_id`,
`payload_hash`, `fecha_ultima_consulta`, `messages`, `manual_review_required`,
`manual_reviewed_by` y `manual_reviewed_at`. `messages` del detalle es texto;
`emission.messages` es una lista. Mostrar todos los mensajes sin XML ni Base64.

`provider_status` es el estado normalizado del proveedor, no el estado general:
AUTHORIZED, PROCESSING, NOT_AUTHORIZED, REJECTED, UNKNOWN, ERROR u otro estado
informativo heredado. La respuesta `emission.status` mantiene compatibilidad:
NO_AUTORIZADO se presenta como REJECTED y UNKNOWN como ERROR. Para distinguir
las fases usar siempre reception_status y authorization_status.

## APIs para la aplicacion web

Todas las acciones siguientes usan POST y autenticacion de usuario Frappe.
Se requiere permiso `billing.manage`; el servidor confirma la autorizacion.
El resultado de consultar o reintentar contiene:
`response.message.data` (documento guardado) y `response.message.emission`.
Reemplazar el estado local con el documento devuelto y refrescar detalle/listado.

Facturas y notas de credito, cuerpo `{ "invoice_name": "FLINV-..." }`:

- Consultar: `/api/method/facturada_lite.api.frontend.refresh_lite_invoice_status`
- Reintentar: `/api/method/facturada_lite.api.frontend.retry_lite_invoice`

Guias, cuerpo `{ "guide_name": "FLRG-..." }` (usar el nombre real devuelto):

- Consultar: `/api/method/facturada_lite.api.frontend.refresh_lite_remission_guide_status`
- Reintentar: `/api/method/facturada_lite.api.frontend.retry_lite_remission_guide`

Consultar sincroniza y guarda el resultado. No emite un nuevo comprobante.
Los documentos ya autorizados con numero y fecha completos se responden desde
la base local. Si falta informacion de autorizacion, el backend puede consultar
para completar ese registro historico.

## Acciones visibles

- Autorizada: detalle, impresion, XML disponible y envio segun permisos y archivo
  autorizado. Ocultar reintento y regeneracion. Separar errores de correo del
  estado fiscal. Una falta de XML o de envio de correo no desautoriza la factura.
- Emitida, En Revision o error de comunicacion con clave: mostrar Consultar
  autorizacion. Conservar la clave y el documento. No reintentar automaticamente.
- Pendiente Emision, Rechazada o Error de Envio: el reintento es una accion manual
  sujeta al backend. Si hay recepcion/autorizacion incierta, consulta obligatoria;
  si `manual_review_required=true`, revisar primero. Una nueva fecha puede crear
  una factura de reemplazo en el flujo existente de retry; seguir el `name`
  devuelto, sin asumir que sera el original.
- Reemplazada o Anulada: presentar historial; no proponer emision del original.
- El backend programa consultas automaticas para PENDIENTE y UNKNOWN con clave.
  El scheduler despacha trabajos vencidos cada minuto; los intervalos entre
  consultas son aproximadamente 1, 3, 5 y luego 15 minutos, sujetos al worker.
  No iniciar otro ciclo de consultas SRI desde el frontend. Actualizar el detalle
  al recibir eventos o mediante una lectura del documento local.
- En `documento.electronic` se agregan `automatic_query_active` (booleano),
  `next_status_check_at`, `status_check_attempts` y `status_check_error`.
  Los listados de facturas exponen esos campos en cada fila.
  Mostrar "Consulta automatica programada" y la proxima fecha cuando este activa.
  Los estados definitivos, anulados, reemplazados y revisados como inexistentes
  no siguen consultandose automaticamente.
- El limite por defecto es 30 minutos desde `pending_since`. Se configura en
  el sitio con `facturada_sri_poll_review_after_minutes`. Al vencer, se activa
  `manual_review_required`, se borra la proxima consulta y se notifica revision.
- Eventos: `facturada_electronic_status_updated` y
  `facturada_electronic_review_required`, publicados despues de confirmar la
  transaccion en la sala del documento (`doctype`, `docname`). Suscribirse a esa
  sala con el cliente Frappe autorizado y releer el detalle al recibirlos.
  Los eventos incluyen nombre, negocio y tipo; no incluyen XML ni certificados.
- Si ya hay una consulta en curso, el backend responde un error controlado.
  Evitar doble clic, esperar y refrescar. Una consulta manual repetida dentro
  de 10 segundos puede reutilizar el ultimo resultado guardado.
- La factura numerada descuenta inventario antes de llamar al SRI, tanto desde
  POS como desde facturacion directa o API externa. Un borrador no descuenta.
  Un error, rechazo o espera del SRI no repone prendas ya vendidas. Consultar,
  reintentar o regenerar conserva el movimiento existente sin duplicarlo.
- Al autorizar, el flujo automatico guarda XML, cuota y correo, y verifica
  inventario de forma idempotente para documentos historicos, como
  el manual. Si falla el inventario, la autorizacion se conserva y se muestra
  una observacion en `status_check_error` para revisar el movimiento pendiente.

## Excepcion manual: factura antigua inexistente en SRI

La original con `status=Reemplazada` o `regenerated_invoice` queda cerrada,
incluso si conserva un estado electronico antiguo pendiente. Ocultar consultar,
reintentar, regenerar y revision de emision; mostrar "Abrir factura reemplazante"
cuando exista el enlace. La consulta de estado devuelve informacion local con
`emission.code=DOCUMENT_CLOSED`, sin llamar al proveedor ni mover inventario.
Los trabajos automaticos tambien excluyen la original. `status` sigue siendo
de solo lectura para usuarios normales: lo determina el backend. Excepcionalmente
el usuario especial Frappe `Administrator` puede corregirlo en Desk. No confundir
con el rol Administrador del negocio. El cambio manual no consulta SRI, no emite,
no mueve inventario ni crea autorizacion o XML; es una correccion administrativa.

Solo facturas/notas de credito. No implementar regeneracion masiva o automatica.
Permitir Registrar verificacion SRI en Emitida, En Revision, Error de Envio o
Pendiente Emision, con clave y sin estado SRI definitivo ni reemplazo existente.
El usuario debe consultar manualmente por clave en el ambiente correcto y
confirmar que no existe el comprobante. La falta de respuesta por si sola no
prueba que no exista.

1. POST `/api/method/facturada_lite.api.frontend.confirm_lite_invoice_electronic_review`
   con `invoice_name`, `review_reason` obligatorio y `verified_no_sri_record: 1`.
   Guardar/refrescar el documento devuelto. La revision registra usuario y fecha.
2. Cuando haya revision y `regeneration_reason`, sin revision pendiente ni estado
   SRI definitivo, presentar Regenerar mismo secuencial con confirmacion explicita.
3. POST `/api/method/facturada_lite.api.frontend.regenerate_lite_invoice_same_sequence`
   con `invoice_name`. El backend bloquea documentos de hoy, autorizados, devueltos,
   no autorizados, ya reemplazados, sin revision o con conflicto de secuencial.
4. Abrir el nuevo `response.message.data.name`. Conserva secuencial y ambiente,
   cambia fecha/clave y deja el original Reemplazada. Mantiene los abonos vinculados
   y evita repetir movimientos de inventario existentes.

La confirmacion ordinaria de revision de errores usa el mismo endpoint sin
`verified_no_sri_record`. No habilita por si sola regeneracion. Las guias usan
`confirm_lite_remission_guide_electronic_review` con `guide_name` para esa revision
ordinaria; no tienen este flujo de regeneracion de factura.

## API externa para integraciones de clientes

Usa las credenciales del API Client y su ambiente; no la sesion de usuario Angular.

- GET `/api/v1/facturada/invoices/{id_o_clave}/status`
- POST `/api/v1/facturada/invoices/{id_o_clave}/retry`
- GET `/api/v1/facturada/remission-guides/{id_o_clave}/status`
- POST `/api/v1/facturada/remission-guides/{id_o_clave}/retry`

Los envelopes REST y RPC son distintos: REST factura devuelve `data.invoice` y
`data.emission`; no envolver ni interpretar REST como `message`. El ambiente del
API Client limita consulta y emision. El endpoint Node `/api/v1/documents/...`
es interno del proveedor; el frontend usa las rutas FacturADA anteriores.
