# Estado del proyecto Facturada

Última actualización: 2026-11-06.

## Objetivo Actual

Mantener una memoria breve del progreso y los pendientes sin ampliar `CLAUDE.md`.
El trabajo local observado se concentra en la configuración de desarrollo del frontend Angular y su conexión con Frappe.

## Últimos Cambios (Hecho)

- 2026-11-06 (Claude, 13): Productos, revisión por tipo de negocio. «Stock inicial» al crear también en Lite (antes
  obligaba a ir a Inventario → Entrada; el front ya registraba la Entrada en cualquier modo). Plato con receta y sin
  stock propio: aviso «Inventario por receta» con «Ver recetas» en lugar del interruptor. Textos según negocio (sin POS
  no se menciona el POS; «platos» solo en restaurante; ejemplo de nombre por negocio). Modo oscuro con `tone-*`.
  «Carga masiva» del estado vacío exige permiso. Títulos de sección sin mayúsculas espaciadas. Visto en navegador
  (cafetería, claro/oscuro). Pendiente: al editar un producto la categoría puede salir vacía aunque la lista la
  muestre (valor guardado ≠ `name` de la categoría); revisar. Pruebas para Codex: stock inicial en Lite,
  `stockFromRecipe`, «Carga masiva» sin permiso.
- 2026-11-06 (Claude, 12): Productos: las variantes solo aparecen con POS o Inventario (`variantsEnabled` en
  `products.component.ts`). Solo facturación → «Nuevo producto» abre el formulario directo, sin «Simple / Con
  variantes», sin «← Cambiar tipo» ni botón «Variantes»; un producto que ya tenga variantes conserva el botón.
  Backend sin cambios. Pruebas para Codex: negocio sin `pos` ni `inventory` (sin paso de tipo, sin botón; con
  `variant_count > 0` sí) y con cualquiera de los dos (como hoy).
- 2026-11-06 (Claude, 11): Configuración de la empresa reorganizada como pantalla de ajustes de SaaS. Cada sección
  tiene su título y descripción (`activeSettingsTitle`/`activeSettingsDescription`); la tarjeta de la empresa queda
  solo en Resumen. Datos tributarios y Firma en filas «qué es · campos» (Logo, Identidad, Información tributaria, Datos
  del RUC, Ambiente / Estado, Archivo, Contraseña). Los datos que define el backend (RUC, tipo de operación,
  contribuyente especial, tipo de emisión, RUC del proveedor) son una ficha de solo lectura, no campos deshabilitados.
  Plan con barra de consumo (`planUsagePercent`). La barra de guardado en Lite aparece solo con cambios sin guardar
  (`hasUnsavedChanges`: campos editables, logo, firma o contraseña) y trae «Descartar» (`discardChanges`, vuelve a lo
  cargado sin llamar al backend); en celular queda sobre la navegación inferior. En Lite «Quitar logo/archivo» solo
  aparece con un archivo nuevo pendiente («Descartar logo/archivo nuevo»): antes se mostraba sin efecto. Arreglado:
  tras subir el logo no se limpiaba `logoFile`, así que cada guardado lo volvía a subir. Mismo payload y mismos
  endpoints. Verificado en navegador (claro, oscuro, 390 px): sin barra al cargar, aparece al editar, «Descartar»
  restaura y la oculta. Para Codex: `hasUnsavedChanges`/`discardChanges`/`markSaved`, `planUsagePercent`, `logoFile`
  limpio tras subir, texto «Datos tributarios» (prueba existente).

- 2026-11-06 (Claude, 10): Configuración de la empresa (`pages/company`, Resumen / Datos tributarios / Firma / Plan)
  revisada en navegador y corregida, sin cambiar lógica ni textos de negocio. Modo oscuro: paso pendiente del Resumen,
  aviso de firma sin cargar, avisos de ambiente y plan, y etiquetas de estado (`certificateStatusClasses`,
  `getPlanStatusClasses` en el TS) pasan a tonos `.tone-*`. Campos de solo lectura (RUC, Tipo de operación,
  Contribuyente especial, Tipo de emisión, RUC del proveedor) ahora se distinguen de los editables (el `.input` global
  pisaba su `bg-muted`); el select de Tipo de operación ya no muestra flecha. En celular la zona del logo era un cuadrado
  de ~350 px: ahora 144 px de alto (cuadrada desde `lg`). Menú interno: activo con fondo suave (como el lateral), sin
  «→». Sin la etiqueta «CONFIGURACIÓN» repetida en la cabecera; texto mínimo 12 px, sin mayúsculas sostenidas ni
  `font-mono`. Se conserva el texto «Datos tributarios» que verifica la prueba de Codex. Verificado en navegador
  (claro, oscuro, 390 px).

- 2026-11-06 (Claude, 9): Puntos de emisión (`pages/lite-emission-points`) revisada en navegador y corregida. En el
  formulario el campo Código (`.input` global fija `md:w-80`) se montaba sobre Nombre: campos con `!w-full`. Modo
  oscuro: «Secuencia configurada», «Activo», el aviso del formulario y los avisos ámbar eran cajas claras; ahora tonos
  `.tone-*`. «Desactivar» (rojo oscuro ilegible en oscuro) con su variante; confirmación con el diálogo de la app
  (`AlertService.confirm`, explica que se conserva el historial y que se reactiva desde Editar) en vez de
  `window.confirm`. Texto mínimo 12 px, sin etiquetas en mayúsculas ni «→». Lógica y textos de negocio sin cambios.
  Global: `.tone-ok/info/warn/alert/danger` pasan a `styles.css` (componentes) para reutilizarlos; se quitaron del CSS
  de Facturar. Verificado en navegador (claro, oscuro, 390 px, errores de validación). Pendiente: la cabecera
  compartida `app-fiscal-setup-header` sigue con su etiqueta en mayúsculas y 10 px.

- 2026-11-06 (Claude, 8): «Nueva factura», a pedido del usuario: los descuentos vuelven a estar siempre en la fila (se
  quitó «+ Aplicar descuentos» y `showDiscounts`/`discountsVisible`/`toggleDiscounts`) y cada línea muestra el valor
  de su IVA (`item.iva`, ya calculado por `computeLineTotals`; no se recalcula nada). Las líneas usan container
  queries sobre el ancho de la hoja: ≥700 px tabla (Producto · Cantidad · Precio · Desc. % · Desc. $ · IVA · Total),
  ≥480 px los cuatro campos en una fila con etiqueta, y en celular dos filas con el IVA bajo el total. Arreglado de
  paso: las etiquetas de celular se veían en escritorio y a 1280 px desaparecía el nombre del producto. Verificado en
  navegador a 1440, 1280 (oscuro) y 390 px. Reemplaza la nota de «columnas de descuento a pedido» de la entrada 4.
  Después: el control de cantidad se veía con una cajita interna (estilos de `@tailwindcss/forms` sobre el input
  numérico); ahora es un solo control `− n +` con foco en todo el stepper. A pedido del usuario se quitó «IVA 15 %»
  bajo el nombre del producto (y `lineTaxLabel`, sin otro uso): el IVA queda solo en su columna.

- 2026-11-06 (Claude, 7): menú lateral reorganizado por tarea (el usuario delegó la decisión). Grupos: Dashboard ·
  Vender · Caja y cobros · Documentos · Catálogo · Administración; «Infraestructura fiscal» pasa a submenú de
  Configuración; Insumos y Recetas salen del menú (siguen como pestañas de Inventario, mismas condiciones). Las
  condiciones que vivían en el grupo (`billing`, `restaurant`, roles de Principal, permiso de Configuración,
  `hideInApiOnly` de Reportes, `hideWhenFeature` de Documentos API) se bajaron a cada opción, así que la visibilidad no
  cambia. Etiquetas sin «Lista …» y en minúscula inicial (Facturas, Órdenes, Notas de crédito, Categorías corregida);
  el título de página sale de ellas. Nuevo `exactMatch` en `SubMenuItem` (Configuración → General no se marca en las
  subpáginas). Aspecto: títulos de grupo 11 px sin mayúsculas, opciones 13 px, activa con fondo suave + barra izquierda
  (sin borde ni sombra), sin líneas punteadas; contraído, una línea corta separa grupos; versión como texto discreto.
  Logo: el menú muestra siempre FacturADA; se quitó el logo del negocio del menú (una foto a 36 px no se leía y
  ocultaba la marca; sigue en el Dashboard). `proxy.conf.json` reenvía `/files` en desarrollo (las imágenes subidas
  salían rotas). Verificado en navegador como Administrador (mismas opciones que antes salvo Insumos/Recetas), claro,
  oscuro, contraído y celular. Para Codex: visibilidad del menú por rol (Cajero, Mesero, Cocina, Facturación, Usuario)
  y por plan (FACTURADOR, RESTO_BASICO, solo API) contra la versión anterior; `exactMatch`.

- 2026-11-06 (Claude, 6): logo del menú lateral. Antes: PNG antiguo (`only_logo_FA.png`) en un cuadrado violeta + texto
  «FacturADA» de 12 px, y nada con el menú contraído. Ahora el logo oficial del paquete de marca (copias en
  `src/assets/brand/`, `viewBox` recortado al contenido; originales intactos en `brand/`): completo con el menú abierto
  y en el menú de celular, versión «sobre oscuro» en tema oscuro (`dark:`), y el símbolo con el menú contraído, que
  además lo expande. Si el negocio subió su logo (`localStorage.logo`) se sigue mostrando ese, contenido y sin el
  cuadrado (luego retirado del menú, ver entrada 7). Verificado en navegador (claro/oscuro, abierto/contraído,
  celular). Pendiente: login, registro de empresa y navbar móvil siguen con `only_logo_FA.png`.

- 2026-11-06 (Claude, 5): elegir la terminal POS desde «Facturar» (opción C acordada). Con `pos_terminal` (billing + pos)
  la factura sale de la terminal activa; antes el encabezado solo la mostraba y había que cambiarla en la barra
  superior. Ahora el chip es el selector global reutilizado (`app-pos-terminal-switcher`, nuevas entradas `variant="chip"`,
  `disabled` y `beforeChange`), visible también sin terminal elegida («Elegir terminal»). Cambiar recarga la página: con
  productos en el carrito pide confirmación (`confirmTerminalChange`) y el navegador avisa antes de recargar o cerrar
  con una factura a medio armar (`beforeunload`, cubre el cambio desde la barra superior). Sin terminal elegida ya no se
  muestra «Serie …» engañosa. Selector con colores para modo oscuro. Se quitaron `terminalAssignmentLabel` y
  `posTerminalLabel` de Facturar (sin uso). Sin cambios de backend: Cajero/Facturación siguen necesitando terminal;
  Administrador/Gerente podrían facturar sin terminal según el backend, pero la pantalla sigue exigiéndola (decisión:
  la terminal define bodega y caja). Verificado en navegador (cafetería, 2 terminales, claro y oscuro); `ngc` OK.
  Para Codex: `beforeChange` cancela/confirma en el selector, chip con y sin terminal, confirmación solo con carrito.

- 2026-11-06 (Claude, 4): rediseño de «Nueva factura» (`pages/invoicing`), sin cambiar reglas ni llamadas al backend.
  Cliente, productos e información adicional van en una sola hoja con pasos separados por líneas (antes, tarjetas
  sueltas); solo el panel de Pago se eleva, con el acento del tema arriba y los totales como pie del comprobante (total
  grande, cifras tabulares). Modo oscuro corregido: todos los avisos/estados usaban fondos claros fijos (`*-50`); ahora
  tonos translúcidos `.tone-*` en el nuevo `invoicing.component.css`. Texto mínimo 12 px (antes 10-11 px), etiquetas sin
  mayúsculas sostenidas, controles de 36-40 px, foco visible en botones de icono. Las columnas de descuento se ocultan
  por defecto (`showDiscounts`, `discountsVisible`, «+ Aplicar descuentos»); no se pueden ocultar con un descuento
  cargado. Textos del buscador más claros (`productSearchHelpText`). Se conservaron todos los textos que verifican las
  pruebas de Codex. `ngc --noEmit` y `ng serve` OK. Para Codex: alternar descuentos, columna oculta con descuento
  cargado, reinicio al «+ Nueva factura».
  Revisado en navegador (Playwright, usuario cafeteria, 1440 px y 390 px, claro y oscuro) y corregido: en celular la
  barra fija de emitir quedaba tapada por la navegación inferior (visible bajo `xl`; ahora `.mobile-emit-bar` la sube);
  con descuentos la cantidad desaparecía (los descuentos pasan a una segunda fila con etiqueta visible); cantidad y
  precio con el mismo fondo. Global (`styles.css`): `.ng-select-tailwind .ng-select-container` ahora centra el valor
  verticalmente (antes quedaba pegado arriba en todos los selectores de la app).
  Pendiente propuesto: foco automático al buscador de productos tras elegir cliente y atajo para emitir; precio `5.5`
  en vez de `5.50` (`appDecimalInput` compartido); estilos globales `.input` duplicado y `badge-*` solo tema claro.

- 2026-11-06 (Claude, 3): avisos del panel (`shared/components/avisos`, «Caja», «Firma»…) ilegibles en modo oscuro:
  fondo fijo claro (`bg-yellow-50`) con texto `text-foreground` (casi blanco en oscuro). Ahora tinte translúcido
  (`bg-amber-500/10`, igual para error/info/success) con texto e icono de su color y variante `dark:`, mismo patrón
  que `.notice-info` del detalle de orden. Botón cerrar con `aria-label`. Solo HTML; `ngc --noEmit` OK; sin revisar en
  navegador.

- 2026-11-06 (Claude, 2): al iniciar sesión, Administrador y Gerente (rol de negocio) entran al panel
  (`/dashboard/main`) en lugar del POS. Primera regla de `CompanyCapabilitiesService.getLandingRoute`; el resto de
  roles no cambia (Cajero/Facturación siguen al POS o a Facturar, Mesero al POS, Cocina a Órdenes en vivo). También
  afecta el rebote del `RoleAccessGuard` (usa la misma ruta). `ngc --noEmit` OK; sin probar en navegador. Para Codex:
  ruta inicial por rol (Administrador/Gerente → panel; Cajero con POS → POS).

- 2026-11-06 (Claude): «Facturar» (`/dashboard/invoicing`) vuelve a aparecer en el menú cuando el POS genérico está
  activo. Se ocultaba por `hideWhenFeature: 'generic_pos'` en `core/constants/menu.ts`; la ruta nunca lo bloqueaba
  (exige `billing` + `direct_invoice` y `billing.create`, y el backend da `direct_invoice` = `billing`). Ahora conviven
  «Facturar» y «Punto de venta». Los accesos rápidos de Gerente/Facturación ya priorizaban `/dashboard/invoicing`.
  `ngc --noEmit` OK; sin probar en navegador. Para Codex: menú con `generic_pos` + `direct_invoice` muestra ambas
  entradas; sin `billing.create` no sale ninguna. Se quitó de `CLAUDE.md` la nota obsoleta «recetas sin commit».

- 2026-11-01 (Claude, 11): regla unificada «lo cobrado no cambia». Antes, una orden con pago bloqueaba la ronda nueva
  (`add_order_items`) pero dejaba corregir productos y montos desde la tarjeta (`update_order_for_invoice`), lo que
  alteraba un cobro que ya contaba en Caja. Backend Restaurante: `_ensure_items_unchanged_after_stock` pasa a
  `_ensure_items_unchanged(order, items, reason)` y se aplica también cuando la orden ya tiene pagos guardados
  (mensaje «La orden ya fue cobrada…»). Front: `itemsLockedByPayment` en `canEditItems`, aviso «Ya se cobró $X…» en la
  lista (y sin el aviso duplicado de la cabecera). Cliente, notas y forma de pago siguen editables; cobrar al final una
  cuenta abierta (sin pago previo) sigue permitiendo corregir productos en el mismo guardado. Python y `ngc --noEmit`
  OK; sin navegador ni tests backend (Codex: orden con pago + cambio de cantidad → rechazo; solo cambio de forma de
  pago → OK; cuenta sin pago → corrige y cobra en un guardado). Puede requerir reiniciar el backend.

- 2026-11-01 (Claude, 10): detalle de orden. (1) El buscador «+ Agregar producto» salía vacío («No items found»):
  `ProductsService.getAll` sin `limit` devuelve el arreglo directo y `loadProducts` leía `message.data`. Ahora acepta
  ambos y filtra como Facturar (activos, sin insumos). (2) En órdenes aún corregibles para facturar (lista editable) ya
  no sale «No se pueden agregar productos…», que contradecía al buscador; la regla de `canAddItems` no cambia
  (`addItemsBlocker` privado, `addItemsBlockedReason` solo decide si se muestra). `ngc --noEmit` OK; sin navegador.

- 2026-11-01 (Claude, 9): lista de productos del detalle de orden como tabla de columnas alineadas (`.items-row`,
  CSS grid): Producto · Cantidad · Precio unit. · Total · Quitar, con encabezado desde tablet; en celular el producto va
  en una línea y cantidad/precio/total en la siguiente. Miniatura 36 px, filas más bajas, stepper compacto
  (`.stepper-sm`), precio unitario como columna (antes repetido en «c/u»), totales alineados a la derecha (máx. 20rem)
  desde tablet, aviso de inventario más corto. Solo HTML/CSS. `ngc --noEmit` OK; sin probar en navegador.

- 2026-11-01 (Claude, 8): Fase 1 del flujo de mesa. Antes Administrador/Gerente/Cajero solo tenían «Cobrar» en el POS de
  Caja, así que toda orden nacía con pago y no admitía «+ Agregar productos». Ahora, con mesa elegida,
  `pos-caja` muestra «Enviar a cocina» / «Abrir cuenta» (`openTableTab`, sin pagos) como acción principal y
  «Cobrar ahora» como secundaria; sin mesa no cambia nada. Refactor: `buildBaseOrderPayload` compartido con
  `buildOrderPayload`. Sin cambios de backend (`create_order_v2` ya acepta Nota Venta sin pagos). `ngc --noEmit` OK;
  sin probar en navegador. Próximas fases propuestas: precuenta y «Cobrar» desde la tarjeta de la mesa; anular
  producto con motivo y autorización; separar en pantalla estado de cocina y estado de la cuenta.

- 2026-11-01 (Claude, 7): «+ Agregar productos» en el detalle de orden. Si no se puede (pagos, subcuentas o orden
  cerrada) ahora se explica bajo la línea de datos (`addItemsBlockedReason`, mismas reglas que `add_order_items`), y si hay
  cambios sin guardar pide confirmar antes de ir al POS (se perderían). Refactor: `isActiveOrder` y `canCreateOrders`
  compartidos por `canAddItems` y `canForceClose`. `ngc --noEmit` OK; sin probar en navegador.
  El motivo con pagos ahora dice cuánto se cobró («ya se cobró $13.81»). Verificado en el sitio piloto (FRO-00998): el pago
  se registra en el mismo instante que la orden (cobro en el POS de Caja), por eso «Lista» no permite agregar.
  Pendiente de decisión: permitir agregar a una orden ya cobrada cobrando la diferencia (requiere backend y Caja).

- 2026-11-01 (Claude, 6): revisión del detalle de orden. Verificado por lectura: `stock_consumed` llega a la pantalla
  (`normalizeRestaurantOrder` conserva el resto de campos); el guardado con inventario consumido es compatible con el
  backend (reenvía fila, cantidad y precio sin cambios; solo cliente/notas/pagos cambian). Ajustes: campo tipado en
  `OrderDTO` y relleno inferior de la página con `ngClass` (evita choque `pb-4`/`pb-28`). `ngc --noEmit` OK; sin
  pruebas Angular existentes para esta pantalla y sin probar en navegador.

- 2026-11-01 (Claude, 5): pulido del detalle de orden (solo HTML/CSS). La barra de cambios ya no tapa los totales
  (la página reserva espacio mientras está visible); la tarjeta de productos se ajusta al contenido (sin hueco
  interno); el bloqueo por inventario es un aviso `notice-info` sobre la lista; el modificador se ajusta al texto y
  cantidad + «Precio $» van en una línea; «Ir a Mesas» y «Nueva orden» pasan a enlaces en la línea de datos; en
  «Cobrar» el formulario de pago es un `<details>` que se pliega cuando no se puede facturar (el aviso queda arriba).
  Compila con `ngc --noEmit`; sin probar en navegador. Pendiente: el precio se ve `5.5` (formato de
  `appDecimalInput`, compartido) y los toasts de error se superponen al menú lateral (componente global).

- 2026-11-01 (Claude, 4): en el detalle de orden, con el inventario ya descontado el front dejaba editar
  cantidad/precio y el backend rechazaba al guardar («La orden ya consumio inventario…»). Backend Restaurante
  (`api/frontend.py`, `get_order_with_details`) ahora devuelve `stock_consumed` (campo aditivo, solo en el detalle) y el
  front (`itemsLockedByStock`, `canEditItems`) oculta stepper, precio, quitar y «Agregar producto», con un aviso que
  indica cancelar o cierre manual. Cliente, notas y pagos siguen editables. Python y `ngc --noEmit` OK; sin probar en
  navegador ni con tests backend (los hace Codex). Un backend sin el campo se comporta como antes.

- 2026-11-01 (Claude, 3): detalle de orden más automático. (1) Con un único pago, su monto sigue al total al
  cambiar cantidad, precio o productos (`onItemsEdited`), así que ya no sale «Faltan $X para cuadrar»; el aviso solo
  aparece con 2+ pagos que no cuadran y se quitó el de «los pagos cuadran». (2) El select de forma de pago salía
  vacío cuando la orden guardaba el método por descripción/código: `resolvePaymentMethodName` lo iguala con `name`
  (al cargar la orden y al llegar el catálogo). (3) Se quitó el texto «Los cambios pendientes se guardan
  automáticamente al facturar» (la barra inferior ya lo cubre). Compila con `ngc --noEmit`; sin probar en navegador.
  Sigue pendiente: sin ningún pago elegido, guardar productos exige elegir forma de pago (regla del backend).

- 2026-11-01 (Claude, 2): barra «cambios sin guardar» del detalle de orden. Antes decía solo «Cambios en productos o
  pagos sin guardar» y «Guardar cambios» fallaba con un toast si no había forma de pago (el backend
  `update_order_for_invoice` exige pagos que sumen el total incluso al guardar solo productos). Ahora la barra dice
  qué cambió (`pendingChangesSummary`: productos editados/agregados/quitados, forma de pago), la fila modificada se
  marca (`isItemChanged`, clase `.is-changed`) y muestra la razón cuando no se puede guardar (`saveBlockReason`:
  falta elegir forma de pago o el pago no cuadra) con el botón deshabilitado. `hasUnsavedInvoiceChanges` se refactorizó
  en `isItemChanged` / `pendingItemChanges` / `paymentsChanged` sin cambiar su resultado. Compila con `ngc --noEmit`;
  sin probar en navegador. Pendiente de decidir con backend: permitir guardar productos sin exigir pagos.

- 2026-11-01 (Claude): refinamiento visual del detalle de orden, sin cambiar el sistema de diseño ni la lógica
  (solo `order-detail-page.component.html/.css`). Columna de productos estirada con los totales al fondo; cantidad y
  precio agrupados bajo el nombre de cada producto; modificadores en `.item-note` (más legibles); stepper de progreso
  con pasos pendientes más visibles y etapa actual en negrita; en «Cobrar» el aviso «No se puede facturar…» va justo
  sobre «Facturar» y todo `.btn-main:disabled` se ve gris bloqueado; placeholder «Seleccionar forma de pago»; «Cambiar»
  cliente a la altura estándar de botones. Compila con `ngc --noEmit`; sin probar en navegador (pendiente revisar
  móvil, modo oscuro y orden con subcuentas). Sin pruebas nuevas: no cambia comportamiento.

- 2026-10-30: corregido consumo HTTP del catálogo de planes del Desk en Core (GET, antes POST implícito). Aplicación del plan sigue POST. Nueva prueba tests-e2e/desk-plans.spec.ts; suite de asistentes Desk 7 OK con APIs simuladas, sin código Angular modificado. No se aplicó ningún plan real ni hubo despliegue.

- 2026-10-29: limpieza de facturas/NC/guías de Pruebas solo en Desk Business, con vista previa, frase y controles de referencias, sin acceso desde Angular. Documentado en docs/MIGRACION_RESTAURANTE.md y guía backend docs/LIMPIEZA_PRUEBAS_DESK.md. Core 79 OK + Lite 251 OK; 6 pruebas navegador Desk OK. Sin cambios de código Angular ni repetir build/Karma, sin borrado real o despliegue.

- 2026-10-29 (Claude): al abrir «Cobrar pedido/venta» en el POS de Caja el foco va al campo «Efectivo recibido»
  (`abrirModalPago`, `cashReceivedInput`). Si la forma de pago inicial no es efectivo el campo no existe y no se enfoca
  nada. Compila con `ngc --noEmit`; sin probar en navegador.

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

### Retomar aquí: flujo de restaurante (sesión 2026-11-01, Claude)

Hecho y sin probar en navegador: refinamiento del detalle de orden, barra de cambios, bloqueo por inventario
(`stock_consumed`), motivo de «no se pueden agregar productos», «Enviar a cocina / Abrir cuenta» sin cobro en el POS
de Caja con mesa (Fase 1), lista de productos en columnas. Falta que el usuario revise la lista nueva en el navegador
(nombre largo, celular, modo oscuro, modo editable como Administrador).

**Siguiente tarea acordada (propuesta, falta el «sí» del usuario para implementar):** corregir una orden **Ingresada**
antes de que la cocina empiece.
- Hoy no se puede: el inventario se descuenta al crear la orden y desde ahí el backend bloquea productos/cantidades/
  precios; además el único guardado (`update_order_for_invoice`) exige forma de pago, y una orden con pago ya no admite
  cambios (círculo).
- Diseño: endpoint nuevo en Restaurante, solo productos (sin pagos). Permitido si la orden está Ingresada, todos los
  renglones en `kitchen_status` «Pendiente», sin pagos, factura ni subcuentas. En una sola transacción:
  `cancel_order_stock_movements` → reemplazar renglones → `create_order_stock_movements` (rechaza si no hay stock).
  Publicar `order.updated` para que cocina se actualice y Caja reciba «Pedido modificado» con «Reimprimir comanda».
- Front: en Ingresada vuelven cantidad, precio (Gerente/Administrador), quitar y agregar producto; «Guardar cambios»
  sin exigir pago. En Preparación/Lista sigue el aviso actual.
- Actualizar la regla en `CLAUDE.md` («Cliente en el detalle de la orden» / inventario consumido) y pedir pruebas a
  Codex: receta, falta de stock, plato ya iniciado, orden con pago.

**Fases siguientes del flujo de mesa (propuestas):**
- Fase 2: «Imprimir precuenta» en el detalle y en Mesas; «Cobrar» claro desde la tarjeta de la mesa y para nota de
  venta sin factura (hoy: chip de pago → «Guardar cambios» → «Cerrar orden», poco obvio).
- Fase 3: anular un producto ya enviado con motivo y autorización de Gerente/Administrador (devuelve insumos si no se
  preparó); separar en pantalla el estado de cocina del estado de la cuenta (la barra mezcla ambos).
- Riesgo a revisar: el buscador de la tarjeta corrige la orden para facturar (`update_order_for_invoice`) y no pasa por
  cocina ni descuenta inventario. En una orden sin movimientos de stock, agregar ahí un producto con inventario o
  receta no lo descontaría. Decidir si ese buscador debe limitarse a productos sin inventario o descontar stock.
- Otros: permitir agregar a una orden ya cobrada cobrando la diferencia (decidido no hacerlo por ahora); precio
  `5.5` en vez de `5.50` (`appDecimalInput` compartido); toasts sobre el menú lateral (componente global).

- Confirmar qué configuración de backend se usará para la próxima validación: localhost o red local.
- Corregir la ruta del proxy en el comando del README.
- Revisar las diferencias de dependencias y lockfile antes de consolidarlas.
- Ejecutar `npm run build` y validar manualmente login, selección de empresa y actualizaciones en tiempo real contra el backend elegido.
- Resolver el target de lint cuando se aborde la configuración de herramientas.
- Actualizar este archivo al cierre de la próxima sesión con resultados comprobados y pendientes vigentes.

Recordatorio operativo: un push a `main` despliega directamente a producción, sin staging intermedio.

## 2026-11-01 — Cliente en detalle de orden
- Detalle de orden: «Cambiar» cliente reemplaza el ng-select por `app-pos-customer-picker` (búsqueda en servidor + crear cliente).
- Backend restaurante: `update_order_for_invoice` ya no rechaza órdenes con inventario consumido si productos/cantidades/precios no cambian (antes: «No se puede actualizar una orden que ya consumio inventario»).
- Pendiente (Codex): pruebas del front y del endpoint; `tsc` del front compila sin errores, sin probar en navegador.
- 2026-11-01 (2): cliente se guarda al elegirlo (endpoint nuevo `update_order_customer`); tarjeta de cliente rediseñada; chips de pago rápido; «Facturar» autoguarda cambios pendientes. Compila (`ng build` dev); sin probar en navegador. Pruebas pendientes para Codex.
