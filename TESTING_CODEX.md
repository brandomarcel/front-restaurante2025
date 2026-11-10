# Guía de pruebas para Codex (front + backend FacturADA)

Instrucciones para que un agente (Codex) **cree y ejecute** pruebas del frontend Angular
y del backend Frappe de FacturADA. Léela completa antes de escribir o correr pruebas.

---

## 1. Alcance

| Capa | Ruta | Repo |
|------|------|------|
| Frontend Angular | `/home/frappe/front-restaurante2025` | este repo |
| Backend Core | `/home/frappe/frappe-bench/apps/facturada_core` | propio |
| Backend Lite | `/home/frappe/frappe-bench/apps/facturada_lite` | propio |
| Backend Restaurante | `/home/frappe/frappe-bench/apps/facturada_restaurante` | propio |
| Backend API externa | `/home/frappe/frappe-bench/apps/facturada_api` | propio |

**Fuera de alcance:** `restaurante_app` (antiguo), `gym_management`, `/home/frappe/front-gym`,
`frappe`, `erpnext`, `facturada_erpnext*`, `facturada_platform` y `wordpress-local/`.
No los modifiques ni les escribas pruebas, salvo que te lo pidan explícitamente.

Antes de tocar una app backend, lee su `AGENTS.md` y su `ESTADO.md`.

---

## 2. Reglas de seguridad (obligatorias)

1. **Sitio de pruebas único:** `facturada_core_simple_test`. Nunca ejecutes pruebas,
   `migrate` ni scripts contra otros sitios del bench (`restaurante_bmarc`, `gym_bmarc`,
   `facturada_admin`, `restaurante_erp_test`, `*.localhost`, …).
2. **Nunca llames al SRI ni al proveedor electrónico real.** Toda emisión, consulta de
   estado, firma o envío debe ir mockeada (`unittest.mock.patch`). Tampoco envíes correos reales.
3. **No hagas `git push`.** Un push a `main` del front despliega directo a producción.
   No hagas commits salvo que el usuario lo pida.
4. **No dejes datos persistentes:** usa `FrappeTestCase` (revierte la transacción) o
   `unittest.TestCase` con mocks. Usa datos ficticios (RUC `1790012345001`, correos `@example.com`).
5. **No adaptes la prueba a un bug.** Si una prueba revela un error real, repórtalo; no
   cambies la aserción para que pase.
6. Respeta los invariantes del backend: no reemitir con `PROCESSING` o con los códigos SRI 43/70,
   no repetir movimientos de stock y facturar una orden una sola vez. Las pruebas deben
   **verificar** esos invariantes, no saltárselos.

---

## 3. Preparación del entorno

### Chromium para pruebas del front (Karma y Playwright)

Chromium headless usa el binario de Playwright, que necesita `libasound.so.2`. En este
servidor la librería no está instalada en el sistema, así que se carga localmente:

```bash
export CHROME_BIN=$HOME/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome
export LD_LIBRARY_PATH=$HOME/.cache/facturada-test-libs
```

Si `~/.cache/facturada-test-libs/libasound.so.2` no existe, recréalo (no requiere root):

```bash
mkdir -p /tmp/asound && cd /tmp/asound && apt-get download libasound2 \
  && dpkg-deb -x libasound2_*.deb x \
  && mkdir -p ~/.cache/facturada-test-libs \
  && cp -a x/usr/lib/x86_64-linux-gnu/libasound.so.2* ~/.cache/facturada-test-libs/
```

### Redis para pruebas del backend

Varias suites usan cache/cola. Comprueba que Redis esté arriba antes de correrlas:

```bash
redis-cli -p 13000 ping && redis-cli -p 11000 ping   # ambos deben responder PONG
```

Si Redis no responde, no afirmes que la suite pasó: repórtalo como bloqueo de entorno.

---

## 4. Frontend: pruebas unitarias (Karma + Jasmine)

### Ejecutar

```bash
cd /home/frappe/front-restaurante2025

# Un spec o varios (rápido, úsalo mientras desarrollas)
npx ng test --watch=false --browsers=ChromeHeadless \
  --include=src/app/pages/register-company/register-company.component.spec.ts

# Suite completa
npx ng test --watch=false --browsers=ChromeHeadless
```

(Con `CHROME_BIN` y `LD_LIBRARY_PATH` exportados, ver sección 3.) No uses `npm test` a
secas: abre Chrome en modo watch y no termina.

Lint (desde 2026-11-09 funciona; `eslint.config.js`, ESLint 9 directo):

```bash
npm run lint
```

Línea base: 19 avisos heredados (18 errores, 1 advertencia). Un cambio no debe sumar avisos nuevos.

### Línea base conocida (2026-11-09)

Última ejecución completa: **543 pruebas, 523 aprobadas y 20 fallidas heredadas**.
Antes de añadir cobertura en esta sesión: 520 pruebas, 500 OK y las mismas 20
fallas. Se añadieron **23 pruebas frontend**, todas aprobadas: PrintStationService
(8), atención del dashboard (7), métricas/caja (4), decimales (2), empresa demo en
Configuración (2). Las 30 pruebas de login/tema/cocina del 08/11 siguen pasando.

Lint: **19 avisos heredados (18 errores, 1 advertencia)**, sin avisos nuevos de estos
cambios. Build optimizado OK: 2,57 MB inicial; 4 advertencias de selectores CSS.
Reporte: [PRUEBAS_CODEX_2026-11-09.md](PRUEBAS_CODEX_2026-11-09.md).
Referencia del 08/11: 531, 510 OK y 21 fallas. Se retiraron los specs no aplicables
al rediseño y NavbarMobileComponent; no se relajaron aserciones en esta sesión.

Referencia del 29/10: 504 pruebas, 479 OK y 25 fallas heredadas. Desde entonces
se retiraron tres pantallas/specs de plantilla y Sidebar ya no falla.

Referencia del 27/10: 426 pruebas, 400 aprobadas y 26 fallidas heredadas.

La referencia anterior era 368 pruebas, 342 aprobadas y 26 fallidas. Al iniciar la
validación del 26/10, el checkout tenía 321 aprobadas y 47 fallidas. Se corrigieron
fixtures desactualizados de facturación/POS y se añadieron 53 pruebas de acciones
fiscales, guard y capacidades. Resultado completo y comandos en
[PRUEBAS_CODEX_2026-10-26.md](PRUEBAS_CODEX_2026-10-26.md).

Resultado anterior (26/10): **421 pruebas, 395 aprobadas y 26 fallidas**, todas estas
ultimas pertenecen a la lista heredada siguiente. Las 53 pruebas nuevas pasan.

El 2026-11-09 se borró NavbarMobileComponent y se confirmó la línea base de 20 fallas heredadas.

Las fallas heredadas actuales corresponden a specs
de plantilla con providers ausentes o expectativas antiguas. Coinciden con las
20 de la corrida inicial y no son regresiones nuevas observadas:

`AperturaCajaComponent`, `AppComponent` (3), `CloseCajaComponent`,
`DashboardComponent`, `Error404Component`, `Error500Component`,
`LayoutComponent`, `NavbarComponent`,
`OrderCardComponent`, `OrderKitchenCardComponent`, `OrderModalComponent`,
`ProfileMenuComponent`, `RetiroCajaComponent`, `TableActionComponent`,
`TableComponent`, `TableFooterComponent`, `TableRowComponent`,
`UsersComponent`.

- Una falla **fuera** de esta lista es una regresión: investígala.
- Si modificas uno de estos componentes, arregla también su spec (agrega providers y mocks).
- Cuando la línea base cambie, actualiza esta sección.

### Cómo escribir un spec

- El archivo `*.spec.ts` va junto al componente, servicio o directiva.
- Los componentes son *standalone*: impórtalos en `imports` y agrega los providers en `providers`.
- **No hagas HTTP real.** Mockea los servicios con `jasmine.createSpyObj` y `of(...)`.
- Providers habituales:

```ts
providers: [
  provideHttpClient(),
  provideRouter([]),
  importProvidersFrom(AngularSvgIconModule.forRoot()),   // si la vista usa <svg-icon>
  { provide: MiServicio, useValue: miServicioSpy },
]
```

- Si el código navega, espía `Router.navigate` (`spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true)`).
- Prueba comportamiento, no detalles internos: validaciones, payload enviado al servicio,
  estados de UI (deshabilitado, mensajes de error), reglas de negocio visibles (estados SRI,
  acciones permitidas por rol/feature).
- Ejemplos de referencia en el repo:
  - `src/app/pages/register-company/register-company.component.spec.ts` (formulario con mocks y payload)
  - `src/app/core/directives/uppercase.directive.spec.ts` (directiva con un componente anfitrión)

### Prioridades al crear pruebas nuevas en el front

1. Lógica de estados electrónicos y acciones: `lite-invoice-emission.ts` y
   `lite-invoice-actions.ts` (la regla 43/70 solo permite consultar, nunca reemitir).
   Contrato en `frontend_electronic_states.md`.
2. `RoleAccessGuard` y `CompanyCapabilitiesService` (features, permisos y roles).
3. Formularios con validaciones tributarias (RUC, identificación, totales mostrados).
4. Servicios que transforman respuestas de Frappe (`message`, `_server_messages`).

---

## 5. Frontend: E2E (Playwright)

- Las pruebas están en `tests-e2e/` y la configuración en `playwright.config.ts` (`baseURL` `http://localhost:4200`).
- Los specs actuales (`navbar`, `sidebar`, `table`) vienen de la plantilla y **no se han
  validado** contra la app actual. Revísalos antes de tomarlos como referencia.
- `npm run test:e2e` abre la interfaz interactiva (`--ui`). En un agente usa:

```bash
npx ng serve --port 4200 &        # en otra terminal / segundo plano
npx playwright test --project=chromium --reporter=list
```

- No dependas del backend real: intercepta las llamadas con `page.route('**/api/**', ...)`
  y responde con fixtures en `tests-e2e/fixtures/`.
- Usa `data-test-id` (configurado como `testIdAttribute`) para los selectores nuevos.

---

## 6. Backend: pruebas Frappe

### Ejecutar

```bash
cd /home/frappe/frappe-bench

# Un módulo (rápido)
bench --site facturada_core_simple_test run-tests --module facturada_lite.api.test_electronic_status

# Una app completa
bench --site facturada_core_simple_test run-tests --app facturada_lite
```

Si agregas o cambias campos de un DocType, corre antes
`bench --site facturada_core_simple_test migrate`.

### Línea base backend (2026-11-09)

| App | Pruebas | Resultado |
|-----|---------|-----------|
| facturada_core | 83 | OK, 4 nuevas de demo |
| facturada_lite | 253 | OK, 2 nuevas de setup demo |
| facturada_restaurante | 74 | OK, 15 nuevas QZ/ESC-POS/equipos |
| facturada_api | 32 | OK, 2 nuevas de cliente API demo |

**442 aprobadas**, con 23 nuevas backend. Suites secuenciales en el único sitio
facturada_core_simple_test, previamente migrado; Redis disponible y HTTP/SMTP
reales bloqueados. Las claves QZ son ficticias en memoria y update_site_config
está simulado: no se generó ni cambió un certificado real. El resumen Desk de
equipos se comprueba con dos negocios y el filtro por negocio. Se repitió el
módulo de navegación Desk tras su actualización durante la sesión.

No equivale a cobertura exhaustiva de las funciones que siguen pendientes abajo.
Reporte vigente: [PRUEBAS_CODEX_2026-11-09.md](PRUEBAS_CODEX_2026-11-09.md).

Exportador de restaurante_app: excepción solicitada previamente por el usuario;
pruebas puras desde Lite sin instalar Legacy en el sitio de pruebas.
Reporte vigente: [PRUEBAS_CODEX_2026-11-08.md](PRUEBAS_CODEX_2026-11-08.md).

**Primera tarea completada:** se ejecutó `bench --site facturada_core_simple_test migrate`
y se repitieron las cuatro suites (282 pruebas aprobadas). Los errores de `credit_days`
y `Data`/`Small Text` desaparecieron al migrar. La importación fallaba por una columna
`codigo_barras` ausente en las filas del fixture Excel. El error de impresión provenía
de mocks que alteraban los globals compartidos de Jinja; ambos helpers ahora copian
ese diccionario y tienen pruebas de regresión. No se cambiaron reglas de negocio.
Las ejecuciones incluyeron un bloqueo temporal adicional de HTTP/SMTP real; ver el
reporte enlazado arriba. En futuras actualizaciones, migrar solo este sitio cuando
los metadatos estén desactualizados, antes de interpretar errores como regresiones.

### Módulos existentes

- **Core:** `facturada_core.api.test_{desk_setup,gym_permissions,submission_transport,onboarding,electronic_provider}`
  y tests de DocType (`facturada_business`, `facturada_tax_profile`, `facturada_establishment`, …).
- **Lite:** `facturada_lite.api.test_{email,frontend,invoice_api,setup,pos_sale,submission_recovery,
  invoice_credit_summary,invoice_review,electronic_response,inventory_sales,electronic_status,
  dashboard,certificate_upload}`, `facturada_lite.facturada_lite.report.test_lite_reports` y
  `facturada_lite.facturada_lite.print_format.test_print_formats`.
- **Restaurante:** `facturada_restaurante.api.test_{frontend,setup,ticket_printing,order_note_printing}`
  y `facturada_restaurante.facturada_restaurante.report.test_restaurant_reports`.
- **API:** `facturada_api.api.test_rest`.

### Cómo escribir una prueba

- El archivo se llama `test_<tema>.py`. Si prueba una API, va en `<app>/<app>/api/`; si prueba un DocType, va en su carpeta.
- Base:
  - `frappe.tests.utils.FrappeTestCase` si toca la base de datos (revierte al terminar).
  - `unittest.TestCase` + `unittest.mock.patch` para lógica pura.
- Mockea el proveedor y el SRI siguiendo el patrón de `facturada_lite/api/test_electronic_status.py`.
- Usa sangría con **tabuladores** y respeta Ruff (`pyproject.toml`: Python 3.10, 110 columnas).
- Cubre siempre:
  - **Aislamiento por negocio:** un usuario o cliente API no ve datos de otro `business`.
  - **Permisos:** prueba los roles de negocio (Administrador, Gerente, Cajero, Facturacion,
    Mesero, Cocina, Usuario) y las features. Rol y feature son ejes distintos.
  - **Estados SRI:** con `AUTHORIZED` no se vuelve a consultar al proveedor; con `PROCESSING`
    solo se consulta; con `REJECTED` no se reemite automáticamente.
  - **Stock:** sale al enviar la venta numerada y no se duplica al autorizar ni al facturar
    una orden de restaurante.
  - **Totales:** el backend recalcula; no confíes en los totales que envía el front.

---

## 7. Flujo de trabajo esperado

1. Identifica qué se cambió o se va a probar y qué capa toca (front, backend o ambas).
2. Lee `AGENTS.md` y `ESTADO.md` de la app afectada.
3. Escribe o ajusta las pruebas junto al código.
4. Corre primero las pruebas focalizadas (`--include` o `--module`) y después la suite de esa capa.
5. Si cambia un contrato front↔back, prueba **ambos** lados y actualiza el documento de
   contrato (`facturada_lite/docs/frontend_*.md` y su copia en este repo).
6. Compila el front si tocaste código Angular: `npx ng build`.

### Formato del reporte final

```
Pruebas creadas/modificadas:
- <ruta> — qué cubre

Ejecución:
- <comando exacto> → N aprobadas / M fallidas

Fallas:
- Nuevas (regresiones): ...
- Preexistentes (línea base): ...
- Bloqueos de entorno (Redis, Chromium, migrate): ...

Pendientes / riesgos:
- ...
```

Reporta los resultados tal como salieron: si algo no se ejecutó o falló, dilo.

## Pendiente de pruebas: planes por módulos (2026-10-28)

Core `api/plans.py` y `effective_features`: cada plan del catálogo (roles y features resultantes),
`apply_plan` (crea/actualiza suscripción, solo System Manager), `expand_payload` (lo explícito gana),
restaurante con `tables` y/o `kitchen` apagados. Probar en navegador un RESTO_BASICO: POS, Lista de
órdenes y cobro sin Mesas ni Cocina.

## Pendiente de pruebas: aviso de pedido nuevo a Caja (2026-10-28)

`NewOrderAlertService`: avisa solo con `billing.create` + `orders` + `restaurant.orders.read`; no avisa a
Mesero/Cocina ni por órdenes propias, canceladas o repetidas; `openComanda` bloqueado por el navegador
muestra error; botón «Imprimir comanda» en tarjeta y tabla de «Nuevas». Prueba manual con dos
sesiones (mesero crea, cajero ve y oye el aviso).
La impresión automática por kiosco ya no existe (2026-11-09): ver «impresora de comandas con QZ Tray».

## Cobertura parcial: impresora de comandas con QZ Tray (2026-11-09)

Validados: 15 pruebas backend de ESC/POS, endpoints, firma/certificado simulado y permisos/reportes de equipo; 8 frontend de destino, modo Normal, compatibilidad, fallback, reporte y deduplicación entre instancias. Quedan pendientes NewOrderAlertService y los modales de POS, además de hardware real.

Casos de referencia: `kitchen_escpos.build_kitchen_ticket` (sin precios; anulados fuera; adicional = último lote;
«SIN:» con nombres; mesa sin «MESA Mesa…» doble; cliente para llevar), `get_kitchen_ticket_escpos` (otro negocio →
PermissionError; adicional sin lote → error), `qz_tray.sign_qz_request` (solo 64 hex; exige `restaurant.orders.read`
del negocio; la firma valida con el certificado), `generate_qz_certificate` (no reemplaza sin `force`),
`report_print_station` (crea o actualiza por negocio + equipo; rechaza Mesero, otro negocio, `device_id` y evento
inválidos; `printed` solo enlaza órdenes del negocio), `get_print_station_overview` y `desk_generate_qz_certificate`
(solo System Manager; las lecturas aceptan solo GET). Desk: grupo «Impresora de cocina (QZ Tray)» en
`facturada_core.desk_setup` solo con Restaurante instalado; manual: abrir la lista, «Certificado del servidor», «Cómo
funciona» y el botón del negocio sin «No permitido». Para probar en
un sitio sin certificado, generarlo antes y no tocar el `site_config` de otros sitios.
Front: `PrintStationService` (`available` sin Mesero; `isValidTarget`; `configured` falso en «Normal» aunque haya
impresora; lectura de lo guardado sin `enabled`; `claim` imprime una sola vez por clave;
`printComanda` sin impresora llama al fallback), `NewOrderAlertService` (con impresión automática imprime pedidos propios
y en Cocina; sin ella no cambia el aviso), `pos-print-modal` con `kitchenSent`. Manual: QZ Tray + térmica real por IP y
por USB, «Imprimir prueba», tildes, corte y una sola comanda con dos pestañas abiertas.

## Pendiente de pruebas: cierre administrativo de órdenes (2026-10-28)

Restaurante `force_close_order`: motivo inválido / «otro» sin detalle / orden ya cerrada fallan; deja
Cerrada, mesa Libre, comentario y campos `force_closed*`; orden cobrada no se marca `force_closed`;
`get_dashboard_metrics` no suma las `force_closed`; solo Administrador y Gerente (Cajero, Mesero, Cocina,
Facturación y Usuario sin permiso). Front: opción del menú solo con el permiso, `ForceCloseDialogComponent`
(botón deshabilitado sin motivo; «otro» exige detalle), chip «Cierre manual». Verifiqué el backend con
un script temporal ya borrado.

## Pendiente de pruebas: pedidos sin mesa del mesero (2026-10-28)

Menú «Órdenes» visible para Mesero (create sin update) y oculto para Usuario/Facturación/Cocina;
`TablesComponent.ordersWithoutTable` (solo activas sin mesa, se actualiza por eventos en vivo, sin importe en vista
de mesero). Manual: mesero crea «Orden sin mesa» y la ve en Mesas y en Órdenes.

## Pendiente de pruebas: agregar productos a una orden abierta (2026-10-28)

Restaurante `add_order_items`: suma renglones con `addition_batch` 1, 2…; stock/insumos solo por lo agregado (aunque el
producto ya estuviera en la orden); una orden Lista vuelve a preparación; totales recalculados; cancelar devuelve todos los
movimientos; falla con orden cerrada/cancelada, facturada, con pagos, con subcuentas o sin productos; formato de impresión
«FacturADA Restaurant Kitchen Ticket Addition» muestra solo el último lote. Front: botón visible solo con las condiciones,
POS modo agregar (sin alias/tipo), marca «Agregado» en cocina, aviso «Pedido ampliado» a Caja (no al autor). Verifiqué el
backend con un script temporal ya borrado.

## Pendiente de pruebas: sin cocina y «Mis órdenes» (2026-10-28)

`OrderCard`/`OrderTable` con `kitchenEnabled=false` (sin «Enviar a cocina», con «Ver y cobrar»); detalle sin «Iniciar
preparación» sin `kitchen`; `isWaiterOnly` (Mesero sí; Cajero, Gerente, Administrador no); `get_all_orders(mine=1)` filtra
por `waiter` del usuario y `total` coincide. Verifiqué `mine` con un script temporal ya borrado.

## Pendiente de pruebas: anular un producto ya enviado (2026-11-07)

Restaurante `void_order_item`: anulación total y parcial (divide el renglón, descuento proporcional); el total excluye lo
anulado (`apply_document_totals`), la factura (`build_lite_invoice_payload`) y las subcuentas (`_remaining_of`) también;
Pendiente devuelve insumos con Entradas (receta, «sin», solo ítems con Salida de esa orden, también Por Bodega); En
preparación/Listo no devuelve; cancelar después la orden deja el stock como al inicio; rechaza motivo inválido, «other» sin
detalle, cantidad 0 o mayor, ya anulado, último renglón, facturada, con pagos, con subcuentas, cierre manual; solo
Administrador/Gerente; `update_kitchen_item_status` rechaza `Cancelado`; `update_order_for_invoice` conserva los anulados
con su auditoría (con y sin inventario). Front: `canVoidItems`/`canVoidItem`, `voidedItems` fuera de totales y del
payload, `kitchenSummary`/`accountSummary`, `VoidItemDialogComponent`, avisos `item_voided` en Cocina y Caja. Verifiqué el
backend con un script temporal ya borrado.

## Pendiente de pruebas: carta digital por QR (2026-11-07)

Restaurante `api/public_menu.py`: subir foto (optimizada a 1800 px, se agrega al final, máximo 20), PDF (reemplaza todo;
exige `replace=1` si ya hay archivos), foto sobre PDF sin `replace` falla, extensión no permitida, imagen o PDF falsos o
dañados, tamaño máximo; un solo archivo en disco por subida y se borra al quitarlo; mover arriba/abajo; quitar el último
apaga la publicación; publicar sin archivos falla; `regenerate_menu_token` invalida el código anterior; `get_menu_qr`
rechaza URLs que no terminan en `/menu/<token>` o no son http(s); `get_public_menu` como Guest: 404 igual para código
inexistente, menú apagado, negocio inactivo o sin `restaurant`, y no devuelve más que nombre, logo, mensaje y archivos;
administración solo con `restaurant.manage`. Front: ruta pública `/menu/:token` (sin sesión, con su propio scroll porque
`html`/`body` no hacen scroll), `/dashboard/digital-menu` (`DigitalMenuComponent`: confirmaciones al reemplazar, límite de
fotos, publicar, copiar enlace, QR, tarjeta imprimible). Verifiqué el backend con scripts temporales ya borrados y la página
pública con Playwright (390 px claro/oscuro, 1280 px, PDF, enlace inválido).
Desk: `desk_upload_menu_file` (solo System Manager, solo con doctype de la carta, reemplaza sin `replace`), el controlador
(`validate`: fotos o PDF, un solo PDF, máximo, mensaje, publicar exige archivos y `restaurant`; `on_update` borra el File de
una fila quitada; `on_trash` borra todos), `_manage` deja a System Manager gestionar cualquier negocio y a los demás solo el
suyo con `restaurant.manage`.

## Pendiente de pruebas: carta / catálogo digital para todo negocio (2026-11-08)

Core: `FEATURE_FIELDS["digital_menu"]`; `effective_features` devuelve `digital_menu` (True sin clave); todos los planes
de `PLAN_CATALOG` traen `enable_digital_menu = 1`; `apply_license_snapshot` sin `enable_digital_menu` lo deja en 1 y con
0 lo apaga; `ui_capabilities.modules.digital_menu` visible/can_manage solo con la función y `products.manage`; patch
`backfill_digital_menu_feature` enciende todas las suscripciones. Restaurante `public_menu`: un negocio sin `restaurant`
con `digital_menu` administra y publica (`menu_type` «Catalogo»); sin `digital_menu`, `_manage` falla y
`get_public_menu` responde el 404 de siempre; Cajero (sin `products.manage`) no administra; el controlador no publica
sin `digital_menu`. Front: `menuWords('Carta'|'Catalogo')`; `PublicMenuService.wordsFor` sin `menu_type` usa la función
`restaurant`; menú lateral muestra «Catálogo digital» sin `restaurant` y «Carta digital» con ella, y se oculta sin
`digital_menu` o sin `products.manage`; la ruta `/dashboard/digital-menu` exige lo mismo; página pública con
`menu_type: 'Catalogo'` tiene el botón de ícono con `aria-label` «Compartir catálogo», dice «Ver catálogo» y título «Catálogo · <negocio>».

## Pendiente de pruebas: carta digital pública rediseñada (2026-11-08)

`PublicMenuComponent` (`/menu/:token`): con varias fotos aparece la barra de páginas y `goToPage(i)` lleva a esa página;
con una sola no hay barra; `initials` con logo vacío («Cafeteria Demo» → «CD»); `share()` usa `navigator.share` si
existe, si no copia al portapapeles y muestra «Enlace copiado», y no muestra error si el usuario cancela (`AbortError`);
`whatsappUrl` lleva el número de `BRAND` y el nombre del negocio codificado; el recuadro de FacturADA sale con carta y en
«no disponible», y no mientras carga. E2E: 390 px claro/oscuro, varias fotos, PDF, enlace inválido.

## Pendiente de pruebas: detalle de orden sin edición de productos (2026-11-08)

`OrderDetailPageComponent`: no hay buscador, stepper, precio editable ni papelera en ningún estado; `saveOrderChanges`
reenvía los ítems sin cambios y sin `rate`; `hasUnsavedInvoiceChanges` solo por cliente o pago; `advanceKitchen` llama
`updateKitchenOrderStatus` con `kitchen` y `updateStatus` sin ella; `quickPay` marca el método (`isQuickPaySelected`) y
conserva la referencia; con dos pagos `isSplitPayment` y al quitar uno el restante vuelve al total.

## Pendiente de pruebas: Órdenes en vivo y Cocina (2026-11-08)

`order-status.utils.ts` ya tiene 7 pruebas aprobadas (etapas mixtas, anulados, fallback, etiquetas y tiempo); faltan los componentes y acciones descritos a continuación. `kitchenStage` (por platos, ignora anulados, cae al estado de la orden), `orderHeadline`,
`orderTypeLabel`, `KITCHEN_NEXT_ACTION`. `OrdersRealtimeComponent`: `toPreparacion`/`toLista`/`toEntregado` solo actúan en su
etapa, con permiso y con `kitchen`, y llaman `updateKitchenOrderStatus` (nunca `updateStatus`); `setKitchenTab('DONE')`
carga entregadas; `mobileColumn`. Tabla/tarjeta de Caja: acción siguiente según `kitchenStage`, «Cobrar»/«Ver orden»,
sin acciones de cocina sin `kitchen`, botón deshabilitado con `pendingOrderNames`/`actionPending`. Modal: etapa con
`orderStage` (Lista ya no sale «Cerrada»), «Ver orden» para cancelada. `RealtimeOrdersService.mapOne` llena `orderType`.


## Validado: empresa demo solo en Pruebas (2026-11-09)

Core 4, Lite 2, API 2 y Configuración Angular 2 casos aprobados. El estado visual del botón se conserva como revisión manual pendiente; los guards y peticiones bloqueadas se prueban en componentes.

- Core: `ensure_production_allowed` / `enforce_document_limit(business, 'Produccion')` lanza para `is_demo=1` y no
  para negocio real ni para Pruebas; perfil tributario demo a Produccion rechazado, a Pruebas permitido; marcar
  `is_demo` en un negocio con perfil en Produccion rechazado.
- API: `FacturADA API Client` de un negocio demo con `environment=Produccion` rechazado.
- Lite: `get_lite_setup` incluye `business.is_demo`; `save_lite_setup` con `environment=Produccion` en demo devuelve
  el mensaje y no cambia el perfil.
- Front `company.component`: con `isDemo`, botón «Producción» deshabilitado, nota visible, `onLiteEnvironmentSelected`
  y `saveLiteEnvironment` no cambian a Producción; `cambiarAmbiente` (clásico) revierte el check sin llamar al servicio.

## Cobertura parcial: dashboard rediseñado (2026-11-09)

Validados: 7 pruebas de atención y 4 de métricas/caja; las specs existentes del dashboard siguen pasando excepto DashboardComponent should create (heredada). E2E con sesión de cada panel/rol y los componentes individuales descritos abajo siguen pendientes.

- `dashboard-attention.ts` (`buildAttentionItems`): vacío para service/kitchen/none; firma falta/vencida/≤ 30 días
  (acción solo con `manageSettings`); plan sin plan/inactivo/agotado/por vencer solo con `showPlan`; rechazadas y en
  proceso con su enlace (`estado=Rechazada`) solo con `readInvoices`; caja cerrada con «Abrir caja» solo con
  `openCash`; stock (agotados → danger, solo bajo → warning); singular/plural de los títulos; orden de la lista.
- `operations-metrics.ts`: `soldCount`/`averageTicket` (restaurante divide entre `Cerrada`, POS entre todas; 0 sin
  ventas), `cashBreakdown` (efectivo = código `01`, otras formas aparte sin montos 0, total cobrado),
  `productShares` (100 al más vendido, 0 si todo es 0), y `normalizeOperationsMetrics` con `total` y `payment_code`.
- Componentes: `AttentionListComponent` («Todo en orden» solo con `showAllClear`), `CashTicketComponent` (abierta con
  cuadre y botones según `canOperate`; cerrada con «Abrir caja»), `OperationsPanelComponent` (restaurante vs POS:
  «En curso» o «Con factura», etapas y cancelados), `BillingKpisComponent` («Ver y corregir» solo con rechazadas y
  permiso), `RecentInvoicesComponent` (fila enlazada solo con `canOpen` e id), `PlanUsageCardComponent`.
- `DashboardHomeComponent`: rechazadas/en proceso de «Necesita tu atención» solo con el mes en curso; `attentionSettled`
  falso mientras carga; las pruebas existentes siguen apuntando a `#billing-month`, `#billing-year`,
  `[aria-label="Período de comprobantes"]`, «Comprobantes electrónicos del mes» y «Firma: …».
- `InvoicesComponent`: `?estado=Rechazada` aplica el filtro; un estado desconocido se ignora.
- Se borró `utils/dashboard-alerts.spec.ts` (su función ya no existe) y en `operations-metrics.spec.ts` los bloques de
  calificaciones e insights; lo esperado de `normalizeOperationsMetrics` suma `total` y `code`.

## Cobertura parcial: decimales y toasts (2026-11-09)

Utilidades: 2 pruebas nuevas aprobadas, además de las 3 existentes. El CVA con foco/blur y la posición real de toasts siguen pendientes.

- `decimal.utils`: `minDecimalsFromStep` ('0.01' → 2, '1'/'any'/null/'0'/'abc' → 0, tope 6) y
  `formatDecimalForInput` (5.5 → '5.50', 5 → '5.00', 0 → '0.00', 1.2345 → '1.2345', 12.5 con 0 → '12.5',
  notación exponencial sin cambios).
- `DecimalInputDirective` (componente de prueba con `step="0.01"`, `step="1"` y `step="any"`): `writeValue(5.5)` →
  «5.50»; al salir del campo «5,5» → «5.50» y el modelo recibe 5.5; con el campo enfocado y texto «5.» el
  `writeValue(5)` no lo reescribe; si el modelo cambia a otro valor con foco, sí; `null` → vacío; porcentaje y cantidad
  sin ceros de relleno.
- `LayoutComponent`: pone `data-shell` en `<html>` (`sidebar-open` / `sidebar-collapsed` / `pos` según `MenuService`)
  y lo quita al destruirse.
- Manual o Playwright con sesión: toast con el menú abierto, contraído y en POS (≥ 1280 px) y en celular con barra
  inferior; montos en POS, Facturar, Caja y detalle de orden.

## Validado: login rediseñado (2026-11-08)

SignInComponent: 13 casos unitarios cubren validación sin HTTP, mensajes 401/0/429,
fallback backend, limpieza de error, contraseña/Bloq Mayús, ayuda accesible,
selección de negocio, rechazo 403 y limpieza de selección, usuario sin negocio,
menú/navegación y navegación cancelada. AuthComponent: 6 casos de totales IVA,
formato y no lectura del logo previo. ThemeService: 4 casos de carga/migración,
persistencia de preferencias y JSON inválido.

E2E de la aplicación compilada, 16 OK (4 casos × 1440/1024/390 claro/390 oscuro):
validación/mostrar contraseña/ayuda, 401 y corrección, selector de negocios con
rechazo 403, redirección de forgot-password al login. Capturas de cada tamaño.
APIs interceptadas (también la URL absoluta del build), sin backend real.

## Cobertura parcial: paleta de colores y tema (2026-11-08)

- `ThemeService` (4 pruebas aprobadas):
  - sin `theme` guardado usa `facturada`;
  - con `{color:'violet'}` y sin `theme_palette`, pasa a `facturada`, guarda `theme_palette`, respeta `mode` y
    `direction`;
  - con `theme_palette` ya guardado respeta `violet`;
  - con JSON inválido en `theme` no falla.
- ApexCharts fue retirado de las pantallas del dashboard el 09/11; no existen builders dashboard-charts para probar. La dependencia global pendiente de retirar no se tocó en esta validación.
- `ButtonComponent` (app-button): ningún tono usa clases `slate`/`violet`/`green` fijas.
- `AuthComponent` (6 pruebas aprobadas): `subtotal`, `vat` (15 %) y `total` cuadran para cada ejemplo, y `money(8.3)` da `8,30`.
- E2E con sesión, en claro y oscuro: POS, Facturar, Órdenes en vivo, Caja, Dashboard, Inventario y Configuración.
  Buscar cajas claras en modo oscuro y textos sin contraste.

## Asistente de migración en Desk (2026-10-29)

La carga ya no existe en Angular. Pruebas del JS de Lite con navegador y Frappe/API
simulados: `npx playwright test --config=playwright.desk-migration.config.ts`,
con CHROME_BIN/LD_LIBRARY_PATH de esta guía. No requieren servidor ni sitio real;
interceptan toda navegación/HTTP. Son un arnés del asistente, no una prueba de Desk
completo conectado a Frappe. El fixture Company ahora renderiza su plantilla con
providers/mocks y comprueba que no ofrece importación; ya no es una falla heredada.

## Históricos sin número de autorización (2026-10-29)

Última suite Lite: 238 OK. Falta de número ya no bloquea; falta de clave sigue
bloqueando. Casos factura/NC, vínculos, estado declarado/UNKNOWN técnico, número
vacío, nota explícita, solo lectura, sin proveedor/correo/cuota. XML firmado sin
envoltura se admite sin inventar número; DTD/ajeno permanece bloqueado.
Reporte: PRUEBAS_HISTORICOS_SIN_AUTORIZACION_2026-10-29.md.

## Limpieza de documentos de Pruebas en Desk (2026-10-29)

Última ejecución: Core 79 OK y Lite 251 OK (330 en total), HTTP/SMTP bloqueados,
datos ficticios y rollback en facturada_core_simple_test. Nuevo módulo
facturada_lite.api.test_sandbox_cleanup (13 pruebas). No ejecutar execute contra
una empresa real como parte de pruebas ni instalación.
Navegador: playwright.desk-migration.config.ts ahora incluye desk-cleanup.spec.ts
y desk-migration.spec.ts, 6 OK con Frappe/API simulados. No requieren servidor
real; no equivalen a una sesión completa del Desk conectado a Frappe.
Reporte: PRUEBAS_LIMPIEZA_DESK_2026-10-29.md.

## Catálogo de planes en Desk (2026-10-30)

playwright.desk-migration.config.ts incluye además desk-plans.spec.ts: consulta
get_plan_catalog mediante GET y aplicación mediante POST con payload de negocio/plan.
El mock HTTP rechaza el método incorrecto con 403, reproduciendo la falla reportada.
Suite Desk actual: 7 OK. Ejecutar con CHROME_BIN/LD_LIBRARY_PATH de esta guía:
`npx playwright test --config=playwright.desk-migration.config.ts`.
No se repitieron suites Python/Karma/build Angular: solo cambió JS del Desk Core.
Evidencia temporal: /tmp/facturada-desk-plans-tests.log. Sin plan real ni despliegue.

## Ejecutar las comprobaciones actuales de login y Desk

Recrear el launcher local temporal si /tmp fue limpiado:

```bash
cat > /tmp/facturada-legacy-karma.cjs <<'JS'
module.exports = config => {
  require('/home/frappe/front-restaurante2025/karma.conf.js')(config);
  config.set({customLaunchers:{ChromeHeadlessNoSandbox:{base:'ChromeHeadless',flags:['--no-sandbox','--disable-dev-shm-usage']}},browsers:['ChromeHeadlessNoSandbox']});
};
JS
npx ng test --watch=false --karma-config=/tmp/facturada-legacy-karma.cjs --browsers=ChromeHeadlessNoSandbox
```

Build aislado para el navegador (sin despliegue):

```bash
npm run build -- --output-path=/tmp/facturada-2026-11-09-production
npx playwright test --config=playwright.auth.config.ts
npx playwright test --config=playwright.desk-migration.config.ts
```

Usar CHROME_BIN/LD_LIBRARY_PATH de esta guía. Login: 16 OK; Desk: 7 OK. El servidor
estático de pruebas escucha solo 127.0.0.1:4228, no hace proxy y devuelve 503 para
API no interceptada. El arnés del login responde localmente a la URL absoluta de
API de producción sin permitir que esa petición continúe al servidor real.
No ejecutar las pruebas heredadas navbar/sidebar/table contra producción.

## Bloqueo de transporte para repetir suites backend

El arnés temporal se perdió al limpiarse /tmp y se recreó para esta sesión. Antes
de ejecutar suites, crear el siguiente archivo (el nombre sitecustomize.py es
necesario para que Python lo cargue al arrancar):

```bash
mkdir -p /tmp/facturada-2026-11-09-fence
cat > /tmp/facturada-2026-11-09-fence/sitecustomize.py <<'PYCODE'
import smtplib

def blocked(*args, **kwargs):
    raise AssertionError('TEST_NETWORK_FENCE: real HTTP/SMTP forbidden')

try:
    import requests.adapters
    requests.adapters.HTTPAdapter.send = blocked
except ImportError:
    pass
smtplib.SMTP.sendmail = blocked
smtplib.SMTP.send_message = blocked
PYCODE
```

Usarlo solo en el proceso de pruebas; los tests siguen debiendo simular cada
llamada esperada del proveedor. Desde el Bench, repetir por app, secuencialmente:

```bash
PYTHONPATH=/tmp/facturada-2026-11-09-fence bench --site facturada_core_simple_test run-tests --app facturada_core
PYTHONPATH=/tmp/facturada-2026-11-09-fence bench --site facturada_core_simple_test run-tests --app facturada_lite
PYTHONPATH=/tmp/facturada-2026-11-09-fence bench --site facturada_core_simple_test run-tests --app facturada_restaurante
PYTHONPATH=/tmp/facturada-2026-11-09-fence bench --site facturada_core_simple_test run-tests --app facturada_api
```

El build optimizado del 08/11 también pasó al permitir la descarga de las fuentes
públicas: 2,57 MB inicial, 4 advertencias de selectores CSS. El primer intento
restringido falló por DNS de fonts.googleapis.com; no fue un error de TypeScript.

Nota de herramientas (08/11): Prettier con autodescubrimiento del plugin Tailwind
falla al requerir DaisyUI ESM desde tailwind.config.js (ERR_REQUIRE_ESM). No es
una prueba de funcionamiento. Los TS nuevos se formatearon/verificaron mediante
la API de Prettier con las opciones de .prettierrc, plugins=[] y
pluginSearchDirs=false; configuración del proyecto sin cambios.

## Verificación actual de impresión y demo (2026-11-09)

Nuevos módulos backend: facturada_core.api.test_demo_environment,
facturada_lite.api.test_demo_environment, facturada_api.api.test_demo_environment,
facturada_restaurante.api.test_qz_printing. Todos usan datos ficticios/rollback;
las pruebas de generación de certificados simulan la escritura de site_config.
Nunca generar certificados ni lanzar impresiones reales como preparación automática.

Navegador actual: login 16 OK sobre build optimizado del 09/11 y Desk 7 OK, con
APIs interceptadas. No conectan a QZ ni equivalen a imprimir en USB/red.
Prueba manual pendiente con QZ Tray y la térmica: confianza override.crt, caracteres
PC850, corte y una sola comanda desde pestañas reales. No se hizo despliegue.
