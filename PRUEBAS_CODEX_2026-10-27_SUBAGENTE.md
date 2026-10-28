# Validación del subagente de pruebas — 2026-10-27

## Alcance y protección

Se siguieron AGENTS.md y TESTING_CODEX.md. Único sitio backend utilizado:
`facturada_core_simple_test`. Redis cache/queue respondió PONG. Se comprobaron en
solo lectura los metadatos de producto, líneas de receta e ítems de orden y ya
coincidían con los JSON: no se ejecutó ninguna migración.

Las suites usan mocks de proveedor y una barrera temporal adicional de Requests
HTTPAdapter.send y SMTP.sendmail/send_message. No se activó la barrera en las
suites finales. No hubo SRI/proveedor ni correos reales, workers nuevos, commits,
push o despliegues. Los cambios del subagente se limitaron a specs y este reporte.
Las pruebas con base conservan FrappeTestCase y rollback.

## Pruebas trasladadas y añadidas por este subagente

- Productos `products.behavior.spec.ts`: cuatro casos del editor de recetas ya no
  compilaban porque el editor se movió a kitchen-supplies. Se retiraron de ese
  componente y se trasladó su cobertura a los propietarios actuales siguientes;
  se conservaron las demás reglas de catálogo. No se restauró UI retirada ni se
  debilitaron validaciones de negocio para conseguir una suite verde.
- `kitchen-supplies/recipes.component.spec.ts`: seis casos de edición sin mutar el
  original, cantidades/merma/modificador enviados al servicio, eliminación con
  confirmación, selectores sin duplicados/unidades, rechazo de cantidades inválidas,
  módulos requeridos y porciones limitadas por el insumo disponible.
- `services/kitchen-supplies.service.spec.ts`: cuatro casos de payload de insumo
  (stock obligatorio), existencia inicial mediante Entrada separada, conservación
  de un fallo de movimiento sin duplicar el producto, alta/quita de receta y
  bodega persistida descartada si no pertenece a las opciones actuales.
- `services/taxes.service.spec.ts`: dos casos que usan el endpoint Lite tanto en
  restaurante como en Lite, negocio activo, REQUIRE_AUTH y normalización de IVA.
- `shared/utils/inventory.utils.spec.ts`: seis casos de porciones, dato ausente,
  agotado/cupo bajo, límite de cantidad, etiquetas y contrato de agrupadores.
- `inventory-nav.component.spec.ts`: el mock genérico ya no declara restaurante
  activo por accidente; un caso nuevo verifica Insumos/Recetas cuando corresponde.
- Restaurante `api/test_recipe_inventory.py`: tres casos nuevos con base real:
  consumo con merma y cancelación exacta, ingrediente quitable por fila sin alterar
  las filas normales, rechazo de retiro no autorizado y consumo del ingrediente
  obligatorio aunque llegue solicitado como retirado.

Son 19 casos frontend nuevos/reubicados en los propietarios actuales y tres
backend nuevos; sustituyen cuatro casos obsoletos de Productos. Otros trabajos
concurrentes agregaron más specs, distinguidos en los resultados finales.

## Comandos y resultados

Directorio privado de evidencia: /tmp/facturada-subagent-tests-20261027-231141

Karma usa el archivo temporal `karma.cjs` de esa carpeta (carga karma.conf.js y
agrega ChromeHeadlessNoSandbox con --no-sandbox y --disable-dev-shm-usage).

```bash
export CHROME_BIN=/home/frappe/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome
export LD_LIBRARY_PATH=/home/frappe/.cache/facturada-test-libs
```

Desde el frontend, se ejecutó primero el conjunto focalizado de Productos,
Recetas, KitchenSuppliesService, TaxesService, inventory.utils e inventory-nav:
35 pruebas aprobadas antes de añadir el último caso de habilitación, también
incluido en las suites completas posteriores.

```bash
npx ng test --watch=false --karma-config=/tmp/facturada-subagent-tests-20261027-231141/karma.cjs --browsers=ChromeHeadlessNoSandbox --include=src/app/pages/products/products.behavior.spec.ts --include=src/app/pages/kitchen-supplies/recipes.component.spec.ts --include=src/app/services/kitchen-supplies.service.spec.ts --include=src/app/services/taxes.service.spec.ts --include=src/app/shared/utils/inventory.utils.spec.ts --include=src/app/shared/components/inventory-nav/inventory-nav.component.spec.ts
npx ng test --watch=false --karma-config=/tmp/facturada-subagent-tests-20261027-231141/karma.cjs --browsers=ChromeHeadlessNoSandbox
npx ng build
npx ng build --optimization=false --output-path=/tmp/facturada-subagent-tests-20261027-231141/build-cut
```

Desde /home/frappe/frappe-bench:

```bash
PYTHONPATH=/tmp/facturada-subagent-tests-20261027-231141/fence bench --site facturada_core_simple_test run-tests --app facturada_core
PYTHONPATH=/tmp/facturada-subagent-tests-20261027-231141/fence bench --site facturada_core_simple_test run-tests --app facturada_lite
PYTHONPATH=/tmp/facturada-subagent-tests-20261027-231141/fence bench --site facturada_core_simple_test run-tests --module facturada_restaurante.api.test_recipe_inventory
PYTHONPATH=/tmp/facturada-subagent-tests-20261027-231141/fence bench --site facturada_core_simple_test run-tests --app facturada_restaurante
PYTHONPATH=/tmp/facturada-subagent-tests-20261027-231141/fence bench --site facturada_core_simple_test run-tests --app facturada_api
```

El módulo de recetas focalizado pasó 12 pruebas. Se inspeccionaron los resúmenes
reales de unittest, además de los códigos de salida de Bench.

## Resultado final y comparación

| Capa | Aprobadas | Fallas/errores |
| --- | ---: | ---: |
| Angular completo, último corte | 450 de 476 | 26 heredadas |
| Core | 75 | 0 |
| Lite | 162 | 0 |
| Restaurante | 54 | 0 |
| API | 30 | 0 |
| Total backend | 321 | 0 |

La referencia inicial era Angular 400/426 y backend 292/292. El aumento incluye
19 casos frontend nuevos/reubicados del subagente (menos cuatro obsoletos, neto
15), sus tres casos backend y specs añadidos por otros trabajos concurrentes.
No se atribuye al subagente la autoría de esos otros specs. La última ejecución
Angular tiene las mismas 26 fallas de plantilla y ningún error global afterAll.

El build sin optimización terminó correctamente: bundle inicial 4,78 MB, con aviso
por superar el presupuesto de advertencia de 4 MB. No equivale a validar el build
optimizado de producción, bloqueado por DNS. `git diff --check` pasó en los
repositorios con specs modificados por el subagente.

## Fallas y limitaciones

- El primer intento de Angular no compiló por los cuatro casos de recetas que
  seguían asociados a ProductsComponent. Se trasladó la cobertura; no era un error
  de compilación del código de producción.
- Build normal bloqueado por `EAI_AGAIN fonts.googleapis.com` al descargar Poppins.
  Esto se informa separado del resultado de la compilación sin optimización.
- Las fallas heredadas de plantilla siguen presentes: no se deshabilitaron pruebas.
- La impresión backend emitió advertencias CSS del parser; los casos de impresión
  y la suite correspondiente terminaron OK.
- No se ejecutó Playwright ni un recorrido integrado manual. Los E2E de plantilla
  no constituyen aceptación de los flujos actuales. Tampoco se validó instalación
  real de PWA en móvil.
- Permanecen límites conocidos de negocio, incluido el consumo de recetas de una
  venta directa Lite sin orden. No se dio por resuelto por pasar pruebas de orden
  restaurante o de factura posterior a una orden.

## Concurrencia y reproducibilidad

Se registraron hashes de TS/HTML/CSS/SCSS/Python/JSON de front y las cuatro apps en
`sources-before.json`. Hubo modificaciones ajenas en recipes.py, inventario de
Restaurante y nuevos specs mientras corrían las primeras suites. Se repitieron
Lite/Restaurante y luego Angular/build con instantáneas posteriores. Las suites
finales incluyen specs ajenos añadidos en paralelo, sin atribuir su autoría al
subagente.

`sources-final-pass-before.json`, `sources-after.json` y los archivos de diferencias
registran esa concurrencia. `frontend-cut-before.json` identifica el último corte
frontend. Los resultados corresponden a esas ejecuciones, no garantizan cambios
posteriores a su compilación. Los logs se conservan en el directorio de evidencia.

Último corte: `frontend-cut.log` ejecutó 476 pruebas (450 aprobadas, 26 heredadas).
`frontend-cut-differences.json` registró cero diferencias de fuentes durante esa
ejecución; el build correspondiente es `build-cut.log`. Backend final usa
`backend-core.log`, `backend-lite-final.log`, `backend-restaurante-stable.log` y
`backend-api.log`. No se detectaron llamadas reales de la barrera de transporte.
