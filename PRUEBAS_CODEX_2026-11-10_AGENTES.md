# Validación con tres agentes — FacturADA, 10/11/2026

> Actualización 11/11/2026: los tres defectos de esta ronda fueron corregidos por otro editor y revalidados con sus aserciones originales. Resultado vigente en [reporte del 11/11](PRUEBAS_CODEX_2026-11-11_AGENTES.md). Lo siguiente conserva la evidencia histórica del 10/11.

## Resultado

| Área | Resultado final |
|---|---|
| Angular, suite completa actual | **600: 578 OK / 22 fallas** |
| Core | **96 OK** |
| Lite | **289 OK** |
| Restaurante | **77 OK** |
| API externa | **32 OK** |
| Login, cuatro tamaños/temas | **16 OK** |
| Desk simulado | **10 OK** |
| Retenciones, escritorio/móvil oscuro | **7 OK / 3 fallas** |
| Compilación actual de producción | **OK**, 2,57 MB inicial / 583,35 kB estimados |
| Lint final | **19 heredados: 18 errores y 1 advertencia** |

Backend: **494 aprobadas**. Navegador: **36 casos, 33 OK / 3 fallas**.
Angular tiene **20 fallas heredadas + 2 defectos nuevos**. El navegador confirma
uno de esos defectos en dos tamaños y encuentra otro de interacción móvil.
Son **3 defectos reales distintos**, descritos abajo. No se omitieron pruebas ni
se relajaron aserciones para mostrar un resultado verde.

Se añadieron **64 casos** en esta ronda: 32 frontend, 22 backend y 10 de navegador.
Los nuevos ya están incluidos en las suites; no sumarlos nuevamente al total.
El reporte anterior PRUEBAS_CODEX_2026-11-10.md corresponde a la ronda previa a retenciones.

## Distribución entre agentes

- `/root/pruebas_frontend_actual`: unitarias Angular, contratos HTTP y formulario.
- `/root/pruebas_backend_actual`: único agente autorizado a ejecutar DB/bench;
  migrate y suites Core/Lite/Restaurante/API **secuenciales** en el mismo sitio aislado.
- `/root/pruebas_navegador_actual`: build, lint y Playwright con APIs simuladas.
- Coordinador: revisión de resultados, comprobación de contratos/captura y documentación.

El equipo modificó pruebas, configuraciones Playwright y documentación. Los
cambios de lógica de aplicación presentes en el workspace pertenecen al trabajo
concurrente; no se alteró runtime para hacer pasar los tests.

## Defectos confirmados, pendientes de corregir

1. **Reabrir un borrador del concepto 332 al 0 % pierde el porcentaje.**
   `src/app/pages/withholding-form/withholding-form.component.ts:250` usa
   `Number(row?.porcentaje) || null`: convierte cero en null. El formulario muestra
   «escribe el porcentaje» y requiere volver a completarlo. La prueba Angular
   reproduce la pérdida; Playwright espera `0.00` y recibe vacío tanto en desktop
   como en móvil. La creación de un nuevo renglón al 0 % sí pasa: el problema es
   restaurar el borrador guardado.
2. **Fechas imposibles se normalizan en el cálculo de días.**
   `src/app/core/utils/withholding.ts:12`, `daysBetween`, usa Date.UTC sin comprobar
   el calendario resultante. Por ejemplo, de `2026-02-30` a `2026-03-02` devuelve
   cero, cuando su contrato exige null para una fecha inválida. Igual ocurre con mes 13.
   Es un defecto de la utilidad frontend; no se ha demostrado con esto una emisión fiscal inválida.
3. **La barra inferior bloquea las acciones del documento en móvil.**
   `shared/components/document-actions/document-actions.component.ts:49` fija el
   toolbar en `bottom-0 z-40`, y `modules/layout/components/bottom-navbar/bottom-navbar.component.html:3`
   fija la navegación en `bottom-0 z-[90]`. La segunda intercepta el clic en
   «Consultar SRI». Escritorio consulta correctamente el caso SRI 70 y no ofrece
   reemitir. No se usó force click ni se ocultó la navegación para que el test pasara.
   Captura: `/tmp/facturada-parallel-withholding-sri70-mobile-dark.png`.

## Cobertura nueva

### Frontend: 32 casos, 30 OK y 2 defectos activos

- `src/app/core/utils/withholding.spec.ts` (5): días calendario/bisiesto, fechas
  inválidas, redondeo/cero y mapa de tipos de documento con compatibilidad boolean.
- `src/app/services/withholdings.service.spec.ts` (9): métodos HTTP, negocio,
  parámetros/payload, contexto de autenticación, errores y respuestas normalizadas.
- `src/app/services/lite-suppliers.service.spec.ts` (3): búsqueda y guardado del
  proveedor con su negocio y contrato de datos.
- `src/app/services/electronic-review.service.spec.ts` (+1): retención usa su método
  y nombre de parámetro, sin verificación de inexistencia exclusiva de facturas.
- `src/app/services/electronic-document-updates.service.spec.ts` (+1): DocType propio,
  detalle local del negocio tras reconexión y liberación de listeners.
- `src/app/pages/withholding-form/withholding-form.component.spec.ts` (13): catálogo,
  0 %, bases automáticas/editadas, validaciones/payload, clave conocida o proveedor
  nuevo, error/advertencia de clave, retraso, permiso/agente, secuencia y bloqueo
  durante envío; recuperación de borrador con cero conserva una expectativa fallida.

Focalizados: 38 casos, **36 OK / 2 fallas**, incluyendo seis casos existentes.
Suite inicial: 568, 548 OK / 20 heredadas. Suite final y repetición tras cambios
concurrentes: 600, **578 OK / 22 fallas**, conjunto de fallos idéntico entre ambas.

Las 20 heredadas siguen siendo: AppComponent (3), AperturaCaja, CloseCaja,
DashboardComponent, Error404, Error500, Layout, Navbar, OrderCard, OrderKitchenCard,
OrderModal, ProfileMenu, RetiroCaja, TableAction, Table, TableFooter, TableRow y Users.
Son fixtures/providers y expectativas antiguas de la plantilla; no están corregidas.

### Backend: 22 casos nuevos aprobados

- Core `facturada_core/api/test_withholding_capabilities.py` (2): billing + permiso
  + agente de retención; wildcard no evita el requisito de agente.
- Lite `facturada_lite/api/test_withholding.py` (19): cálculo de bases/IVA/valores,
  tarifas y catálogo, validación de bases/códigos/porcentajes, 0 %, catálogo editable,
  clave coincidente en proveedor/número/fecha/tipo/ambiente, proveedores únicos y
  aislados por negocio, permisos, bloqueo sin agente/secuencia, fecha al numerar,
  identidad idempotente/colisión, autorización simulada y consulta local posterior,
  43/70 sin reenviar, consulta con la clave original, retraso, filtros/conteos,
  correo optativo/deduplicado y XML con sufijo. Producción es solo un snapshot
  ficticio con proveedor simulado: consume un cupo exactamente una vez y no stock.
- Lite `facturada_lite/api/test_sandbox_cleanup.py` (+1): preview de retenciones de
  Pruebas con Producción intacta, sin borrar. Se actualizó la expectativa aditiva
  de conteos para Retenciones y Liquidaciones de compra (cero); se conservan las
  comprobaciones originales de facturas/NC/guías.

Las cuatro suites completas pasan: **96 + 289 + 77 + 32 = 494**.
El módulo de retenciones se repitió tras reforzar la aserción de no llamada al
proveedor ante 43/70: **19 OK**, ya incluidos en las 289.

### Navegador: diez casos nuevos, siete OK y tres fallas reales

`tests-e2e/withholdings.e2e.spec.ts` y `playwright.withholdings.config.ts`:
cinco escenarios × desktop 1440 y móvil oscuro 390:

- Crear proveedor desde clave, completar y emitir con totales/payload correctos: ambos OK.
- Bloqueo sin agente de retención: ambos OK.
- Lista con filtros persistidos, conteo cero y sin Anuladas: ambos OK.
- SRI 70 permite consultar y no ofrece reenviar: desktop OK; móvil bloqueado por navbar.
- Reabrir borrador 332 al 0 %: falla en ambos tamaños por porcentaje vacío.

Login 16 OK y Desk 10 OK se conservan. Estas pruebas usan aplicación compilada y
APIs completamente interceptadas; el Desk usa su arnés Frappe simulado, sin un
sitio real detrás.

## Ejecución, aislamiento y cambios concurrentes

Sitio único: `facturada_core_simple_test`. Redis 13000/11000 PONG. Solo el agente
backend ejecutó migrate y pruebas DB, de manera secuencial. Fixtures FrappeTestCase
con rollback; HTTP/SMTP bloqueados mediante sitecustomize. Proveedor, PDF y sendmail
simulados. La prueba de correo usa metadata File temporal, sin crear un XML físico.
QZ usa sus dobles existentes: no se generaron certificados reales ni se imprimió.

Durante la validación otro editor cambió Lite e incorporó liquidaciones de compra
03. Una importación intermedia tuvo IndentationError, corregido por ese editor;
la primera suite Lite además detectó un spec de conteos anterior al contrato nuevo.
Se corrigió únicamente ese spec y se repitió Lite con código estable. Sus huellas
antes, después y al cierre son idénticas:

- `/tmp/facturada-parallel-2026-11-10-back-runtime-lite-retry-before.json`
- `/tmp/facturada-parallel-2026-11-10-back-runtime-lite-retry-after.json`
- `/tmp/facturada-parallel-2026-11-10-back-runtime-final.json`

El frontend se volvió a probar tras aparecer esos cambios: mismo resultado 600/578/22.
Se compiló de nuevo en otra carpeta, conservando intacto el build de evidencia E2E:

| Artefacto | Resultado / identificación |
|---|---|
| Build probado por Playwright | `/tmp/facturada-parallel-2026-11-10-production`; 2,57 MB / 583,28 kB |
| Bundle E2E | `main-4HNKAEYO.js`; SHA-256 `d253a9ff64a4524c1f7202b344ec48846988e005d23c576013c4b273736c926d` |
| Build actual adicional | `/tmp/facturada-parallel-2026-11-10-current-production`; 2,57 MB / 583,35 kB |
| Bundle actual | `main-7TBEEMLA.js`; SHA-256 `6916f51e695a49b1db76b7590642069cc6a8366143cf84323ac1850c7512be8c` |

Service/componente/HTML de liquidaciones y routing conservaron sus huellas durante
el build adicional. En el estado inspeccionado el menú ya apuntaba a liquidaciones,
pero la ruta aún no estaba registrada; es trabajo concurrente sin validar aquí.
**Compilar no acredita navegación ni funcionamiento fiscal de SRI 03.** No se
amplió esta ronda a ese módulo, servicio Node, XSD real, XML/PDF reales, entrega de
correo ni impresoras físicas.

## Comandos y evidencia

Frontend, con CHROME_BIN y LD_LIBRARY_PATH de TESTING_CODEX.md:

```bash
npx ng test --watch=false --karma-config=/tmp/facturada-legacy-karma.cjs --browsers=ChromeHeadlessNoSandbox
npm run lint
npm run build -- --output-path=/tmp/facturada-parallel-2026-11-10-production
npx playwright test --config=playwright.auth.config.ts
npx playwright test --config=playwright.desk-migration.config.ts
npx playwright test --config=playwright.withholdings.config.ts
npm run build -- --output-path=/tmp/facturada-parallel-2026-11-10-current-production
```

Backend desde `/home/frappe/frappe-bench`, exclusivamente secuencial:

```bash
PYTHONPATH=/tmp/facturada-parallel-2026-11-10-fence bench --site facturada_core_simple_test migrate
PYTHONPATH=/tmp/facturada-parallel-2026-11-10-fence bench --site facturada_core_simple_test run-tests --app facturada_core
PYTHONPATH=/tmp/facturada-parallel-2026-11-10-fence bench --site facturada_core_simple_test run-tests --app facturada_lite
PYTHONPATH=/tmp/facturada-parallel-2026-11-10-fence bench --site facturada_core_simple_test run-tests --module facturada_lite.api.test_withholding
PYTHONPATH=/tmp/facturada-parallel-2026-11-10-fence bench --site facturada_core_simple_test run-tests --app facturada_restaurante
PYTHONPATH=/tmp/facturada-parallel-2026-11-10-fence bench --site facturada_core_simple_test run-tests --app facturada_api
```

Logs finales con prefijo `/tmp/facturada-parallel-2026-11-10-`:

- `front-current-final.log` (vigente), `front-final.log`, `front-focused.log`, `front-baseline.log`.
- `back-{migrate,core,lite,withholding-final,restaurante,api}.log`.
- `browser-{build,current-build,lint-final,auth,desk,withholdings-final}.log`.

Los logs iniciales de navegador/focalizados pueden conservar errores del arnés
(mock del plan, selectors, fixture obligatorio o spinner), corregidos sin alterar
runtime. Los logs finales conservan las fallas reales descritas.

Capturas temporales: `/tmp/facturada-parallel-withholding-desktop.png`,
`/tmp/facturada-parallel-withholding-mobile-dark.png` y
`/tmp/facturada-parallel-withholding-sri70-mobile-dark.png`.

Actualizados TESTING_CODEX.md y los estados del front/Core/Lite/Restaurante/API.
No se cambió arquitectura ni contrato funcional por este equipo. Sin llamadas al
SRI, correo/impresión/borrado reales, commits, push ni despliegue.
