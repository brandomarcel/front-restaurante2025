# Validación FacturADA — 10/11/2026

## Resultados finales

| Verificación | Resultado |
|---|---|
| Angular completo | **568: 548 aprobadas / 20 fallas heredadas** |
| Core completo | **94 OK** |
| Lite completo | **269 OK** |
| Restaurante completo | **77 OK** |
| API externa completa | **32 OK** |
| Login compilado, cuatro tamaños/temas | **16 OK** |
| Asistentes Desk con Frappe/API simulados | **10 OK** |
| Build optimizado de producción | **OK**, 2,57 MB inicial / 582,99 kB de transferencia estimada |
| Lint | **19 problemas heredados: 18 errores y 1 advertencia** |

Backend: **472 aprobadas**. Navegador: **26 aprobadas**.
Se añadieron **55 pruebas unitarias/integración** (25 frontend + 30 backend),
y el arnés de planes pasó de un caso a cuatro: **3 casos netos nuevos de navegador**.
Los casos nuevos ya están incluidos en los totales; no sumarlos dos veces.

No se cambió lógica de negocio para hacer pasar pruebas. Se actualizaron tests
que todavía esperaban el contrato anterior a los filtros agrupados y al rediseño
de suscripciones. Las suites Angular y lint todavía no están completamente verdes.

## Pruebas creadas y modificadas

Frontend, 25 nuevas:

- `src/app/shared/components/list-filter-bar/list-filter-bar.component.spec.ts` (6):
  estado sin recarga redundante, cero visible/conteo ausente, errores en rojo,
  atajos y limpieza, personalizado, rango invertido sin emisión, proyección y fecha oculta.
- `src/app/shared/utils/list-query.spec.ts` (6): lectura/normalización de parámetros,
  búsqueda limitada, extras permitidos, replaceUrl y no navegar sin cambios; rangos
  locales con cambio de año y febrero bisiesto; enlaces antiguos y grupos electrónicos.
- `src/app/pages/invoice-detail-page/sri-annulment-dialog/sri-annulment-dialog.component.spec.ts`
  (4): confirmación/motivo/fecha, «Otro» con detalle, payload, doble envío y Escape
  mientras guarda, inventario/origen y recuperación tras error del servicio.
- `src/app/pages/company/plan-overview/plan-overview.component.spec.ts` (4): aviso
  de vencimiento en 0/1/30/31 días, plan inactivo/programado, historial de más de
  cinco, monto positivo, WhatsApp con negocio/RUC/plan y error recuperable.
- `src/app/pages/invoices/invoices.component.spec.ts` (+2): URL antigua restaura
  grupo/búsqueda/fechas/página antes de consultar; cambio de rango reinicia página
  y conserva conteos del servidor. Expectativa anterior de nueve estados técnicos
  reemplazada por los cuatro grupos documentados, conservando las otras aserciones.
- `src/app/pages/invoice-detail-page/invoice-detail-page.component.spec.ts` (+2):
  elegibilidad del backend, motivo restringido por permiso, anulación registrada y fecha.
- `src/app/services/invoices.service.spec.ts` (+1): POST, nombres del payload,
  confirmación explícita, contexto REQUIRE_AUTH y respuesta normalizada.
- Se ajustaron los specs existentes de NC y Guías al contrato de grupos y el del
  dashboard al enlace `con-error` con fechas del mes, usando reloj simulado.

Backend, 30 nuevas:

- Core `facturada_core/api/test_subscriptions.py` (11): renovación ahora, cuota
  nueva/pago/uso anterior, programación/reprogramación y cancelación, cambio sin
  perder fechas/usados, cuota insuficiente, validaciones y System Manager,
  programación inválida, tarea diaria idempotente/vencimiento, historial y ajustes,
  resumen sin notas/referencias internas, consumo desde renovación, catálogo
  editado/inactivo/condiciones y matriz de `billing.void`.
- Lite `facturada_lite/api/test_invoice_annulment.py` (9): validación explícita,
  autorización por rol/asignación, auditoría e identidad fiscal, segundo intento
  sin devolver stock dos veces, bloqueos del ciclo de vida/NC/abono/origen protegido,
  devolución de la factura original reemplazada, producto inactivo y movimientos
  de orden/nota POS sin tocar. Movimientos y consultas reales sobre fixtures.
- Lite `facturada_lite/api/test_list_filters.py` (7): búsqueda antes de paginar,
  negocio, comodines/comillas literales, fechas/grupos/conteos, anulación por NC
  total/docstatus fuera de Autorizadas, búsqueda por factura original, guías por
  transportista/placa/destinatario y paginación de notas POS.
- Restaurante `facturada_restaurante/api/test_order_list_filters.py` (3): búsqueda
  por cliente/ID/alias y comodines literales, tipo fiscal, día completo/rango
  inválido, paginación/conteos, negocio y `mine`.
- Se actualizó `test_invoice_credit_summary.py`: los wrappers ahora pasan también
  `search`, `from_date` y `to_date`; se conserva la comprobación de tipo antes de paginar.

Navegador:

- `tests-e2e/desk-plans.spec.ts`: cuatro casos actuales en vez del antiguo botón
  «Aplicar plan»: renovar hoy/al terminar, cambiar plan y anular programado con motivo;
  vista del programado, catálogo por GET y acciones por POST. El mock devuelve 403
  ante un método incorrecto. La renovación/cambio conserva negocio y condiciones en el payload.
- Login: 16 casos existentes sobre el **build optimizado del 10/11**; desktop,
  tablet, móvil claro y oscuro. `playwright.auth.config.ts` apunta al build y salida actuales.
- Desk: se conservan los tres casos de migración y los tres de limpieza, con revisión,
  confirmación, permisos y bloqueo de doble clic. Total 10.

## Ejecución y aislamiento

Sitio único: `facturada_core_simple_test`. Redis 13000 y 11000 respondieron PONG.
Se ejecutó migrate exclusivamente allí para los campos nuevos de anulación y planes.
Las pruebas usan FrappeTestCase/savepoints con rollback; los snapshots para listas
no ejecutan hooks operativos. No se emitieron comprobantes ni se consultó al SRI.

Proveedor y correo simulados; además, el `sitecustomize.py` temporal bloquea
`requests.adapters.HTTPAdapter.send`, `smtplib.SMTP.sendmail` y `send_message`.
Las pruebas existentes de QZ generan claves solo en memoria y simulan la escritura
al site_config. Los mensajes de generación de certificado en el log no significan
que se haya generado o reemplazado uno real. No se llamó a una impresora física.

Frappe omite `only_for` bajo `in_test`. Los casos negativos de System Manager
usan `patch.dict(frappe.local.flags, {'in_test': False})` solo al comprobar permisos,
y restauran el valor al salir. No se simuló el resultado de esa autorización.

Login y Desk interceptan sus APIs; el arnés no deja salir peticiones a producción.
El servidor estático solo sirve localmente en 127.0.0.1:4228. Desk es un arnés
Frappe simulado, no una sesión integral de un sitio real. Para compilar se permitió
la descarga de fuentes públicas.

Comandos desde el frontend, con CHROME_BIN y LD_LIBRARY_PATH de TESTING_CODEX.md:

```bash
npx ng test --watch=false --karma-config=/tmp/facturada-legacy-karma.cjs --browsers=ChromeHeadlessNoSandbox
npm run lint
npm run build -- --output-path=/tmp/facturada-2026-11-10-production
npx playwright test --config=playwright.auth.config.ts
npx playwright test --config=playwright.desk-migration.config.ts
```

Backend desde `/home/frappe/frappe-bench`, secuencialmente:

```bash
PYTHONPATH=/tmp/facturada-2026-11-10-fence bench --site facturada_core_simple_test migrate
PYTHONPATH=/tmp/facturada-2026-11-10-fence bench --site facturada_core_simple_test run-tests --app facturada_core
PYTHONPATH=/tmp/facturada-2026-11-10-fence bench --site facturada_core_simple_test run-tests --app facturada_lite
PYTHONPATH=/tmp/facturada-2026-11-10-fence bench --site facturada_core_simple_test run-tests --app facturada_restaurante
PYTHONPATH=/tmp/facturada-2026-11-10-fence bench --site facturada_core_simple_test run-tests --app facturada_api
```

## Fallas y límites

- Angular inicial no compilaba los specs de estados técnicos tras el cambio de contrato.
  Se actualizaron las expectativas al comportamiento documentado; compilación resuelta.
  Lite inicial: 252 OK / 1 expectativa antigua del wrapper; corregida en el spec.
  El arnés Desk antiguo también esperaba una acción retirada; fue actualizado.
- **Sin regresiones nuevas observadas en la ejecución final.** Angular mantiene las
  20 fallas de fixtures/plantilla de la línea base: AppComponent (3), AperturaCaja,
  CloseCaja, DashboardComponent, Error404, Error500, Layout, Navbar, OrderCard,
  OrderKitchenCard, OrderModal, ProfileMenu, RetiroCaja, TableAction, Table,
  TableFooter, TableRow y Users. Principalmente providers ausentes y expectativas
  de la plantilla anterior. No se desactivaron ni marcaron como omitidas.
- Lint conserva 18 errores y una advertencia, sin incremento. Build presenta las
  cuatro advertencias conocidas por selectores `0%`/`5%`.
- No equivale a cobertura completa: quedan devolución neta con entradas previas y
  múltiples bodegas/fallback, reportes tras anulación, plantilla completa del detalle
  SRI con auditoría, alta de suscripción sin previa, aislamiento de fallos del scheduler,
  sincronización Platform/Registro y consumo sin movimiento extra; pruebas propias
  de las listas de Órdenes/Notas de venta y E2E autenticado de cada rol/lista.
- Impresión USB/red, confianza QZ, corte/tildes y operación real con dos pestañas
  siguen pendientes de hardware. No se hicieron emisión, correo, cobro, borrado
  administrativo real, commits, push ni despliegue.

## Evidencia y documentación

Logs en `/tmp/facturada-2026-11-10-`: `migrate.log`, `angular-baseline.log`,
`angular-current.log`, **`angular-final.log`**, `core-baseline.log`, **`core.log`**,
`lite-baseline.log`, **`lite.log`**, **`restaurante.log`**, **`api.log`**,
`subscriptions.log`, `annulment.log`, `list-filters.log`, **`auth.log`**,
`desk-baseline.log`, **`desk.log`**, `lint.log`, **`lint-final.log`**, **`build.log`**.
Los logs iniciales/focalizados pueden conservar fallas de fixtures corregidas;
las suites completas finales son la referencia de los resultados.

Actualizados `TESTING_CODEX.md`, `ESTADO.md` del front y los estados de Core,
Lite, Restaurante y API. Sin cambios de contratos ni arquitectura de la aplicación.
