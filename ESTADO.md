# Estado del proyecto Facturada

Última actualización: 2026-10-26.

## Objetivo Actual

Mantener una memoria breve del progreso y los pendientes sin ampliar `CLAUDE.md`.
El trabajo local observado se concentra en la configuración de desarrollo del frontend Angular y su conexión con Frappe.

## Últimos Cambios (Hecho)

- 2026-10-27 (Claude, 2): mejoras posteriores a la PWA, todo sin commit y sin probar en
  navegador (solo compilan con `ngc --noEmit`).
  - Instalación: botón «Instalar app» en el menú de perfil y en el login (`PwaService`:
    `canShowInstall`, `install()`); en iOS muestra los pasos de Safari. Accesos directos
    del manifest (Mesas, Órdenes, Cocina, POS).
  - Actualización: además del aviso, se aplica sola al llegar a una pantalla segura
    (`SAFE_UPDATE_ROUTES`: /auth, dashboard, mesas, lista de órdenes) y solo con el carrito
    vacío; nunca en POS, detalle de orden ni Cocina. Pendiente a futuro: modal obligatorio
    solo si el backend declara una versión mínima incompatible.
  - Cocina (KDS): pantalla encendida con `WakeLockService`; pestaña «Entregadas hoy»
    (solo lectura, sin precios, consulta `get_kitchen_delivered_orders` (backend Restaurante, sin precios), máx. 100). Menú del rol
    Cocina sin «Lista Órdenes» ni «Mesas» (`hideForRoles`); la ruta `/dashboard/orders`
    ahora bloqueada para Cocina con `deniedPrimaryRoles` en el guard (rol de negocio) y su
    ruta inicial es `/dashboard/orders-realtime`; `/dashboard/orders`, `orders/:id` y `tables`
    quedan denegadas. Pendiente: `get_kitchen_orders` aún devuelve precios (el front los oculta).
  - Mesero: sin campo de escáner ni refocus en el POS (abría el teclado en tablet); el POS
    de Caja lo conserva. Al crear la orden con mesas habilitadas vuelve a Mesas. Botón «←
    Mesas» en el POS y «Mesas»/«Nueva orden» en el detalle de orden; «Orden sin mesa» en
    Mesas abre el POS con `sin_mesa=1` (pos-shell no redirige). `goBack()` del detalle iba a
    `/orders` (no existe), ahora `/dashboard/orders`.
  - Mesas: mesas con «Listo» primero y filtro «Listas»; el mesero no ve «Cuentas abiertas $»
    ni «Inactivas».
  - Para Codex: `PwaService` (instalación, actualización en pantalla segura/carrito),
    `WakeLockService`, pestaña «Entregadas hoy», `hideForRoles` (Cocina sola vs Cocina +
    otro rol), orden y filtro de Mesas, vista de mesero en Mesas, `sin_mesa`, navegación a
    Mesas tras crear la orden, botón «← Mesas» del POS.
  - Pendiente: impresión desde celular/tablet (idea: Network Printer Settings de Frappe +
    CUPS + endpoint propio; depende de si el servidor está en el mismo local o en la nube y
    de las impresoras); fase 2 de Cocina (guardar quién preparó cada orden y mostrar «Mi
    producción»); nginx sin caché para `ngsw.json`.

- 2026-10-27 (Claude): PWA instalable, ya desplegada en producción (commit a `main`).
  - Manifest `src/manifest.webmanifest` (scope/start_url `/portal/`, standalone, colores
    `#1B1F3A`), service worker de Angular (`ngsw-config.json`, `provideServiceWorker` solo en
    producción, registro a los 30 s). Solo cachea el shell y los assets; no hay `dataGroups`,
    así que ninguna llamada a la API se cachea. Sin modo offline real.
  - `src/app/core/services/pwa.service.ts`: toasts de sin conexión/restablecida y de nueva
    versión con botón Actualizar; consulta versión nueva cada hora y al volver a la pestaña.
  - Iconos de `src/assets/pwa/` (192, 512, apple-touch 180) tomados del paquete de marca;
    el maskable 512 lo generé yo (símbolo al 80 % sobre fondo azul tinta). `favicon.ico`
    reemplazado por el de marca. Paquete de marca completo en `brand/FacturADA-marca/`
    (fuera de `src` para que no entre al build).
  - Comprobado por el usuario: la app se instala en Chrome de escritorio con el icono y
    el color correctos. Sin Lighthouse, sin probar en Android/iOS.
  - Para Codex: pruebas de `PwaService` (toasts online/offline, `VERSION_READY`, chequeo
    periódico sin red); revisar el build de producción con `ngsw.json`.
  - Pendiente: confirmar que nginx sirve `ngsw-worker.js`, `ngsw.json` y
    `manifest.webmanifest` sin caché; comprobar el aviso de actualización en el próximo
    deploy; probar instalación en Android/iOS (desinstalar y reinstalar si ya estaba
    instalada, por el icono); correr Lighthouse. Cambio de `package-lock.json` por
    `@angular/service-worker` aún sin revisar a fondo.

- 2026-10-26 (Claude, 6): reporte «Cobros de restaurante» corregido en backend (ver ESTADO de
  Restaurante) y textos de `frappe-report-definitions.ts` ajustados (fecha de cobro, incluye
  subcuentas y órdenes abiertas ya pagadas). Sin probar en navegador.

- 2026-10-26 (Claude, 5): revisión de `orders-realtime`. Eventos en vivo: la deduplicación
  ya no descarta cambios sucesivos de una orden (firma con `modified`); el merge conserva
  mesa y datos del cliente; `isInvoiced` usa `sri.invoice`. Caja sin socket consulta cada
  10 s (antes solo Cocina). «Ventas hoy» excluye canceladas. Las pestañas de Caja ya
  responden al clic (faltaba `trackBy`: se recreaban los botones entre pointerdown y click).
  Caja aplica la respuesta del servidor en vez de cambiar el estado antes de tiempo.
  «Deshacer» de Cocina restaura el estado de cada ítem (`item_statuses` en
  `update_kitchen_order_status`). Mesero ya no ve la pestaña Cocina. Quitado código
  muerto (`refreshOne`, `refetchTrigger`). Sin probar en navegador. Para Codex: dedupe con
  `modified`, merge de mesa/cliente, `isInvoiced`, `totalSales`, polling de Caja, clic en
  pestañas, deshacer con ítems en estados distintos (endpoint con `item_statuses`).
  Rol de Cocina/Caja: manda `businessRole` (coincidencia exacta; los roles Frappe solo si no hay
  rol de negocio) y las acciones de estado exigen `restaurant.orders.update`/`manage`, no
  «no ser Mesero». Para Codex: Usuario/Facturación sin botones de estado.
  Pendiente: decidir si una orden Lista sin cobrar se cierra desde Caja; «Ventas hoy» limitado
  a 80 órdenes del día; dividir el componente; reiniciar workers.

- 2026-10-26 (Claude, 4): Cocina usa `update_kitchen_order_status` (una sola operación por
  pedido) en lugar de una petición por ítem; un fallo a mitad ya no deja ítems en
  estados distintos. Deshacer reutiliza el mismo endpoint. Para Codex: pruebas del
  endpoint (ítems entregados/cancelados no cambian, estado inválido, sin ítems activos).

- 2026-10-26 (Claude, 3): Gestión de cajas rediseñada. Filas desplegables: aperturas
  con terminal por nombre, duración y, si siguen abiertas, cobros por forma de pago,
  retiros y efectivo esperado; cierres con contado vs sistema por forma de pago (el
  efectivo se compara contra fondo + ventas − retiros). «Diferencia acumulada» ya no
  queda en $0 (la clave del resumen no coincidía). El rango de fechas ya se consulta
  en el backend (hasta 500 registros por tipo); usuario y estado filtran en el front.
  Para Codex: totales del turno abierto, desglose del cierre, diferencia acumulada.

- 2026-10-26 (Claude, 2): Cocina, Usuarios, dashboard y subcuentas. Sin pruebas propias.
  - Cocina: rol y acceso salen del contexto ya cargado (antes una llamada fallida
    dejaba al usuario Cocina en la vista de Caja con totales).
  - Usuarios: el Gerente no ve Editar/Quitar acceso en filas Administrador/Gerente
    (`canChange`); el backend lo valida y exige conservar un Administrador activo.
    El catálogo de roles ya trae `label` y `description` (Usuario = solo consulta).
  - Dashboard: el rol sin panel (Usuario) muestra accesos del menú en vez de un
    callejón sin salida; la alerta de stock Retail también la ven Admin/Gerente.
    Limitación: con Restaurante + POS genérico las cifras cuentan solo órdenes.
  - Subcuenta: diálogo reorganizado (más ancho, cabecera compacta, paneles de
    productos desde `lg`, pagos y resumen lado a lado, total en el pie).
  - Para Codex: `canChange`, `resolveDashboardLayout` por rol/negocio, accesos del
    rol sin panel, acceso a Cocina sin llamada extra. Revisar el diálogo en móvil.

- 2026-10-26 (Claude): caja, menú y Cocina. Sin pruebas propias; pendientes para Codex abajo.
  - Caja: `CajaAbiertaGuard` obliga a abrir caja solo al Cajero; Administrador/Gerente
    reciben un aviso con botón «Abrir caja» y pasan; Mesero y otros roles no se validan.
    Manda el rol de negocio sobre los roles Frappe. Permisos de caja en una sola
    constante `CASH_OPERATOR_PERMISSIONS` (`restaurant.cash.manage`, `restaurant.manage`);
    `billing.*` ya no da acceso a caja (Facturación recibía 403).
  - Apertura: aviso y botón bloqueado si otro usuario tiene abierta la terminal
    (endpoint nuevo `get_terminal_cash_holder`). Una terminal, un turno a la vez.
  - Menú: quitados duplicados (Órdenes en vivo, POS/POS Restaurante vía
    `hideWhenPermission`), retirado el console.log de permisos, Mesas en accesos
    rápidos del Mesero.
  - Cocina (KDS): franja para activar el sonido (el navegador exige un gesto), modo
    texto grande por dispositivo, «Deshacer» 8 s al empezar/terminar. Entregado no
    se deshace (el backend puede cerrar la orden).
  - Para Codex: pruebas del guard (3 modos), filtrado del menú por rol, bloqueo por
    terminal ocupada, deshacer/audio/modo grande del KDS. Backend: apertura en
    terminal ocupada y `get_terminal_cash_holder`.
  - Pendiente: reiniciar workers del bench; probar a mano los flujos de caja y KDS.
    Dividir `orders-realtime` (905 líneas) en Caja y Cocina; usar `ui_capabilities`
    en vez de detectar rol/permisos a mano en Cocina.

- 2026-10-26: validacion segun TESTING_CODEX.md. Backend del sitio exclusivo
  facturada_core_simple_test migrado: 282 pruebas aprobadas entre Core/Lite/
  Restaurante/API. Agregadas 53 pruebas Angular y dos regresiones Jinja; fixtures
  de importacion, facturacion y POS actualizados sin cambiar logica de produccion.
  Front completo: 395 aprobadas de 421; quedan las 26 fallas heredadas de plantilla.
  Build sin optimizacion aprobado; build normal bloqueado por DNS de Google Fonts
  y Prettier por incompatibilidad ESM existente. E2E revisados, no ejecutados.
  Detalle y comandos en PRUEBAS_CODEX_2026-10-26.md; sin commits ni despliegues.

- Dashboard: período mensual en una barra compacta con nombre, fechas y marca «Mes actual»; mes/año y flechas agrupados en una fila, con vuelta al mes actual para períodos históricos. Adaptación móvil comprobada visualmente con los estilos reales y tema oscuro, sin desbordamiento. Al cargar otro mes oculta las cifras anteriores; la selección solo afecta comprobantes, no caja, actividad reciente ni consumo del plan, cuya tarjeta lo aclara. Once pruebas Chromium aprobadas (selectores, bisiesto, límites y respuestas atrasadas); compilación sin optimización aprobada, con aviso de tamaño del bundle. No cambia los filtros de estado/tipo/ambiente del endpoint de métricas; esa revisión sigue pendiente.
- 2026-10-20: configuración de firma muestra fecha y hora de vigencia en Ecuador continental. El aviso de firma aún no vigente indica cuándo empieza, y el texto de contraseña aclara su almacenamiento cifrado en el servidor. Core unifica la validación de estas fechas en UTC.
- Corregida mezcla de NC en la lista Facturas: Lite filtra por Factura antes de
  contar/paginar; Angular descarta NC conocidas de respuestas antiguas. Enlaces
  antiguos de factura que apuntan a NC redirigen a su detalle correcto, con enlace
  visible a la factura original. La NC conserva Autorizada; la compensación se
  muestra en la factura. Build y 28 pruebas Angular/6 backend aprobados.

- 2026-10-18: lista y detalle distinguen anulación documental y compensación total
  mediante NC autorizadas. Indicador rojo, filas diferenciadas en móvil/escritorio,
  aviso en detalle y enlaces a las NC; se conservan consultas/descargas históricas.
  Una NC pendiente o parcial no se presenta como anulación completa. Lite expone
  el resumen de NC y amplía el filtro Anulada sin cambiar el estado fiscal original.
  Publicar Angular y Lite juntos para obtener el resumen y sus enlaces.
  Validado: build de producción, 19 pruebas Angular en Chromium y cinco pruebas
  backend; filtro y detalle comprobados con MariaDB y transacción revertida.

- Creado `ESTADO.md` con el formato acordado; se actualizará al cierre de cada sesión cuando se solicite.
- Revisadas las instrucciones de `AGENTS.md` y `CLAUDE.md`, el estado de Git y las diferencias locales.
- Cambios existentes observados, todavía sin commit y sin validación funcional registrada en esta conversación:
  - `src/environments/environment.ts`: `URL` vacía y `apiUrl: '/api'` para usar rutas relativas; configuración anterior conservada en comentarios.
  - `src/proxy.conf.json`: API dirigida a `127.0.0.1:8002` y Socket.IO a `127.0.0.1:9000`, con `changeOrigin: true`.
  - `src/proxy.conf_local.json`: archivo nuevo con la configuración alternativa hacia el backend en la red local; todavía sin seguimiento en Git.
  - `package.json`: agregada la dependencia `@tailwindcss/oxide-linux-x64-gnu`; `package-lock.json` también presenta cambios.
  - `README.md`: agregado un comando para iniciar Angular en el puerto 4200 y escuchar en todas las interfaces.

## Problemas o Bugs Pendientes

- `npm run lint` no funciona: `angular.json` carece del target `lint`, según las instrucciones del proyecto y la configuración revisada.
- El comando nuevo del README indica `--proxy-config proxy.conf.json`, pero el archivo está en `src/proxy.conf.json`; revisar y corregir la ruta.
- Falta validar la conexión con Frappe, las cookies de sesión y Socket.IO tras los cambios de proxy y entorno.
- Revisar el impacto de la dependencia específica de Linux y los cambios amplios en `package-lock.json` sobre instalación y compilación en otros entornos.
- No se ejecutaron build, pruebas unitarias ni E2E en esta sesión de documentación. No hay historial conversacional previo disponible para atribuir otros trabajos o confirmar su resultado.

## Siguientes Pasos (To-Do)

- Confirmar qué configuración de backend se usará para la próxima validación: localhost o red local.
- Corregir la ruta del proxy en el comando del README.
- Revisar las diferencias de dependencias y lockfile antes de consolidarlas.
- Ejecutar `npm run build` y validar manualmente login, selección de empresa y actualizaciones en tiempo real contra el backend elegido.
- Resolver el target de lint cuando se aborde la configuración de herramientas.
- Actualizar este archivo al cierre de la próxima sesión con resultados comprobados y pendientes vigentes.

Recordatorio operativo: un push a `main` despliega directamente a producción, sin staging intermedio.
