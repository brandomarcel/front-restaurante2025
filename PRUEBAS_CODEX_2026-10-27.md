# Pruebas FacturADA — 2026-10-27

## Alcance y condiciones

Se leyó TESTING_CODEX.md y la documentación de Core/Lite/Restaurante/API. Único
sitio utilizado: `facturada_core_simple_test`. Redis respondió PONG en 13000/11000.
Se migró exclusivamente ese sitio para sincronizar recetas y campos recientes.
No se ejecutaron workers, emisiones reales, correos, commits ni despliegues.
Se conservaron las modificaciones de implementación del usuario.

Las suites usan sus mocks de proveedor. Adicionalmente se cargó un bloqueo de
transporte Requests/SMTP real mediante `PYTHONPATH=/tmp/facturada-tests-20261027-fence`.
No apareció una activación de ese bloqueo en los logs de las suites completas.
Las pruebas nuevas de base usan FrappeTestCase y savepoint/rollback; no crean datos
comerciales permanentes. La migración sí actualiza los metadatos del sitio aislado.

## Pruebas creadas/modificadas

- `src/app/pages/products/products.behavior.spec.ts`: cuatro pruebas nuevas de
  carga/edición y eliminación de receta, cantidades en payload, insumo con stock
  obligatorio, exclusión por feature y selectores sin insumos duplicados. Mock
  `getRecipe` incorporado; sin HTTP real. Módulo focalizado inicial: 18 aprobadas.
  Durante la ejecución entró el contrato de merma (`waste_pct`) e insumo quitable
  (`removable`): se completaron los fixtures con esos campos y se comprobó su
  conservación en el payload, además de las cantidades, en la suite final.
- `src/app/pages/apertura-caja/apertura-caja.behavior.spec.ts`: mock actualizado de
  `getTerminalCashHolder`, ausente tras el cambio reciente. Una prueba nueva
  verifica bloqueo con otro usuario y ausencia de bloqueo para el mismo usuario.
  Módulo completo: 7 aprobadas. La primera ejecución global se interrumpió con un
  error asíncrono por ese mock ausente; la ejecución final ya termina completa.
- Backend Restaurante `api/test_recipe_inventory.py`: nueve pruebas nuevas con
  validación y movimientos reales de base: consumo fraccionario, ingrediente
  compartido, repetición sin duplicar, cancelación/restauración, stock insuficiente,
  factura posterior sin segunda salida, insumos de otro negocio rechazados,
  cantidades/duplicados inválidos, plato sin stock propio, insumo no vendible y
  convivencia con productos normales. Solo se simula la habilitación de licencia;
  validaciones de documentos y movimientos de stock son reales.

Total nuevo: 14 pruebas (5 Angular y 9 backend). No se modificó lógica de producción.

## Ejecución y resultados

Desde el frontend, con:

```bash
export CHROME_BIN=/home/frappe/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome
export LD_LIBRARY_PATH=/home/frappe/.cache/facturada-test-libs
```

El archivo temporal `/tmp/facturada-tests-20261027-karma.cjs` carga karma.conf.js y
agrega ChromeHeadlessNoSandbox (`--no-sandbox`, `--disable-dev-shm-usage`).

```bash
npx ng test --watch=false --karma-config=/tmp/facturada-tests-20261027-karma.cjs --browsers=ChromeHeadlessNoSandbox --include=src/app/pages/products/products.behavior.spec.ts --include=src/app/pages/invoicing/*.spec.ts --include=src/app/pages/pos/pos-caja/*.spec.ts
npx ng test --watch=false --karma-config=/tmp/facturada-tests-20261027-karma.cjs --browsers=ChromeHeadlessNoSandbox --include=src/app/pages/products/products.behavior.spec.ts
npx ng test --watch=false --karma-config=/tmp/facturada-tests-20261027-karma.cjs --browsers=ChromeHeadlessNoSandbox --include=src/app/pages/apertura-caja/apertura-caja.behavior.spec.ts
npx ng test --watch=false --karma-config=/tmp/facturada-tests-20261027-karma.cjs --browsers=ChromeHeadlessNoSandbox
npx ng build
npx ng build --optimization=false --output-path=/tmp/facturada-tests-20261027-build
```

| Ejecución | Aprobadas | Fallidas |
| --- | ---: | ---: |
| Front focalizado inicial (productos/facturación/POS) | 99 | 0 |
| Productos, tras agregar recetas | 18 | 0 |
| Apertura, tras actualizar mock/agregar caso | 7 | 0 |
| Front completo final | 400 | 26 heredadas |

Desde `/home/frappe/frappe-bench`:

```bash
bench --site facturada_core_simple_test migrate
PYTHONPATH=/tmp/facturada-tests-20261027-fence bench --site facturada_core_simple_test run-tests --module facturada_restaurante.api.test_recipe_inventory
PYTHONPATH=/tmp/facturada-tests-20261027-fence bench --site facturada_core_simple_test run-tests --app facturada_core
PYTHONPATH=/tmp/facturada-tests-20261027-fence bench --site facturada_core_simple_test run-tests --app facturada_lite
PYTHONPATH=/tmp/facturada-tests-20261027-fence bench --site facturada_core_simple_test run-tests --app facturada_restaurante
PYTHONPATH=/tmp/facturada-tests-20261027-fence bench --site facturada_core_simple_test run-tests --app facturada_api
```

| Suite backend | Aprobadas | Fallas/errores |
| --- | ---: | ---: |
| Core | 75 | 0 |
| Lite | 144 | 0 |
| Restaurante, incluidas recetas | 43 | 0 |
| API | 30 | 0 |
| Total backend | 292 | 0 |

Recetas focalizadas: 9 aprobadas. Se inspeccionaron los resultados de unittest,
no solo los códigos de salida de Bench.

## Fallas y límites

- Regresiones nuevas de negocio: ninguna detectada por las pruebas ejecutadas.
- Angular: las 26 fallas finales pertenecen a la lista heredada documentada en
  TESTING_CODEX.md; no se deshabilitaron ni se presenta la suite completa como verde.
- Un mock desactualizado de apertura causó error asíncrono en la primera ejecución;
  se completó el contrato del mock y se repitió la suite completa.
- Build normal: falla por `EAI_AGAIN fonts.googleapis.com` al incrustar Poppins.
- Build sin optimización: aprobado. Bundle inicial 4,78 MB; aviso al superar 4 MB.
  No equivale a validar el build optimizado de producción.
- PWA: verificación estática del artefacto generado: ngsw.json, ngsw-worker.js,
  manifest standalone y sus tres iconos presentes. Cero dataGroups y sin rutas
  API/Socket.IO en hashTable. No demuestra instalación/actualización real en móvil.
- No se ejecutaron Playwright ni recorridos manuales front/backend. Los E2E de
  plantilla no representan los flujos actuales.
- Hubo cambios concurrentes durante las primeras pasadas (modificadores de
  ingredientes, merma y carrito). Se repitieron migración, suites Lite/Restaurante,
  build y Angular sobre ese nuevo estado. La instantánea de fuentes previa a la
  última pasada está en `/tmp/facturada-tests-20261027-final-snapshot.json`;
  los fixtures de productos se ajustaron después al contrato nuevo. La primera
  compilación de tests sobre ese contrato falló por campos faltantes en esos
  fixtures; no era un error de tipado de la aplicación.
- Límite conocido, descrito en ESTADO.md de Lite: las recetas descuentan insumos en
  órdenes de restaurante; venta directa de platos en factura/POS genérico Lite aún
  no integra ese consumo. La prueba de factura posterior cubre una orden con salida
  previa, no una venta directa sin orden. No se alteró ni se dio por resuelto ese límite.
- Quedan sin cobertura específica de sus escenarios los modificadores y la merma
  del backend, aunque pasen las suites existentes y la serialización de sus campos
  en el formulario. No se presenta el consumo base de recetas como prueba de
  consumo con merma o ingredientes retirados.
- Quedan sin cobertura nueva los otros cambios recientes señalados en los estados:
  instalación/actualización PWA, Wake Lock, flujos de cocina, permisos de usuarios y
  nuevos rangos/atribución de cobros. Sus suites existentes no sustituyen pruebas
  específicas de cada cambio.

## Evidencia local

Logs bajo `/tmp/facturada-tests-20261027-*.log`: migrate/migrate-final, core, lite/lite-final, restaurante/restaurante-final,
api, recipes, front-focused, product-recipes, cash-focused, front (intento inicial),
front-final (resultado completo), build y build-offline.

`git diff --check` sin errores en los repositorios afectados.
