# Pruebas de FacturADA: login, tema y regresión general

Validación de los cambios del 08/11/2026. No se modificaron funciones de producción
ni se hizo commit, push o despliegue.

## Resultado

| Verificación | Resultado |
|---|---|
| Angular completo | 531: **510 OK / 21 fallas heredadas** |
| Nuevas pruebas unitarias, incluidas arriba | **30 OK** |
| Backend Core | **79 OK** |
| Backend Lite | **251 OK** |
| Backend Restaurante | **59 OK** |
| Backend API externa | **30 OK** |
| Login navegador sobre build optimizado | **16 OK**, 4 escenarios × 4 tamaños/temas |
| Asistentes Desk, API/Frappe simulados | **7 OK** |
| Build de producción optimizado | **OK**, 2,57 MB inicial / 582,81 kB estimados de transferencia |

Backend total: **419 OK**. Navegador total: **23 OK**; no contar nuevamente las
30 pruebas nuevas, porque ya están incluidas en las 510 de Angular.

## Cobertura nueva

- `src/app/modules/auth/pages/sign-in/sign-in.component.spec.ts` (13): campos vacíos
  sin HTTP, errores 401/0/429 y fallback backend, edición limpia el error, Bloq Mayús,
  mostrar contraseña, ayuda accesible, selección explícita de negocio, 403 limpia
  selección y permite otro negocio, sin asignación, menú/aterrizaje y guard cancelado.
- `src/app/modules/auth/auth-sample.spec.ts` (6): cada uno de los cinco tickets cuadra
  subtotal/IVA/total y formato de dinero; no lee el logo del negocio anterior.
- `src/app/core/services/theme.service.spec.ts` (4): paleta por defecto, migración única
  de violet preservando oscuro/RTL, elección posterior e información JSON dañada.
- `src/app/pages/orders-realtime/ui/order-status.utils.spec.ts` (7): mezcla de etapas,
  anulados, fallback al estado de orden, identificación de pedido, entrega/factura y
  tiempos inválidos/futuros. No sustituye las pruebas de acciones API de los componentes.
- `tests-e2e/auth-current.e2e.spec.ts`: app compilada real con APIs interceptadas.
  Tamaños 1440×960, 1024×900, 390×844 claro y 390×844 oscuro. Formulario sin desborde,
  contraseña/ayuda, 401 y corrección, múltiples negocios/403 y ruta retirada de
  recuperación. Sin errores JS de página en esos recorridos. Marca propia aunque
  exista un logo anterior en almacenamiento.

Las pruebas Desk existentes (migración, limpieza y planes) siguen aprobadas. Usan un
arnés mínimo de Frappe; no son una sesión completa del Desk conectado al servidor.
Los E2E del login sí usan Angular compilado, pero su backend es simulado. Las fuentes
externas se bloquean en el navegador de pruebas: las capturas usan la fuente de
respaldo si el archivo no está disponible localmente.

## Fallas y limitaciones

Antes de añadir pruebas, el checkout limpio ya daba 501: 480 OK / 21 fallas. Tras
sumar los 30 casos, hay las mismas 21; no aparecieron regresiones nuevas observadas.
Son fixtures de plantilla con providers ausentes y expectativas antiguas:

- AppComponent (3), AperturaCajaComponent, CloseCajaComponent, DashboardComponent,
  Error404Component, Error500Component, LayoutComponent, NavbarComponent,
  NavbarMobileComponent, OrderCardComponent, OrderKitchenCardComponent,
  OrderModalComponent, ProfileMenuComponent, RetiroCajaComponent,
  TableActionComponent, TableComponent, TableFooterComponent, TableRowComponent,
  UsersComponent.

La suite Angular completa todavía no está verde. No se borraron ni relajaron esas
pruebas. Las pantallas de plantilla retiradas ya no cuentan y Sidebar pasó.

El formateador general con prettier-plugin-tailwindcss no pudo cargar DaisyUI
por incompatibilidad ESM/CommonJS en tailwind.config.js. Se formatearon y comprobaron
solo los seis archivos TS nuevos con Prettier estándar, mismas opciones y sin
autodescubrimiento de plugins. No se cambió la configuración de la app.

El primer build optimizado falló por DNS de fonts.googleapis.com dentro del sandbox.
Se completó al permitir la descarga de fuentes públicas, sin cambiar la aplicación.
El build final emite cuatro advertencias de selectores `0%`/`5%`; no falla. El build
sin optimización también pasó, con advertencia de presupuesto 4,80 MB / 4 MB.

Siguen pendientes casos específicos de anulaciones parciales/recetas, catálogo
público y acciones de componentes de cocina/detalle, además de E2E con sesión de
POS, caja, inventario y configuración en ambos temas. Las suites backend existentes
verifican regresión de su cobertura; no prueban automáticamente cada función nueva
que TESTING_CODEX.md enumera. No se probó contra datos de producción.

## Ejecución reproducible

Preparación: TESTING_CODEX.md incluye cómo recrear el launcher Karma y el arnés
sitecustomize.py temporal. Chromium y su biblioteca local:

```bash
export CHROME_BIN=$HOME/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome
export LD_LIBRARY_PATH=$HOME/.cache/facturada-test-libs
```

Frontend:

```bash
npx ng test --watch=false --karma-config=/tmp/facturada-legacy-karma.cjs --browsers=ChromeHeadlessNoSandbox
npm run build -- --output-path=/tmp/facturada-2026-11-08-production
npx playwright test --config=playwright.auth.config.ts
npx playwright test --config=playwright.desk-migration.config.ts
```

El servidor estático solo escucha 127.0.0.1:4228 y no tiene proxy de API. Todas las
peticiones API se satisfacen localmente o se abortan, incluso cuando el build usa
la URL absoluta de producción. Nunca se permite continuar esa solicitud real.

Backend, desde /home/frappe/frappe-bench:

```bash
PYTHONPATH=/tmp/facturada-2026-11-08-fence bench --site facturada_core_simple_test migrate
PYTHONPATH=/tmp/facturada-2026-11-08-fence bench --site facturada_core_simple_test run-tests --app facturada_core
PYTHONPATH=/tmp/facturada-2026-11-08-fence bench --site facturada_core_simple_test run-tests --app facturada_lite
PYTHONPATH=/tmp/facturada-2026-11-08-fence bench --site facturada_core_simple_test run-tests --app facturada_restaurante
PYTHONPATH=/tmp/facturada-2026-11-08-fence bench --site facturada_core_simple_test run-tests --app facturada_api
```

Ambos Redis respondieron PONG. Solo se migró el sitio autorizado; se ejecutaron las
cuatro suites secuencialmente con fixtures/rollback y transporte Requests/SMTP real
bloqueado. No se emitió, consultó SRI ni envió correo real. El esquema de pruebas
queda actualizado; la migración no es una operación sobre clientes reales.

## Evidencia local temporal

Logs con prefijo `/tmp/facturada-2026-11-08-`:
`angular-baseline.log`, `focused.log`, `angular-final.log`, `core.log`, `lite.log`,
`restaurante.log`, `api.log`, `migrate.log`, `build.log`, `build-local.log`,
`build-production-final.log`, `auth-browser-production.log`, `desk-browser.log`.

Capturas: `/tmp/facturada-auth-desktop.png`, `/tmp/facturada-auth-tablet.png`,
`/tmp/facturada-auth-mobile.png`, `/tmp/facturada-auth-mobile-dark.png`.

Se actualizaron TESTING_CODEX.md y los ESTADO.md del frontend y de las cuatro apps
backend para reflejar el estado verificado; no cambiaron contratos funcionales.
