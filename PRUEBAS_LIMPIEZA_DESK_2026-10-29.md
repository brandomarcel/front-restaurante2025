# Limpieza de documentos de Pruebas por empresa

Fecha: 2026-10-29. Se creó el botón, no se ejecutó borrado de ninguna empresa real.

| Verificación | Resultado |
|---|---|
| Core completo | 79 OK |
| Lite completo | 251 OK, incluye 13 nuevas de limpieza |
| Navegador Desk, Frappe/API simulados | 6 OK: 3 limpieza y 3 migración |

## Cobertura nueva

Selección por negocio + environment=Pruebas; preview no escribe; facturas/NC/guías
con hijos; Producción y otras empresas intactas; permisos de superadministración;
frase obligatoria y revisión obsoleta; NC de Producción que referencia factura de
Pruebas bloquea; cobros y referencias Data de stock bloquean; orígenes protegidos;
clave de Producción mal etiquetada como Pruebas; fallo parcial revierte; documento
ocupado no se borra; ausencia de candidatos; adjuntos diferidos al commit y
metadata restaurable por rollback, sin eliminar físicamente archivos de pruebas.
Auditoría en negocio, sin tocar secuencias ni consumo del plan.

Navegador ejecuta el JS real de Lite con jQuery y un arnés de las interfaces
Frappe, sin conectar al Desk real: frase antes de ejecutar, doble clic, bloqueo
por vínculos y ausencia de botón para usuarios sin System Manager. La migración
mantiene sus tres pruebas anteriores. No hay código nuevo de Angular; no se
repitieron su build/Karma, Restaurante ni API.

## Ejecución

Desde el Bench, con el bloqueo de HTTP/SMTP de TESTING_CODEX.md activo:

```bash
PYTHONPATH=/tmp/facturada-legacy-tests-fence bench --site facturada_core_simple_test run-tests --app facturada_core
PYTHONPATH=/tmp/facturada-legacy-tests-fence bench --site facturada_core_simple_test run-tests --app facturada_lite
```

Solo datos ficticios, FrappeTestCase/savepoints y rollback. El arnés /tmp es temporal;
restaurar bloqueo equivalente antes de otra ejecución. No hay llamadas al proveedor,
SRI ni correo real. Ningún cambio de esquema ni migración adicional.

Desde frontend, CHROME_BIN/LD_LIBRARY_PATH según TESTING_CODEX.md:

```bash
npx playwright test --config=playwright.desk-migration.config.ts
```

Logs locales: /tmp/facturada-cleanup-core-suite.log,
/tmp/facturada-cleanup-lite-suite.log, /tmp/facturada-cleanup-browser.log.
`git diff --check` y sintaxis Python/JS verificadas.

## Límites y entrega

Borrado total o nada: documentos con operaciones vinculadas no se desvinculan.
No es un reset operativo, de stock, cupos ni secuencias. Archivos físicos se borran
tras commit; los errores de disco se registran para revisión/reintento, sin fingir
rollback de una transacción ya confirmada. No se hizo push/despliegue. Actualizar
Core/Lite y limpiar cache en el sitio destinatario para ver el botón.
Guía: apps/facturada_lite/docs/LIMPIEZA_PRUEBAS_DESK.md.
