# Pruebas de migración Restaurante → FacturADA

Fecha: 2026-10-29. Resultado de la primera revisión, antes de mover la carga al Desk.
Los comandos/configuración de carga Angular de este reporte fueron sustituidos.
Estado y comandos actuales: [PRUEBAS_MIGRACION_DESK_2026-10-29.md](PRUEBAS_MIGRACION_DESK_2026-10-29.md).
Datos sintéticos; ninguna empresa real exportada/importada.

## Resultados

| Verificación | Resultado |
|---|---|
| Suite Lite | 226 OK, incluye 37 de paquete/exportador y 24 de integración |
| Suite Restaurante | 59 OK |
| Angular completo | 509 ejecutadas: 483 OK, 26 fallas heredadas de plantillas |
| Playwright migración | 3 OK, escritorio 1280 px y móvil 375 px |
| Build sin optimización | OK; advertencia de tamaño inicial 4,78 MB sobre presupuesto 4 MB |

Las suites Core y API no se repitieron. No se validó el build optimizado de
producción ni una transferencia entre sitios reales. Navegador con API simulada:
comprueba revisión/confirmación, bloqueo ante errores y distribución responsive;
no equivale a una importación real completa. Las 6 pruebas unitarias nuevas del
front pasan; las 26 fallas ya estaban documentadas antes de este cambio.

## Cobertura backend

Aislamiento por empresa, permisos, RUC/destino, límites ZIP, hashes, rutas y
secretos; relaciones, totales, formas de pago, duplicados fiscales; precisión de
stock, productos inactivos, transacción y rollback; confirmación idempotente,
procedencia e inmutabilidad; órdenes/subcuentas/facturas/NC/caja, docstatus,
contadores heredados, adjuntos locales y descarga PDF/XML. Exportador Legacy
cargado como módulo puro, sin instalar restaurante_app en el sitio de pruebas.

Solo se migró el esquema de facturada_core_simple_test. FrappeTestCase/savepoints
revierten los datos de prueba. Se bloquearon HTTP/SMTP reales con el arnés temporal
`/tmp/facturada-legacy-tests-fence/sitecustomize.py`; llamadas esperadas simuladas.

## Comandos usados

Desde el bench, con el bloqueo HTTP/SMTP descrito activo:

```bash
PYTHONPATH=/tmp/facturada-legacy-tests-fence bench --site facturada_core_simple_test run-tests --app facturada_lite
PYTHONPATH=/tmp/facturada-legacy-tests-fence bench --site facturada_core_simple_test run-tests --app facturada_restaurante
```

Módulos focalizados: facturada_lite.api.test_legacy_transfer y
facturada_lite.api.test_legacy_import (`run-tests --module ...`). El arnés de /tmp
es temporal; antes de repetir hay que restaurar bloqueo equivalente según
TESTING_CODEX.md, no ejecutar contra otro sitio ni proveedor real.

Desde el frontend:

```bash
npx ng build --optimization=false --output-path=/tmp/facturada-legacy-build
CHROME_BIN=$HOME/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome \
LD_LIBRARY_PATH=$HOME/.cache/facturada-test-libs \
npx playwright test --config=playwright.migration.config.ts
```

Karma completo usó ChromeHeadlessNoSandbox y configuración temporal basada en
karma.conf.js, con --watch=false. El servidor E2E escucha 127.0.0.1:4218 y devuelve
503 para API/socket, sin proxy al backend. No usarlo para producción.

## Evidencia local temporal

- /tmp/facturada-legacy-lite-suite-final.log
- /tmp/facturada-legacy-restaurante-suite-final.log
- /tmp/facturada-legacy-import-tests.log
- /tmp/facturada-legacy-angular-full.log
- /tmp/facturada-migration-browser-final.log
- /tmp/facturada-legacy-build-final.log
- /tmp/facturada-migration-1280.png y /tmp/facturada-migration-375.png

## Pendientes de entrega

Publicar código, ejecutar migrate en el destino dentro de la ventana autorizada,
y probar el ZIP de una empresa elegida por el usuario. Revisar advertencias y
contadores antes de comenzar a facturar. No se hizo push ni despliegue en esta
sesión. Guía: docs/MIGRACION_RESTAURANTE.md y
apps/facturada_lite/docs/TRANSFERENCIA_RESTAURANTE.md en el backend.
