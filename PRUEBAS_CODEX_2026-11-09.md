# Validación FacturADA — 09/11/2026

## Resultados

| Verificación | Resultado |
|---|---|
| Angular completo | **543: 523 OK / 20 fallas heredadas** |
| Nuevas pruebas frontend, incluidas arriba | **23 OK** |
| Core completo | **83 OK**, 4 nuevas demo |
| Lite completo | **253 OK**, 2 nuevas demo |
| Restaurante completo | **74 OK**, 15 nuevas QZ/impresión/equipos |
| API externa completa | **32 OK**, 2 nuevas demo |
| Login compilado, 4 tamaños/temas | **16 OK** |
| Asistentes Desk con Frappe simulado | **7 OK** |
| Build optimizado producción | **OK**, 2,57 MB inicial / 583,32 kB estimados de transferencia |
| Lint | **19 problemas heredados: 18 errores y 1 advertencia** |

Se añadieron **46 casos** (23 frontend + 23 backend). Backend total: **442 OK**;
navegador: **23 OK**. No volver a sumar los casos nuevos a los totales de sus suites.
El módulo Core de navegación Desk se repitió tras su actualización (4 OK) y ya
está incluido en los 83; no aumenta el total de backend.

## Cobertura añadida

- `PrintStationService` (8): estación solo con permisos de caja/cocina; destino
  red/USB válido; Normal desactiva directo; configuración legacy; JSON inválido;
  fallback sin QZ; dos instancias compiten por el mismo pedido/lote e imprimen una
  sola vez; guardar/reporte no interrumpe por fallo informativo del servidor.
  El método de impresión está simulado: no conecta a QZ ni a una térmica.
- `dashboard-attention.spec.ts` (7): visibilidad por panel, firma y permiso de
  configuración, plan y vigencia/cupo, enlace de rechazadas, permisos de caja/stock,
  gravedad, orden y singular/plural.
- `operations-redesign.spec.ts` (4): ticket restaurante solo sobre cerradas, POS
  sobre ventas; cero sin división inválida; efectivo por código 01 y otros medios
  aparte; barras relativas sin NaN con todo en cero.
- `decimal.utils.spec.ts` (+2): precisión por step, dinero con ceros mínimos sin
  recortar precios de mayor precisión.
- `company.component.spec.ts` (+2): demo no selecciona/guarda Producción y revierte
  el check clásico sin petición de actualización. Se conserva su prueba anterior.
- Core `test_demo_environment.py` (4): bloquear Producción antes de consultar cuota,
  permitir Pruebas, perfil demo protegido y no convertir en demo un negocio con
  perfil de Producción.
- Lite `test_demo_environment.py` (2): flag is_demo serializado y rechazo del cambio
  de perfil a Producción por setup.
- API `test_demo_environment.py` (2): cliente demo en Pruebas permitido, Producción
  rechazado.
- Restaurante `test_qz_printing.py` (15): comanda sin precios/anulados, SIN resuelto,
  mesa sin duplicar, adicional solo último lote, cliente para llevar, tildes/corte
  en datos generados; endpoints de impresión y permisos; firma SHA-512 verificable,
  rechazo de texto libre/negocio ajeno, generación con escritura de configuración
  simulada y no reemplazo sin force; Desk exclusivo System Manager; reporte por
  negocio/equipo, Mesero rechazado, evento/ID inválidos, vínculo de orden propia sin
  sobrescribir con una ajena, overview filtrado y con nombre de negocio.

## Ejecución y aislamiento

TESTING_CODEX.md contiene el launcher Chromium, librerías locales y cómo recrear
el bloqueo de red temporal. Redis respondió PONG en 13000 y 11000. Se migró solo
`facturada_core_simple_test`, incluyendo el modelo nuevo de equipos.

Frontend (CHROME_BIN y LD_LIBRARY_PATH como indica la guía):

```bash
npx ng test --watch=false --karma-config=/tmp/facturada-legacy-karma.cjs --browsers=ChromeHeadlessNoSandbox
npm run lint
npm run build -- --output-path=/tmp/facturada-2026-11-09-production
npx playwright test --config=playwright.auth.config.ts
npx playwright test --config=playwright.desk-migration.config.ts
```

Backend, desde el Bench, secuencialmente:

```bash
PYTHONPATH=/tmp/facturada-2026-11-09-fence bench --site facturada_core_simple_test run-tests --app facturada_core
PYTHONPATH=/tmp/facturada-2026-11-09-fence bench --site facturada_core_simple_test run-tests --app facturada_lite
PYTHONPATH=/tmp/facturada-2026-11-09-fence bench --site facturada_core_simple_test run-tests --app facturada_restaurante
PYTHONPATH=/tmp/facturada-2026-11-09-fence bench --site facturada_core_simple_test run-tests --app facturada_api
```

Fixtures ficticios y rollback. El proveedor/SRI, correo e impresión real no se usan.
Las claves privadas de las pruebas QZ se generan solo en memoria; toda escritura
`update_site_config` se simula. Los mensajes de «Certificado generado» en logs son
del código ejecutado con ese doble: no indican una escritura en un sitio real.
Los dobles de órdenes son específicos por DocType/ID y delegan las consultas de
ajustes internos a Frappe para no contaminar su cache.

Login E2E usa Angular compilado optimizado; API satisfecha localmente, incluida su
URL absoluta de producción. Ninguna de esas peticiones se deja continuar al servidor
real. Desk usa su arnés de interfaz Frappe. No es una prueba integral contra Frappe
real ni QZ real. Se permitió únicamente descargar fuentes públicas para compilar.

## Fallas conocidas y límites

La corrida inicial de esta sesión ya tenía 520: 500 OK / 20 fallas. Las 23 nuevas
frontend pasan; no apareció una falla fuera de esa lista heredada. Son fixtures
antiguos sin providers y expectativas de la plantilla:

AppComponent (3), AperturaCajaComponent, CloseCajaComponent, DashboardComponent,
Error404Component, Error500Component, LayoutComponent, NavbarComponent,
OrderCardComponent, OrderKitchenCardComponent, OrderModalComponent,
ProfileMenuComponent, RetiroCajaComponent, TableActionComponent, TableComponent,
TableFooterComponent, TableRowComponent, UsersComponent.

El lint antes/después tiene los mismos 19 problemas. No se desactivaron reglas ni
se relajaron aserciones para esconderlos. La suite Angular completa y lint todavía
no están verdes. Build: 4 advertencias de selectores CSS, sin error.

Pendiente manual: instalar/confiar el certificado en QZ Tray, USB/red/RPT006,
caracteres PC850 y corte reales, dos pestañas con impresora real, UI de configuración
de estación y avisos automáticos completos. No se validó impresión física ni se
simuló que hubiese ocurrido. Dashboard tiene utilidades y specs existentes cubiertos;
E2E con sesión de cada rol/panel y widgets individuales sigue pendiente, así como
CVA foco/blur, toasts, anulaciones de cocina y catálogo descritos en TESTING_CODEX.md.

## Evidencia

Logs temporales con prefijo `/tmp/facturada-2026-11-09-`:
`angular-baseline.log`, `focused.log`, `angular-final.log`, `core.log`, `lite.log`,
`restaurante.log`, `api.log`, `qz.log`, `qz-final.log`, `demo-core.log`, `desk-core.log`,
`auth-browser.log`, `desk-browser.log`, `lint.log`, `lint-final.log`, `build.log`,
`migrate.log`. Los logs focalizados iniciales conservan errores de fixtures ya
corregidos; las suites completas finales y focused.log son la referencia vigente.

Se actualizaron la guía y los estados de las apps tocadas. No se cambió lógica de
negocio para hacer pasar pruebas; se conservaron cambios concurrentes del workspace.
El agente no ejecutó borrados reales, emisión, impresión, commits, push ni despliegue.
