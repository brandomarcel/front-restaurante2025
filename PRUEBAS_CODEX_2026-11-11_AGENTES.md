# Validación con tres agentes — FacturADA, 11/11/2026

## Resultados finales

| Área | Resultado |
|---|---|
| Angular completo | **634: 614 aprobadas / 20 fallas heredadas** |
| Core | **98 OK** |
| Lite | **312 OK** |
| Restaurante | **77 OK** |
| API externa | **32 OK** |
| Login, cuatro tamaños/temas | **16 OK** |
| Desk simulado | **10 OK** |
| Retenciones, escritorio y móvil oscuro | **10 OK** |
| Liquidaciones y anulaciones, escritorio y móvil oscuro | **14 OK** |
| Build final de producción | **OK**, 2,57 MB inicial / 583,62 kB estimados |
| Lint final | **19 heredados: 18 errores y 1 advertencia** |

Backend: **519 aprobadas**. Navegador: **50/50 aprobadas**.
Se añadieron **73 casos** (34 frontend + 25 backend + 14 navegador), todos aprobados.
Los casos nuevos ya están incluidos en los totales; no sumarlos dos veces.
No se observaron regresiones finales. Angular y lint siguen sin estar completamente
verdes por los problemas heredados descritos abajo.

## Correcciones anteriores revalidadas

La corrida inicial de Angular fue 600: 578 OK / 22 fallas. El primer build del
navegador todavía reproducía las tres fallas de retenciones del 10/11.
Durante la sesión otro editor corrigió el runtime; el equipo de pruebas no hizo
esas modificaciones. Se mantuvieron las aserciones originales y se verificó:

- Reabrir el borrador del concepto 332 conserva **0 %**, tanto en unitarias como
  en navegador desktop y móvil. Ya no se transforma en null.
- `daysBetween` rechaza fechas imposibles como febrero 30 y mes 13. Lo verifica
  el test unitario original; no se normalizan a otro día del calendario.
- El toolbar móvil ya queda sobre la navegación inferior y **Consultar SRI** acepta
  un clic normal. No se usó force click ni se ocultó la barra.

Se recompiló en una carpeta nueva y se repitieron las cuatro suites de navegador
sobre ese build final. Las capturas y logs anteriores al arreglo se conservaron
como evidencia histórica; no describen fallas vigentes.

## Reparto del trabajo

- `/root/pruebas_frontend_actual`: unitarias Angular y contratos HTTP de componentes/servicios.
- `/root/pruebas_backend_actual`: único ejecutor de migrate y DB; las cuatro suites Frappe fueron secuenciales.
- `/root/pruebas_navegador_actual`: compilación, lint y Playwright con HTTP/WebSocket interceptados.
- Coordinador: revisión de contratos, resultados y documentación.

Se conservaron los cambios existentes del workspace. El equipo cambió pruebas,
configuraciones de pruebas y documentación; no lógica de negocio ni arquitectura.

## Pruebas nuevas

### Frontend: 34 casos

- `services/purchase-settlements.service.spec.ts` (8): métodos, negocio, payload,
  filtros y normalización de respuestas, incluidas acciones de anulación.
- `pages/purchase-settlement-form/purchase-settlement-form.component.spec.ts` (7):
  proveedores permitidos, cálculo/validaciones, aviso de efectivo, secuencia y emisión.
- `pages/purchase-settlement-detail/purchase-settlement-detail.component.spec.ts` (3):
  acciones según estado/agente/retención relacionada y navegación.
- `pages/withholding-form/withholding-form.component.spec.ts` (+3): desde una
  liquidación con IVA usa sustento 01, sin IVA usa 02 y el origen anulado avisa/bloquea el prellenado.
- `shared/components/sri-annulment-dialog/sri-annulment-dialog.component.spec.ts` (+2):
  kinds retención/liquidación con textos, motivos y servicio correspondiente.
- `shared/components/sri-annulment-section/sri-annulment-section.component.spec.ts` (4):
  autorizado/allowed/available, bloqueo y banda de auditoría.
- `services/withholdings.service.spec.ts` (+1): POST de anulación con su parámetro y confirmación.
- `services/frappe-socket.service.spec.ts` (+4): setSite persiste/limpia el sitio,
  no reconecta el mismo, solicita recreación del activo y conserva suscripciones;
  el socket explícitamente inactivo no conecta.
- `core/services/company-capabilities.service.spec.ts` (+1): propaga message.site.
- `core/utils/withholding.spec.ts` (+1): mapa electrónico del documento 03.

Focalizados: **86/86 OK**, incluidos casos existentes. Suite completa: **614 OK / 20 heredadas**.
Las huellas de los dos archivos de las correcciones de cero/calendario se mantuvieron
estables durante la corrida final. Los tests de Socket usan un socket falso y un
spy de connect; no prueban el factory Socket.IO ni una reconexión real autenticada.

### Backend: 25 casos

- `facturada_core/api/test_withholding_capabilities.py` (+2): visibilidad y acciones03
  por feature/permiso sin exigir agente de retención.
- `facturada_lite/api/test_purchase_settlement.py` (14): cálculos y agrupación por
  tarifa, validación de cédula y proveedor, ubicaciones/permisos/negocio, configuración
  y firma/secuencia, fecha del día, identidad/idempotencia/colisión, autorización
  simulada con cupo único y sin stock, 43/70 solo consulta, reintento definitivo,
  búsqueda por producto/paginación/conteos y correo desactivado.
- `facturada_lite/api/test_document_annulment.py` (9): ambos documentos exigen
  confirmación/motivo/fecha y autorización; permisos, auditoría e identidad, segundo
  registro bloqueado, sin cambios en dinero/stock/cupo; retención vigente bloquea
  liquidación, las inactivas/ajenas no; listado Anulada y emisión de retención sobre
  liquidación anulada bloqueada. Incluye una retención03 válida simulada.
- `facturada_lite/api/withholding_test_helpers.py`: fixtures compartidos; **cero casos propios**.
  `test_withholding.py` conserva sus 19 tests y actualiza el contrato aditivo `Anulada: 0`.
- `facturada_lite/api/test_frontend.py`: el caso existente de contexto verifica
  `site == frappe.local.site`; no se cuenta como caso nuevo.

Las focalizadas 14 y 9 pasan y ya forman parte de Lite 312. Resultado completo:
**98 + 312 + 77 + 32 = 519 OK**. Huellas de runtime estables desde antes de Core
hasta el cierre de las cuatro suites; no hubo cambios backend intermedios que
obligaran a atribuir el resultado a una versión distinta.

### Navegador: 14 casos nuevos

`tests-e2e/purchase-settlements.e2e.spec.ts`: siete escenarios × desktop y móvil oscuro:

- Descuento, IVA y emisión03 con el payload y origen HTTP esperados.
- Alta de proveedor sin RUC, con tipos de identificación permitidos.
- Retención desde liquidación con IVA: sustento01, documento03, renta311 e IVA100 %.
- Retención desde liquidación sin IVA: sustento02, documento03 y renta311.
- Anulación de liquidación bloqueada por retención vigente.
- Diálogo, POST y banda de anulación de liquidación.
- Diálogo, POST y banda de anulación de retención.

Se comparten fixtures en `tests-e2e/fixtures/electronic-documents.ts`; HTTP y
WebSocket se interceptan. El spec previo de retenciones reconoce la pestaña
Anuladas, manteniendo intactas las expectativas correctas de cero y clic móvil.
Los 16 de login, 10 de Desk, 10 de retenciones y 14 nuevos pasan: **50/50**.

## Entorno y comandos

Único sitio DB: **facturada_core_simple_test**. Redis 13000/11000 respondió PONG.
Migrate se ejecutó exclusivamente allí. Fixtures ficticios con rollback; bloqueo
adicional de HTTP/SMTP y mocks de proveedor/certificado/email. QZ usa sus dobles
existentes: no se generaron certificados reales ni hubo impresión. No se creó
XML físico ni se envió al SRI. No hubo commits, push ni despliegue.

Frontend, con CHROME_BIN y LD_LIBRARY_PATH de TESTING_CODEX.md:

```bash
npx ng test --watch=false --karma-config=/tmp/facturada-legacy-karma.cjs --browsers=ChromeHeadlessNoSandbox
npm run build -- --output-path=/tmp/facturada-2026-11-11-final-production
npm run lint
npx playwright test --config=playwright.auth.config.ts
npx playwright test --config=playwright.desk-migration.config.ts
npx playwright test --config=playwright.withholdings.config.ts
npx playwright test --config=playwright.purchase-settlements.config.ts
```

Retenciones y liquidaciones comparten el servidor local 4230 y se ejecutaron por
turnos. Login usa 4228. Ninguna API ni WebSocket continuó hacia un servicio real.
Se permitió descargar fuentes públicas para compilar.

Backend desde `/home/frappe/frappe-bench`, secuencialmente:

```bash
PYTHONPATH=/tmp/facturada-2026-11-11-fence bench --site facturada_core_simple_test migrate
PYTHONPATH=/tmp/facturada-2026-11-11-fence bench --site facturada_core_simple_test run-tests --app facturada_core
PYTHONPATH=/tmp/facturada-2026-11-11-fence bench --site facturada_core_simple_test run-tests --app facturada_lite
PYTHONPATH=/tmp/facturada-2026-11-11-fence bench --site facturada_core_simple_test run-tests --app facturada_restaurante
PYTHONPATH=/tmp/facturada-2026-11-11-fence bench --site facturada_core_simple_test run-tests --app facturada_api
```

## Evidencia

Build final: `/tmp/facturada-2026-11-11-final-production`, bundle `main-4E2SA335.js`, SHA-256:

```text
ee09dc9ecd8539456d53dceee189d73456ead531d4cbb3ad10e0db1c7d31ca95
```

Logs vigentes con prefijo `/tmp/facturada-2026-11-11-`:

- `front-baseline.log`, `front-focused.log`, **`front-final.log`**.
- `back-migrate.log`, **`back-{core,lite,restaurante,api}.log`**, `back-settlement.log`, `back-annulment.log`.
- **`browser-{build,lint,auth,desk,withholdings,purchase-settlements}-final.log`**.

`back-withholding.log` inicial conserva la expectativa antigua de conteos; Lite312
final es la referencia vigente. Los logs/builds/capturas iniciales del navegador
conservan los fallos previos a las correcciones; la referencia actual es el build final.
Captura actual: `/tmp/facturada-2026-11-11-withholding-sri70-mobile-dark.png`.

Huellas backend: `/tmp/facturada-2026-11-11-back-runtime-{before,lite-before,lite-after,final}.json`.
Huellas del runtime frontend coinciden antes/después del build y pruebas finales.

## Fallas heredadas y límites

Angular conserva los 20 casos antiguos de fixtures/providers/plantilla: AppComponent
(3), AperturaCaja, CloseCaja, DashboardComponent, Error404, Error500, Layout, Navbar,
OrderCard, OrderKitchenCard, OrderModal, ProfileMenu, RetiroCaja, TableAction, Table,
TableFooter, TableRow y Users. No se desactivaron ni se ocultaron.
Lint conserva 18 errores y una advertencia. Build: cuatro avisos conocidos de
selectores CSS `0%`/`5%`. No se detectaron fallas nuevas al cierre.

No se validaron servicio Node/XSD, archivos fiscales/PDF o entrega real de correo,
contabilidad ERPNext, impresoras ni concurrencia real entre dos procesos de emisión
/anulación. Socket.IO se probó con dobles: falta reconexión autenticada en dominios
reales. Las suites simuladas no equivalen a emisión fiscal ni contabilidad reales.

Actualizados TESTING_CODEX.md, estados del front y cuatro apps backend, contratos
03/07 en ambas copias y aviso en el reporte histórico del 10/11 de que sus defectos
ya fueron corregidos y revalidados. No se alteró el contrato de ejecución de las APIs.
