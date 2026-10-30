# Validación: importación exclusivamente en Desk

2026-10-29. Sustituye el flujo de carga Angular de la primera revisión.

| Verificación | Resultado |
|---|---|
| Suite Lite completa | 234 OK |
| Integración de migración (incluida en Lite) | 32 OK: 24 anteriores y 8 nuevas |
| Asistente Desk, navegador con Frappe/API simulados | 3 OK |
| Company, plantilla real con servicios simulados | 1 OK (incluida en Angular completo) |
| Angular completo | 504: 479 OK, 25 fallas heredadas |
| Build Angular sin optimización | OK, advertencia inicial 4,78 MB / presupuesto 4 MB |

Se retiraron 5 pruebas de la pantalla Angular eliminada. Se corrigió el fixture
Company (antes fallaba por falta de providers) y comprueba que configuración ya
no ofrece importación. Las 25 fallas restantes pertenecen a la lista heredada de
TESTING_CODEX.md. Sin nuevas regresiones observadas. Build optimizado no ejecutado.
Restaurante/Core/API no se repitieron en esta revisión; no se modificó su código.

## Cobertura nueva

- System Manager/Administrator obligatorio además del permiso por negocio.
- Identificación ausente recuperada solo del nombre exacto del registro Legacy;
  ausencia no recuperable y duplicados reales muestran diagnósticos distintos.
- Autorización recuperada de XML AUTORIZADO adjunto con RUC/tipo/ambiente/serie y
  clave coincidentes; sin evidencia no se copia la clave como autorización.
- XML ajeno, firmado sin envoltura de autorización o con DTD (incluido UTF-16) no
  aporta autorización. Biblioteca estándar, sin consultas ni envíos al SRI.
- Desk: revisar antes de confirmar, confirmación explícita y protección doble clic,
  errores bloquean carga, mensajes escapados, cambio de ZIP/negocio invalida revisión.

La prueba de navegador ejecuta el JS real de Lite con jQuery real, usando un arnés
mínimo de las interfaces Dialog/call de Frappe y HTTP interceptado. No demuestra
una sesión real completa del Desk ni importa datos reales. Revisar el ZIP del
usuario sigue pendiente; no se afirmó que sus faltantes fiscales estén resueltos.

## Comandos

Desde el Bench, bloqueo HTTP/SMTP activo según TESTING_CODEX.md:

```bash
PYTHONPATH=/tmp/facturada-legacy-tests-fence bench --site facturada_core_simple_test run-tests --app facturada_lite
```

Datos ficticios, FrappeTestCase/savepoints y rollback; nada de emisión real. El
arnés /tmp es temporal: recrear bloqueo equivalente antes de futuras ejecuciones.
No hubo cambio de esquema en esta revisión.

Desde frontend, con CHROME_BIN y LD_LIBRARY_PATH definidos como TESTING_CODEX.md:

```bash
npx playwright test --config=playwright.desk-migration.config.ts
npx ng test --watch=false --karma-config=/tmp/facturada-legacy-karma.cjs --browsers=ChromeHeadlessNoSandbox
npx ng build --optimization=false --output-path=/tmp/facturada-desk-front-build
```

El launcher Karma temporal importa karma.conf.js y agrega ChromeHeadless con
--no-sandbox/--disable-dev-shm-usage. No usar estos ajustes para navegación normal.
El arnés Desk no necesita servidor ni proxy. Todas las solicitudes se interceptan.

Evidencia local: /tmp/facturada-desk-lite-suite.log,
/tmp/facturada-desk-browser.log, /tmp/facturada-desk-company-test.log,
/tmp/facturada-desk-angular-full.log y /tmp/facturada-desk-front-build.log.

Pendiente publicar código/limpiar cache del destino y retirar el Angular viejo
servido en otros ambientes. No hubo push, despliegue ni carga de empresa real.
