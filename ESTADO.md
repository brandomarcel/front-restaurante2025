# Estado del proyecto Facturada

Última actualización: 2026-10-29.

## Objetivo Actual

Mantener una memoria breve del progreso y los pendientes sin ampliar `CLAUDE.md`.
El trabajo local observado se concentra en la configuración de desarrollo del frontend Angular y su conexión con Frappe.

## Últimos Cambios (Hecho)

- 2026-10-29 (Claude): POS sin imagen de producto. En lugar del cuadro «Sin imagen», el recuadro de la foto muestra el
  nombre del producto (negrita, hasta 3 líneas, `title` con el nombre completo) y se quita el nombre repetido de debajo;
  con foto no cambia. Tarjeta de Caja (general y retail, `pos-product-card.component.ts`) y de Mesero
  (`pos-mesero.component.html`). Compila con `ngc --noEmit`; sin probar en navegador ni con nombres muy largos/modo oscuro.
  El recuadro es un solo componente, `shared/components/product-thumb` (`app-product-thumb`), usado por las tres tarjetas.

- 2026-10-29: contrato de migración actualizado: se admiten históricos sin número de autorización con advertencia, estado declarado de origen y constancia de autorización no acreditada; no cambian las protecciones Migrado/solo lectura. Lite 238 OK, sin cambios de código Angular ni nueva ejecución de sus pruebas. Guía docs/MIGRACION_RESTAURANTE.md actualizada. No se importó el ZIP real ni se desplegó.

- 2026-10-29: migración administrativa movida exclusivamente al Desk: Business → Migración → Importar desde Restaurante, y lista FacturADA Legacy Import. Retiradas pantalla, ruta, enlace y pruebas de carga Angular. Conservadas marcas/bloqueos de históricos. API exige System Manager/Administrator y administrador del negocio. Diagnóstico descargable, identificación recuperada del nombre Legacy solo cuando falta y coincide exactamente, duplicados explícitos; autorización solo recuperada desde XML autorizado local coincidente. No se inventan datos ni se fusionan personas. Lite 234 OK, asistente Desk 3 pruebas de navegador OK, Angular 479 OK/25 fallas heredadas (504); fixture de Company corregido. Build sin optimización OK. Guía docs/MIGRACION_RESTAURANTE.md y reporte PRUEBAS_MIGRACION_DESK_2026-10-29.md. Pendiente publicación/cache destino y validación del ZIP real; no se importó empresa real ni se desplegó producción.

- 2026-10-28 (Claude, 8): dos pendientes cerrados. (1) Sin cocina habilitada ya no sale «Enviar a cocina»: en
  Órdenes en vivo (tarjeta y tabla, `kitchenEnabled`) el pedido nuevo muestra «Imprimir comanda» y «Ver y cobrar»,
  y el detalle de la orden no ofrece «Iniciar preparación»; las órdenes se cierran al cobrarse (`_is_served`).
  (2) El mesero puro (`CompanyCapabilitiesService.isWaiterOnly`: crea órdenes, sin `billing.create` ni
  `restaurant.manage`) ve en «Lista Órdenes» solo sus órdenes de hoy (`get_all_orders(mine=1)`, chip «Solo tus
  órdenes de hoy»). El plano de Mesas sigue cargando todas para mostrar la ocupación. Es un filtro de pantalla, no
  una restricción de seguridad: la API sigue permitiendo leer todas con `restaurant.orders.read`.
  Compila con `ngc --noEmit`; backend verificado con script temporal (59 OK). Sin probar en navegador.

- 2026-10-28 (Claude, 7): «Agregar productos» a una orden abierta (el cliente pidió algo más). Detalle de
  la orden → «+ Agregar productos» (con `restaurant.orders.create`, orden Ingresada/Preparación/Lista, sin
  factura, pagos ni subcuentas) abre el POS en modo agregar (`/dashboard/pos?agregar=<orden>`, usa el POS de
  mesero con cualquier rol): sin mesa ni alias, botón «Agregar a la orden». `OrdersService.addItems` →
  `add_order_items`. Cocina ve lo nuevo como Pendiente con la marca «Agregado» y suena un aviso; Caja recibe
  «Pedido ampliado · Mesa 5 · +2 productos» con «Imprimir comanda adicional» (o impresión automática con
  `PrintService.getComandaAdicional`, solo el último lote). Quien agrega no recibe el aviso de su propio
  cambio; si tiene `billing.create` el toast de éxito ofrece imprimir la comanda adicional. Compila con
  `ngc --noEmit`; sin probar en navegador.
  Pendiente: quitar o cambiar lo ya enviado a cocina (se usa cancelar/cierre manual); editar una cantidad ya
  agregada; probar con mesero + cajero + cocina a la vez.

- 2026-10-28 (Claude, 6): el mesero no veía los pedidos sin mesa. Causa: «Lista Órdenes» exigía
  `restaurant.orders.read` **y** `update` y el Mesero solo tiene `read`/`create`, así que el menú no
  aparecía, y el plano de Mesas solo muestra órdenes ligadas a una mesa. Arreglo: el menú se muestra con
  `update` o `create` (`anyPermissionKeys` en `menu.ts`; Cocina sigue oculta por `hideForRoles`) y Mesas
  tiene la sección «Pedidos sin mesa» (para llevar/domicilio, activos, con estado, mesero y tiempo; en
  vivo; sin importe para el mesero). Compila con `ngc --noEmit`; sin probar en navegador.

- 2026-10-28 (Claude, 5): cierre administrativo de órdenes. Detalle de la orden → menú «⋯» →
  «Cerrar manualmente…» (solo con `restaurant.orders.force_close`: Administrador y Gerente), sobre
  órdenes Ingresada/Preparación/Lista. Diálogo `shared/components/force-close-dialog` con motivo
  obligatorio (se fue sin pagar, cobrada fuera del sistema, duplicado/prueba, otro con detalle);
  `OrdersService.forceClose`. La orden queda Cerrada, la mesa Libre, sin factura ni devolución de stock;
  si no estaba cobrada se marca «Cierre manual» y no cuenta como venta en el panel. Detalle con
  chip «Cierre manual» y motivo. El cierre normal de Caja («Cerrar orden» = servida, se factura
  después) no cambió. Compila con `ngc --noEmit`; sin probar en navegador.
  Pendiente: acceso desde Órdenes en vivo (hoy solo desde el detalle); listar/filtrar cierres manuales
  en un reporte; las subcuentas sin facturar de una orden cerrada manualmente quedan como están.

- 2026-10-28 (Claude, 4): aviso de pedido nuevo para Caja. `NewOrderAlertService`
  (`services/new-order-alert.service.ts`, iniciado por el layout): al llegar `order.created` de otra
  persona (mesero) suena un aviso de tres tonos, sale un toast «Nuevo pedido · Mesa 5» con mesero y
  cantidad de productos y un botón «Imprimir comanda» (30 s), y la pestaña muestra «(n) Nuevo pedido»
  si no se está mirando. Solo para quien cobra (`billing.create`) con `orders` y
  `restaurant.orders.read`; Mesero y Cocina no lo reciben; lo creado por el propio usuario no avisa.
  `PrintService.openComanda` abre la comanda lista para imprimir. En «Órdenes en vivo» (Caja) las
  tarjetas «Nuevas» tienen «Imprimir comanda» junto a «Enviar a cocina» (tarjeta y tabla).
  Backend Restaurante: `serialize_order` ahora trae `table_name` y `waiter_name` (reiniciar workers).
  Compila con `ngc --noEmit`; Restaurante 59 OK. Sin probar en navegador ni con dos usuarios.
  Impresión automática (servidor en la nube + térmica USB: no sirve imprimir desde el servidor):
  menú del perfil → «Imprimir comandas solas» (por equipo, `facturada.caja.autoprint`) y «Sonido de
  pedidos nuevos»; la comanda se carga en un marco oculto (`PrintService.printComandaHidden`, no una
  ventana emergente, que el navegador bloquea sin clic). Sale sin diálogo solo si la PC de caja abre
  Chrome con `--kiosk-printing` y la térmica es la impresora predeterminada; si no, aparece el
  diálogo normal. Ejemplo (Windows): `chrome.exe --kiosk-printing --app=https://<dominio>/portal/`.
  Activarlo solo en la PC de la impresora (si hay dos cajas con el interruptor, sale doble).
  Pendiente: probar con la térmica real; si luego hay impresoras de red/cocina, evaluar
  impresión desde el servidor (solo con servidor local o VPN) o un programa local (QZ Tray).

- 2026-10-28 (Claude, 3): planes por módulos (el trabajo está en Core, ver su ESTADO). El front no
  cambió: ya oculta Mesas (`tables`) y Cocina (`kitchen`) por `featureKey` y el POS Mesero no exige
  mesa sin `tables`. Un restaurante pequeño se configura aplicando un plan en el Desk
  (Suscripción → «Aplicar plan»). Pendiente: probarlo en pantalla (RESTO_BASICO: sin mesas ni cocina;
  revisar POS, Lista de órdenes y cobro desde Caja sin la pantalla de cocina).

- 2026-10-28 (Claude, 2): «Ajustar stock» sale de la ficha del producto. La edición ya no crea
  movimientos; la ficha muestra «Cambiar la cantidad» con el botón «Ajustar en Inventario →»
  (`irAjustarStock`) que navega a `/dashboard/inventory?adjust=<producto>`; Inventario abre el
  movimiento con ese producto elegido y limpia la URL (`openPendingAdjust`). Si el inventario se
  acaba de activar en la misma edición, avisa que primero se guarde. Se conserva «Stock
  inicial» al crear (Entrada tras crear; Por Bodega usa la elegida/predeterminada). También:
  la unidad «Unidad» de Lite ahora se muestra como «und» y una unidad no listada (kg…) ya no
  deja el selector en blanco. Reemplaza la nota anterior del ajuste dentro de la ficha. Suite:
  503 pruebas, mismas 26 heredadas; se retiró la prueba heredada del ajuste en la ficha.

- 2026-10-28 (Claude): «Ajustar stock» (editar) y «Stock inicial» (crear) del formulario de
  producto no hacían nada en negocios no-Lite: `ProductsService.toLiteProductPayload` descarta
  `stock_actual`/`stock_ajuste`/`stock_inicial` porque el saldo solo cambia por movimientos, y el
  componente nunca los creaba. Ahora `ProductsComponent` registra el movimiento tras guardar el
  producto: «dejar en N» = Ajuste (acepta 0), «sumar/restar» = Entrada/Salida, stock inicial =
  Entrada; en Por Bodega usa la bodega elegida en Inventario o la predeterminada. Si el
  movimiento falla, el producto queda guardado y se avisa el motivo. Modo Lite sin cambios
  (sigue mandando a Inventario). 10 pruebas nuevas; suite 501 con las mismas 26 heredadas.
  No probado en el navegador contra datos reales (alteraría stock).

- 2026-10-27 (Claude, 9): bodegas según el tipo de negocio. `CompanyCapabilitiesService`:
  `isRestaurantBusiness` y `warehouseUiVisible` (restaurante en inventario Simple no ve
  bodegas; con Por Bodega o en comercio sí). Se oculta «Bodegas y modo» + «Modo: Simple» en
  la navegación de Inventario y «Bodegas» en el menú lateral (`hideUnlessWarehouseUi`). Insumos y
  Recetas: selector `app-kitchen-warehouse-picker` (solo en Por Bodega) y, solo para
  administradores en Simple, un enlace discreto «Activa el manejo por bodegas» (texto: «¿Tienes más de un local, o una cocina central que abastece a otros locales?»; ajustado tras revisar cómo lo usan los restaurantes). La pantalla
  `/settings/lite/warehouses` sigue accesible por URL y desde ese enlace. 11 pruebas nuevas;
  suite 491 con las mismas 26 heredadas. El spec de navegación de Codex ahora simula
  `warehouseUiVisible`.

- 2026-10-27 (Claude, 8): variantes según el tipo de negocio. Restaurante (`restaurant` activo
  y POS no retail) habla de «opciones»: formulario de producto, lista, ejemplo «Jugo natural →
  Mora, Naranja», atributo inicial «Sabor» y stock propio apagado con aviso hacia Recetas.
  Boutique/retail conserva «variantes», Color/Talla y stock activado. Tarjetas del POS Caja y
  Mesero dicen «opciones» en restaurante. Textos en `VariantCopy` de `products.component.ts`.
  Los fixtures de `products.behavior.spec.ts` (Codex) ahora representan un comercio sin
  `restaurant`; 6 pruebas nuevas cubren ambos lenguajes. Suite: 482 pruebas, mismas 26 heredadas.
  Pendiente: el selector de variantes del POS usa los atributos tal cual vienen.

- 2026-10-27 (Claude, 7): simplificación de Insumos y Recetas tras revisarlas en pantalla
  (Playwright con las librerías de `~/.cache/facturada-test-libs`). Insumos: una sola barra
  «Todos / Por reponer / Agotados» + búsqueda; filas con «+ Compra» y «Editar» (contar y
  «se dañó» van dentro de Compra); unidades planas (kg, g, lb, lt, ml, und). Recetas: pestañas
  «Con / Sin receta / Por agotarse»; el editor muestra por línea insumo + cantidad + «el cliente
  puede pedirlo sin»; la merma sigue en datos/backend pero ya no se edita en pantalla. En el
  POS, «Quitar del plato» va antes de las notas genéricas. Suite del front: 476 pruebas, las
  mismas 26 fallas heredadas.

- 2026-10-27 (Claude, 6): pruebas de recetas a pedido del usuario (coordinadas con las de
  Codex, que ya cubrían servicio, utilidades de porciones, Recetas y navegación). Nuevas en el
  front: `ingredients.component.spec.ts` (alta, «guardar y otro», movimientos, desactivar,
  permisos, bodega), `pos/services/cart.service.spec.ts` (líneas con insumos quitados, límite
  por porciones), `pos/ui/line-note-editor.component.spec.ts` («Sin X»),
  `recipes.preview.spec.ts` (porciones con decimales). Suite completa: 476 pruebas, 450
  aprobadas y 26 fallidas, todas de la lista heredada («should create»). Sin regresiones.

- 2026-10-27 (Claude, 5): pantallas «Insumos» y «Recetas» (Inventario → pestañas nuevas, solo
  con `restaurant` + `inventory`), sin commit y sin probar en navegador (compila con
  `ngc --noEmit`). Rutas `/dashboard/inventory/ingredients` y `/recipes`
  (`pages/kitchen-supplies/`, `KitchenSuppliesService`). Insumos: resumen filtrable
  (disponibles / por reponer / agotados), alta rápida con «Guardar y otro», compra / salida /
  conteo con vista previa del stock resultante, desactivar. Recetas: con / sin receta / pocas
  porciones, editor con porciones disponibles en vivo e insumo limitante, opciones «sin» y
  merma plegadas por línea, quitar receta. Guía de primer uso, estados de carga/error/vacío,
  tarjetas en móvil. El formulario de producto enlaza a estas pantallas. Arreglado antes:
  `TaxesService` ya no usa `/resource/taxes` (daba «Sin permiso para DocType» en restaurante).
  Para Codex: ambas pantallas (alta, compra, conteo, salida mayor al stock, editor de receta,
  plato con stock propio, sin insumos, modo Por Bodega sin bodega, permisos).

- 2026-10-27 (Claude, 4): recetas fase 2, sin commit y sin probar en navegador (compila con
  `ngc --noEmit`). Editor de receta: «El cliente puede pedirlo sin» y «Merma %» por insumo.
  El editor de nota de cocina del POS (Mesero y Caja) muestra chips «Sin <insumo>» para los
  insumos quitables; el carrito guarda `removed_ingredients` (separa líneas con distintos
  quitados) y `create_order_v2` los recibe por línea. Quitar la nota limpia los quitados.
  Para Codex: chips «Sin X», líneas separadas por quitados, payload de la orden.

- 2026-10-27 (Codex): pruebas ejecutadas sobre el estado actual. Backend del sitio
  exclusivo facturada_core_simple_test migrado: 292 aprobadas (75 Core, 144 Lite,
  43 Restaurante, 30 API). Nueve pruebas nuevas de recetas con stock/cancelación/
  deduplicación/aislamiento y cinco Angular de recetas y terminal ocupada. Front:
  400 aprobadas de 426, con las 26 fallas heredadas. Mock de caja actualizado.
  Build sin optimización aprobado; normal bloqueado por DNS de Google Fonts.
  PWA validada solo en artefactos estáticos, no en móvil; sin E2E ni despliegues.
  Detalle y límites: PRUEBAS_CODEX_2026-10-27.md. Implementación del usuario intacta.

- 2026-10-27 (Claude, 3): recetas e insumos para restaurante (fase 1), sin commit y sin probar en
  navegador (compila con `ngc --noEmit`). Formulario de producto: switch «Es insumo» y editor de
  «Receta por porción» (insumo + cantidad, con porciones disponibles) solo con features
  `restaurant` + `inventory`; badges «Insumo»/«Receta · n» en la lista. POS Mesero/Caja y
  Facturación ocultan insumos. `ProductsService.getRecipe`. Para Codex: alta/edición de insumo
  y de plato con receta, quitar receta, insumos ocultos en POS, payload `is_ingredient`/`recipe`.

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
