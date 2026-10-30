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

### Línea base conocida (2026-10-29)

Última ejecución completa: **504 pruebas, 479 aprobadas y 25 fallidas heredadas**, sin error
global asíncrono. Se retiraron las 5 pruebas de carga Angular al moverla al Desk; se conserva la prueba de acciones fiscales de históricos. El fixture de Company se corrigió y prueba que no ofrece importación. Desde la línea base del 27/10 se añadieron specs de Insumos
(`pages/kitchen-supplies/*.spec.ts`), carrito y editor de notas del POS
(`pages/pos/services/cart.service.spec.ts`, `pages/pos/ui/line-note-editor.component.spec.ts`),
lenguaje de variantes por tipo de negocio, stock inicial y «Ajustar en Inventario» en
`products.behavior.spec.ts`, bodegas por tipo de negocio
(`core/services/company-capabilities.warehouse-ui.spec.ts`, navegación de inventario) y la apertura del
movimiento desde la ficha (`pages/inventory/inventory.adjust-from-product.spec.ts`).
Los fixtures de `products.behavior.spec.ts` y del spec de navegación representan ahora un
comercio **sin** `restaurant`; los casos de restaurante lo activan explícitamente.
Detalle y comandos en [PRUEBAS_CODEX_2026-10-27.md](PRUEBAS_CODEX_2026-10-27.md).

Referencia del 27/10: 426 pruebas, 400 aprobadas y 26 fallidas heredadas.

La referencia anterior era 368 pruebas, 342 aprobadas y 26 fallidas. Al iniciar la
validación del 26/10, el checkout tenía 321 aprobadas y 47 fallidas. Se corrigieron
fixtures desactualizados de facturación/POS y se añadieron 53 pruebas de acciones
fiscales, guard y capacidades. Resultado completo y comandos en
[PRUEBAS_CODEX_2026-10-26.md](PRUEBAS_CODEX_2026-10-26.md).

Resultado anterior (26/10): **421 pruebas, 395 aprobadas y 26 fallidas**, todas estas
ultimas pertenecen a la lista heredada siguiente. Las 53 pruebas nuevas pasan.

Las 25 fallas heredadas actuales corresponden a specs
"should create" heredados de la plantilla, a los que les faltan providers, y no
indican regresiones:

`AperturaCajaComponent`, `AppComponent` (3), `CloseCajaComponent`,
`DashboardComponent`, `Error404Component`, `Error500Component`, `ForgotPasswordComponent`,
`LayoutComponent`, `NavbarComponent`, `NavbarMobileComponent`, `NewPasswordComponent`,
`OrderCardComponent`, `OrderKitchenCardComponent`, `OrderModalComponent`,
`ProfileMenuComponent`, `RetiroCajaComponent`, `SidebarComponent`, `TableActionComponent`,
`TableComponent`, `TableFooterComponent`, `TableRowComponent`, `TwoStepsComponent`,
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

### Línea base backend (2026-10-29)

| App | Pruebas | Resultado |
|-----|---------|-----------|
| facturada_core | 75 | Referencia previa; no repetida el 29/10 |
| facturada_lite | 234 | OK 29/10, incluye 69 de migración (37 paquete/exportador + 32 integración) |
| facturada_restaurante | 59 | OK 29/10 en revisión anterior, no repetida para traslado al Desk |
| facturada_api | 30 | Referencia previa; no repetida el 29/10 |

Última ejecución del cambio Desk: **234 aprobadas** en Lite, HTTP/SMTP real bloqueado
y rollback. Restaurante 59 conserva su resultado anterior del mismo día. Solo
facturada_core_simple_test se usa para pruebas. Core/API son referencias.
Exportador de restaurante_app: excepción expresamente solicitada por el usuario,
pruebas puras desde Lite sin instalar Legacy en el sitio de pruebas.
Reporte y comandos actuales: [PRUEBAS_MIGRACION_DESK_2026-10-29.md](PRUEBAS_MIGRACION_DESK_2026-10-29.md).

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
Impresión automática: `printComandaHidden` (marco oculto que se elimina a los 30 s), interruptor
`autoPrint` por equipo, toast «Reimprimir». Prueba manual con Chrome `--kiosk-printing` y la térmica real.

## Pendiente de pruebas: cierre administrativo de órdenes (2026-10-28)

Restaurante `force_close_order`: motivo inválido / «otro» sin detalle / orden ya cerrada fallan; deja
Cerrada, mesa Libre, comentario y campos `force_closed*`; orden cobrada no se marca `force_closed`;
`get_dashboard_metrics` no suma las `force_closed`; solo Administrador y Gerente (Cajero, Mesero, Cocina,
Facturación y Usuario sin permiso). Front: opción del menú solo con el permiso, `ForceCloseDialogComponent`
(botón deshabilitado sin motivo; «otro» exige detalle), chip «Cierre manual». Verifiqué el backend con
un script temporal ya borrado.

## Pendiente de pruebas: pedidos sin mesa del mesero (2026-10-28)

Menú «Lista Órdenes» visible para Mesero (create sin update) y oculto para Usuario/Facturación/Cocina;
`TablesComponent.ordersWithoutTable` (solo activas sin mesa, se actualiza por eventos en vivo, sin importe en vista
de mesero). Manual: mesero crea «Orden sin mesa» y la ve en Mesas y en Lista Órdenes.

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

## Asistente de migración en Desk (2026-10-29)

La carga ya no existe en Angular. Pruebas del JS de Lite con navegador y Frappe/API
simulados: `npx playwright test --config=playwright.desk-migration.config.ts`,
con CHROME_BIN/LD_LIBRARY_PATH de esta guía. No requieren servidor ni sitio real;
interceptan toda navegación/HTTP. Son un arnés del asistente, no una prueba de Desk
completo conectado a Frappe. El fixture Company ahora renderiza su plantilla con
providers/mocks y comprueba que no ofrece importación; ya no es una falla heredada.
