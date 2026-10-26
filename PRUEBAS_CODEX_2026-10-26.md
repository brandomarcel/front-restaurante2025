# Validación FacturADA — 2026-10-26

## Alcance y aislamiento

Se siguió `TESTING_CODEX.md`. Único sitio backend: `facturada_core_simple_test`.
Redis de cache y cola respondió PONG. Se aplicó la migración de ese sitio antes de
las suites. No se modificó código de producción, ni se hicieron commits o push.
Se conservaron los cambios locales previos en front y backend.

Las pruebas existentes usan mocks del proveedor. Como protección adicional,
`PYTHONPATH=/tmp/facturada-test-fence` cargó un `sitecustomize.py` temporal que
rechaza transporte HTTP real de Requests y entrega SMTP mediante AssertionError.
No apareció `TEST_NETWORK_FENCE` en los resultados. No se emitió al SRI ni se
entregaron correos. No se iniciaron workers o scheduler para ejecutar envíos.
Las pruebas con base usan los mecanismos de rollback/limpieza de FrappeTestCase;
la migración y la infraestructura estándar de pruebas sí modifican el sitio aislado.

## Pruebas creadas

- `src/app/core/utils/lite-invoice-actions.spec.ts`: 22 casos de consulta exclusiva
  ante códigos 43/70, procesamiento, incertidumbre de conexión, documentos
  cerrados/reemplazados, revisión manual y rechazo definitivo.
- `src/app/core/guards/role-access.guard.spec.ts`: 12 casos de separación entre
  feature, permiso y rol; alternativas/todas las features, lectura de históricos,
  API-only, carga fallida de contexto y almacenamiento de usuario dañado.
- `src/app/core/services/company-capabilities.service.spec.ts`: 19 casos de
  envoltorios Frappe, permisos exactos/agrupados, wildcard sin licencia, Retail,
  API-only, secretos API excluidos del almacenamiento y requisitos de emisión
  (configuración, certificado, plan, cupo y permisos).
- Restaurante: dos regresiones nuevas, una en cada suite de impresión combinada,
  comprueban que renderizar con un mock no sustituye el objeto Frappe del entorno
  Jinja del sitio.

## Correcciones de pruebas existentes

- Lite `api/test_frontend.py`: las filas Excel tenían 16 valores frente a 17
  encabezados; faltaba la columna `codigo_barras`. Desplazaba nombre/tipo/precio/IVA.
  Se agregó la celda vacía y diagnóstico de preview a la aserción; se mantienen las
  comprobaciones de importación, variantes y atributos.
- Restaurante `api/test_ticket_printing.py` y `api/test_order_note_printing.py`:
  `Environment.overlay()` comparte globals con el entorno original. Se copia el
  diccionario antes de asignar el mock, sin debilitar las aserciones. Esto resuelve
  el error del reporte que intentaba imprimir con un mock de otra prueba.
- Front `invoicing.component.spec.ts` y `invoicing.behavior.spec.ts`: escenarios
  válidos ahora declaran configuración lista, certificado vigente y plan activo.
  La prueba de selección usa `getEmissionBlockMessage` con `callThrough`, conservando
  validación real del servicio, en vez de simular el antiguo control del plan.
- Front `pos-caja.behavior.spec.ts`: mock del nuevo control compartido, conservando
  bloqueos por plan/terminal y todas las aserciones de emisión, caja y payload.
- Front `pos-caja.component.spec.ts`: registra explícitamente `faTrash`. Antes,
  según el orden aleatorio, otra prueba podía registrar el icono y ocultar la
  dependencia ausente del fixture. El descuento compacto muestra «−$2.00» sin
  prefijo «Desc.»; la aserción comprueba ese importe, el total $8.00 y ambos
  valores del carrito, conservando la regla de descuento sin fijar el prefijo visual.

## Ejecución backend

Desde `/home/frappe/frappe-bench`:

```bash
redis-cli -p 13000 ping
redis-cli -p 11000 ping
bench --site facturada_core_simple_test migrate
PYTHONPATH=/tmp/facturada-test-fence bench --site facturada_core_simple_test run-tests --app facturada_core
PYTHONPATH=/tmp/facturada-test-fence bench --site facturada_core_simple_test run-tests --app facturada_lite
PYTHONPATH=/tmp/facturada-test-fence bench --site facturada_core_simple_test run-tests --app facturada_restaurante
PYTHONPATH=/tmp/facturada-test-fence bench --site facturada_core_simple_test run-tests --app facturada_api
```

También se ejecutó primero el módulo focalizado de importación:

```bash
PYTHONPATH=/tmp/facturada-test-fence bench --site facturada_core_simple_test run-tests --module facturada_lite.api.test_frontend
```

| Suite final | Aprobadas | Fallas/errores |
| --- | ---: | ---: |
| Core | 74 | 0 |
| Lite | 144 | 0 |
| Restaurante | 34 | 0 |
| API | 30 | 0 |
| Total backend | 282 | 0 |

Los errores de esquema `credit_days` y Data/Small Text desaparecieron después de
migrar. La falla de importación y la contaminación Jinja se clasificaron y
corrigieron como problemas de las pruebas, no como cambios de reglas comerciales.

## Ejecución frontend

Variables locales utilizadas:

```bash
export CHROME_BIN=/home/frappe/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome
export LD_LIBRARY_PATH=/home/frappe/.cache/facturada-test-libs
```

`/tmp/facturada-codex-karma.cjs` carga `karma.conf.js` y agrega el launcher
`ChromeHeadlessNoSandbox`, basado en ChromeHeadless con `--no-sandbox` y
`--disable-dev-shm-usage`. No modifica la configuración habitual del proyecto.

```bash
npx ng test --watch=false --karma-config=/tmp/facturada-codex-karma.cjs --browsers=ChromeHeadlessNoSandbox --include=src/app/core/utils/lite-invoice-actions.spec.ts --include=src/app/core/guards/role-access.guard.spec.ts --include=src/app/core/services/company-capabilities.service.spec.ts
npx ng test --watch=false --karma-config=/tmp/facturada-codex-karma.cjs --browsers=ChromeHeadlessNoSandbox --include=src/app/pages/invoicing/*.spec.ts --include=src/app/pages/pos/pos-caja/pos-caja.behavior.spec.ts
npx ng test --watch=false --karma-config=/tmp/facturada-codex-karma.cjs --browsers=ChromeHeadlessNoSandbox
npx ng build
npx ng build --optimization=false --output-path=/tmp/facturada-codex-build
```

- Nuevas pruebas focalizadas: 53 aprobadas.
- Facturación/POS focalizadas: 63 aprobadas.
- Primera medición del checkout actual, antes de ajustes: 368 pruebas, 321 aprobadas,
  47 fallidas. Se localizaron 21 fallas adicionales respecto a la guía en fixtures
  desactualizados de facturación/POS.
- Una ejecución posterior detectó además la dependencia aleatoria del icono
  `faTrash`, corregida en el fixture de interfaz del POS.
- Resultado final completo: **421 pruebas, 395 aprobadas y 26 fallidas**. Las
  fallidas coinciden con la lista heredada de `TESTING_CODEX.md`; ninguna de las
  53 pruebas nuevas falla. Se conservan las fallas de plantilla como pendientes,
  sin deshabilitarlas ni marcar la suite global como aprobada.

## Limitaciones y pendientes

- `npx ng build` falló por DNS `EAI_AGAIN fonts.googleapis.com` al incrustar Poppins.
  La compilación sin optimización terminó correctamente: bundle inicial 4,74 MB,
  con aviso por superar el presupuesto de advertencia de 4 MB. Esto no equivale a
  validar la compilación optimizada de producción.
- Prettier está bloqueado por la configuración existente: el plugin Tailwind
  intenta cargar DaisyUI ESM mediante `require`, produciendo `ERR_REQUIRE_ESM`.
  No se alteraron dependencias/configuración para ocultarlo. `git diff --check`
  pasó sobre los repositorios afectados.
- Los E2E existentes fueron revisados: buscan menús Base/Auth y tabla demo con
  usuarios john/emma. No son aceptación válida de los flujos actuales. No se
  ejecutó Playwright ni se afirma un recorrido integral front/backend.
- Las 26 pruebas heredadas enumeradas en la guía siguen pendientes de preparar
  providers/inputs/mocks; sus resultados no demuestran fallas de producción.
- No se encontraron regresiones de negocio en las fallas investigadas. La suite
  no demuestra ausencia de errores en flujos sin cobertura ni certifica producción.

Logs locales: `/tmp/facturada-codex-{core,api}.log`,
`/tmp/facturada-codex-{lite,restaurante}-final.log`,
`/tmp/facturada-codex-front-{baseline,focused-final,updated,final}.log`,
`/tmp/facturada-codex-build{,-offline}.log` y
`/tmp/facturada-codex-migrate.log`.
