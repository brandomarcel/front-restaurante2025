# CLAUDE.md - Proyecto Facturada

## 1. Información general del proyecto

Nombre del proyecto:
Facturada

Descripción:
Sistema de gestión de facturación orientado a administrar procesos comerciales, emisión de comprobantes, clientes, productos, ventas e información relacionada.

Objetivo:
Mantener una arquitectura limpia, escalable y segura, permitiendo agregar nuevos módulos sin afectar funcionalidades existentes.

---

# REGLA DE ORO: documentación siempre al día

**Cada vez que hagamos cambios, actualiza el funcionamiento y el estado de la app, sin esperar a que el usuario lo pida.** Antes de dar una tarea por terminada:

1. `ESTADO.md` del repo o app tocada: qué se hizo, qué quedó pendiente y la fecha.
2. Funcionamiento: este `CLAUDE.md` y `AGENTS.md` si cambia un módulo, una regla de negocio o algo que el usuario ve en pantalla. En las apps backend, su `AGENTS.md` si cambia un invariante.
3. `TESTING_CODEX.md` si cambian comandos, rutas o la línea base de pruebas.
4. Contratos front↔back (`docs/`) si cambia lo que el front y el backend se envían.
5. Si un cambio hace falsa una nota anterior, corrígela o bórrala; no dejes dos versiones.

Los .md se actualizan en la misma sesión del cambio, y el resumen final lo menciona.

---

# 2. Rol de Claude Code

Actúa como un desarrollador senior encargado de mantener y evolucionar el sistema.

Antes de realizar cualquier cambio:

1. Analiza la estructura actual del proyecto.
2. Identifica dependencias e impacto de la modificación.
3. Explica qué archivos serán modificados.
4. Propón la solución antes de escribir código cuando el cambio sea importante.

No modificar arquitectura sin autorización.

No eliminar código existente sin justificarlo.

Priorizar soluciones mantenibles sobre soluciones rápidas.

---

# 3. Reglas generales de desarrollo

- Mantener código limpio y organizado.
- Evitar duplicación de código.
- Crear componentes reutilizables.
- Respetar la arquitectura existente.
- Mantener nombres descriptivos.
- No introducir librerías innecesarias.
- Revisar impacto en módulos relacionados.

---

# 4. Arquitectura del sistema

Antes de programar debes identificar:

## Frontend

Tecnología:
- Angular
- TypeScript
- Tailwind CSS

Responsabilidades:
- Interfaces de usuario
- Validaciones visuales
- Consumo de APIs
- Manejo de estados


## Backend

Tecnología:
- Frappe Framework
-Python

Responsabilidades:
- Lógica de negocio
- Seguridad
- APIs
- Procesamiento de información

# 5. Módulos principales

El front sirve dos modalidades de negocio desde el mismo código. La modalidad activa
no se elige en el front: se deriva de las *features* que el backend devuelve para la
empresa seleccionada (`CompanyCapabilitiesService`). Un mismo negocio puede tener
ambas activas a la vez.

## FacturADA Lite (facturador)

Funciones:
- Facturación directa y notas de crédito (`invoicing`, `invoices`, `credit-notes`). «Facturar» sale en el
  menú aunque el POS genérico esté activo: ambos conviven (solo depende de `direct_invoice` + `billing.create`).
  En «Nueva factura» cada línea muestra cantidad, precio, descuento %, descuento $, IVA y total; la fila se adapta al
  ancho de la hoja (tabla, campos en una fila, o dos filas en celular).
- Configuración de la empresa (`/settings/lite`, secciones Resumen, Datos tributarios, Firma, Plan): la barra «Guardar
  cambios» aparece solo con cambios sin guardar y permite «Descartar». El ambiente (Pruebas/Producción) se guarda aparte.
- Desde dónde se factura: sin POS, «Facturar» deja elegir establecimiento y punto de emisión. Con POS (`pos_terminal`)
  la factura sale de la terminal activa (fija serie, bodega y caja), que se elige o cambia desde el chip del encabezado
  de Facturar o desde la barra superior; varios establecimientos = una terminal por establecimiento. Cambiar recarga la
  página y, con productos en el carrito, pide confirmación.
- Punto de venta genérico y notas de venta (`pos-generic`, `pos-sale-notes`)
- Configuración tributaria: establecimientos, puntos de emisión, secuencias,
  certificado electrónico, terminales POS (`settings/lite/*`)
- Integración por API para negocios que facturan desde un sistema externo (modo "API-only")

## FacturADA Restaurante (POS de salón)

Funciones:
- Mesas y órdenes (`tables`, `orders`, `pos` con variantes Mesero/Cajero)
- Pantalla de cocina en tiempo real vía Socket.IO (`orders-realtime`)
- Caja: apertura, retiro y cierre (`caja/apertura`, `caja/retiro`, `caja/cierre`,
  `caja/gestion`)
- División de cuentas (order splits)

## Usuarios y permisos

Funciones:
- Login contra Frappe por cookie de sesión (sin JWT)
- Roles Frappe (ADMINISTRADOR, GERENTE, CAJERO, FACTURACION, USUARIO, MESERO)
- Autorización combinada de tres ejes evaluados por `RoleAccessGuard`: feature del
  plan, permiso del contexto de negocio y rol
- Selección y cambio de empresa activa (multi-negocio por usuario)
- Menú lateral (`core/constants/menu.ts`) agrupado por tarea: Dashboard · Vender (POS, Mesas, Órdenes, Pantalla de
  cocina, Facturar, Punto de venta) · Caja y cobros · Documentos · Catálogo · Administración (Reportes, Usuarios,
  Configuración ▸ con establecimientos, puntos, secuencias, terminales e integración API). Catálogo incluye «Carta digital» (restaurante). Las condiciones de
  plan/permiso/rol van en cada opción, no en el grupo; mover una opción de grupo no cambia quién la ve. El menú muestra
  siempre el logo de FacturADA (`src/assets/brand/`); el logo del negocio va en el Dashboard.
- Pantalla inicial tras el login (`getLandingRoute`): Administrador y Gerente → panel (`/dashboard/main`);
  Cajero/Facturación → POS o Facturar; Mesero → POS; Cocina → Órdenes en vivo.

## Clientes

Funciones:
- Registro y actualización de clientes
- Historial de compras

## Productos e inventario

Funciones:
- Catálogo, precios y categorías
- Control de stock (módulo Inventario)
- El saldo de un producto solo cambia con movimientos (Entrada, Salida, Ajuste). La ficha del
  producto no ajusta stock: «Stock inicial» al crear (en todo negocio con Inventario, también Lite) y «Ajustar en
  Inventario →» al editar. Un plato con receta muestra «Inventario por receta» en vez del control de stock.
- Variantes (u «opciones» en restaurante) solo con POS o Inventario: un negocio que solo factura crea el
  producto directo, sin el paso «Simple / Con variantes» ni el botón «Variantes». Un producto que ya tiene
  variantes conserva el botón. Es orientativo; el backend no lo restringe.

### Insumos y recetas (solo restaurante)

- Un **insumo** (`is_ingredient`) lleva stock y no se vende. Un **plato** tiene receta (insumo +
  cantidad por porción, merma, «el cliente puede pedirlo sin») y no lleva stock propio.
- Al crear la orden de restaurante se descuentan los insumos de la receta, no el plato.
  Cancelar la orden los devuelve. Una nota de crédito no los devuelve.
- Pantallas: pestañas **Insumos** y **Recetas** de Inventario (no van en el menú lateral; `/dashboard/inventory/ingredients` y
  `/recipes`, `pages/kitchen-supplies/`). El formulario de producto no crea insumos ni recetas.
- Requieren las funciones `restaurant` e `inventory`; el backend lo exige.
- El POS muestra las porciones que alcanzan (estimación) y el backend decide al crear la orden.
- Lenguaje según el negocio: restaurante dice «opciones» y propone «Sabor»; comercio dice
  "variantes" y propone Color/Talla. Un restaurante en inventario Simple no ve bodegas.

## Agregar productos a una orden abierta

- Si el cliente pide algo más, en el detalle de la orden «+ Agregar productos» (POS en modo agregar). Solo suma;
  no edita lo ya pedido. Bloqueado con factura, pagos o subcuentas. Cocina lo ve «Agregado», el stock se descuenta
  solo por lo agregado y la comanda adicional imprime únicamente ese lote. Quitar lo ya enviado: cancelar o cierre manual.

## Cuenta abierta de mesa (cobrar al final)

- En el POS de Caja con una mesa elegida, el botón principal es «Enviar a cocina» (o «Abrir cuenta» sin la función
  `kitchen`): crea la orden **sin pago**, como el mesero, y se cobra al final desde el detalle. «Cobrar ahora» queda
  como secundario. Sin mesa (mostrador, para llevar, domicilio) se cobra primero como siempre. Una orden con pago
  registrado no admite productos nuevos: lo adicional va en una orden nueva.

## Sin cocina y «Mis órdenes»

- Sin la función `kitchen` no hay «Enviar a cocina» ni «Iniciar preparación»: Caja imprime la comanda y cobra; la orden
  se cierra al cobrarse. El mesero puro ve en «Órdenes» solo sus órdenes de hoy (filtro de pantalla `mine=1`).

## Pedidos sin mesa

- Un pedido para llevar o a domicilio no pertenece a ninguna mesa: aparece en la sección «Pedidos sin mesa»
  de Mesas y en «Órdenes» (el mesero la ve con `restaurant.orders.create`).

## Cierre administrativo de órdenes

- «Cerrar» en Caja significa servida (se factura después). Para una orden que nunca se cerró (cliente se
  fue, duplicado, cobrada fuera del sistema) Administrador y Gerente usan «Cerrar manualmente…» en el
  detalle de la orden: motivo obligatorio, mesa libre, sin factura ni stock, auditado, y si no estaba
  cobrada no cuenta como venta. Permiso `restaurant.orders.force_close`.

## Anular un producto ya enviado

- Administrador y Gerente (`restaurant.orders.void_item`) anulan un producto desde el detalle de la orden
  (icono ⊘ «Anular…»): cantidad (puede ser parcial: 1 de 3), motivo obligatorio y detalle. El renglón queda tachado en
  «Anulados» con motivo, quién y cuándo: no se cobra, no sale en la factura ni en subcuentas, y cocina deja de verlo
  (recibe un aviso). Si cocina no lo había empezado (Pendiente) los insumos vuelven al inventario; si ya se preparaba,
  quedan como merma. Bloqueado con factura (se usa nota de crédito), pago guardado, subcuentas o si es el último
  producto (se cancela la orden). Cocina ya no puede marcar «Cancelado» por su cuenta.
- El encabezado del detalle separa **Cocina** (pendiente / X de N listos / lista) de **Cuenta** (por cobrar /
  cobrada / subcuentas / facturada); cada producto muestra su estado de cocina. La barra de progreso es solo de la
  orden (Ingresada → Cerrada).

## Carta digital por QR (solo restaurante)

- En pantalla se llama **«Carta digital»** (el código y la ruta usan `menu`). Catálogo ▸ «Carta digital»
  (`/dashboard/digital-menu`, Administrador y Gerente con `restaurant.manage`): el negocio sube su propia carta, **fotos**
  (hasta 20, JPG/PNG/WEBP, se optimizan) **o un PDF** (reemplaza todo), la publica y descarga el QR o imprime una tarjeta
  para la mesa. No usa el catálogo de productos (eso sería otra fase).
- También desde el **Desk** (System Manager, cualquier negocio): FacturADA Business → Restaurante → «Carta digital» abre
  o crea la carta; en ella, Archivos ▸ Subir fotos / Subir PDF y Compartir ▸ Ver como cliente / QR / Cambiar enlace.
  Publicar, mensaje, orden (arrastrar filas) y quitar archivos con el formulario normal.
- El enlace y el QR usan `facturada_app_url` del site_config (dónde vive la app Angular; el Desk está en el host de
  Frappe), con su prefijo. Producción: `https://facturada.bmarc-corp.com/portal` (la build usa `baseHref: /portal/`); piloto: `http://192.168.100.195:4200`. Sin configurar, el
  Desk lo avisa en rojo y cada pantalla usa su propio dominio.
- Un solo enlace por negocio, `/menu/<código secreto>`: cambiar fotos o PDF no cambia el QR; «Cambiar enlace» sí lo
  invalida (pide confirmación). Sin publicar, o con el negocio inactivo o sin `restaurant`, el cliente ve «no disponible».
- La página del cliente (`/menu/:token`) es pública, sin sesión ni menú lateral: portada con logo (o iniciales), nombre,
  mensaje y «Compartir carta»; fotos una debajo de otra (tocar = tamaño completo; con varias, barra de páginas fija), o un
  botón «Ver carta» que abre el PDF en el visor del teléfono. Paleta propia (no la del tema del panel) y modo oscuro del
  teléfono. Lleva su propio scroll porque `html`/`body` no hacen scroll.
- Al final, siempre (también en «no disponible»), un bloque de FacturADA para captar negocios: WhatsApp de BMARC-CORP con
  mensaje prellenado y enlace a bmarc-corp.com (`core/constants/brand.constants.ts`). No se puede ocultar por negocio.
- Backend: `facturada_restaurante.api.public_menu`; `get_public_menu` es el único endpoint sin sesión del sistema.

## Órdenes en vivo y pantalla de cocina (`orders-realtime`)

- Una sola palabra para cada paso de cocina en Caja, Cocina, el modal y el detalle: «Empezar a preparar», «Marcar
  lista», «Entregado» (`KITCHEN_NEXT_ACTION`). Todos mueven los platos (`update_kitchen_order_status`) y la orden los
  sigue; la etapa sale de los platos (`kitchenStage` en `ui/order-status.utils.ts`). Caja ya no tiene «Enviar a cocina»
  (el pedido está en cocina desde que se crea) ni «Cerrar orden» sobre una orden en preparación (la sacaba de la
  pantalla de cocina sin estar hecha).
- Caja: cada orden muestra el siguiente paso de cocina, «Cobrar» (o «Ver orden» si está facturada o cancelada) e
  imprimir comanda. Sin la función `kitchen`, solo imprimir y cobrar.
- Cocina: «En curso» (tres columnas; en celular una a la vez con pestañas) o «Entregadas hoy»; «Solo demorados»
  (20 min o más) y la espera promedio. Cada pedido marca «Para llevar» / «A domicilio» (`orderType`, del campo
  `order_type`; `type` de la vista mezcla el estado fiscal y no se muestra).

## Cliente en el detalle de la orden

- «Cambiar» cliente usa el buscador del POS (`app-pos-customer-picker`): búsqueda en servidor por nombre,
  cédula/RUC, teléfono o correo, Consumidor final y «Nuevo» para crear. Al elegir se guarda al instante
  (`update_order_customer`, solo cliente; no pierde ítems/pagos sin guardar). Avisa si Consumidor final supera $50.
- «Cobrar»: «¿Cómo paga?» con un botón por forma de pago (un toque = esa forma por el total); «Paga con dos formas»
  abre filas con monto. «Facturar» guarda solo los cambios pendientes (cliente y pago).
- **Los productos no se editan en el detalle de la orden** (ni cantidades, precios ni quitar): lo pedido ya está en
  cocina, inventario y comanda. Para sumar, «+ Agregar productos» (POS en modo agregar, pasa por cocina); para quitar,
  «Anular…» (Gerente/Administrador, con motivo). Antes el detalle editaba por `update_order_for_invoice`, que no pasa
  por cocina ni mueve stock ni deja registro. El backend sigue exigiendo los ítems al guardar: se reenvían sin cambios.
- Una orden **ya cobrada** (con pago guardado) no admite ronda nueva: lo cobrado ya cuenta en Caja; lo adicional va en
  una orden nueva. Con inventario consumido el backend también fija productos (`update_order_for_invoice`).
- «Iniciar preparación» y «Marcar lista» del detalle mueven los platos (`update_kitchen_order_status`), igual que la
  pantalla de cocina; sin la función `kitchen` cambian solo la orden. El encabezado no tiene barra de progreso.

## Aviso de pedidos a Caja

- Quien cobra (`billing.create`) recibe en cualquier pantalla un aviso sonoro y un toast con «Imprimir
  comanda» cuando otra persona crea una orden (`NewOrderAlertService`). La comanda también se imprime
  desde cada orden abierta de Órdenes en vivo (botón de impresora). «Imprimir comandas solas» (menú del perfil, por equipo) la
  manda sin ventana; sin diálogo solo con Chrome `--kiosk-printing` y la térmica como predeterminada.

## Planes y módulos por negocio

- Cada negocio activa solo lo que su plan incluye; el front lo deriva de `features` (no hay pantalla
  de módulos en el front). Los planes se aplican en el Desk (Suscripción → «Aplicar plan»), catálogo en
  `facturada_core/api/plans.py`: FACTURADOR, RESTO_BASICO (mostrador, sin mesas ni cocina), RESTO_MESAS,
  RESTO_COCINA, RESTO_COMPLETO (+ inventario/insumos/recetas). Mesas y cocina son independientes de `restaurant`.

## Ventas

Funciones:
- Registro de venta (POS restaurante y POS genérico)
- Detalle de productos por venta/orden
- Estados de la orden y de la caja

## Facturación electrónica

Funciones:
- Generación de comprobantes autorizados por el SRI (facturas, notas de crédito)
- Manejo explícito de estados de emisión: AUTHORIZED, PROCESSING, REJECTED,
  PROVIDER_ERROR, ERROR (`lite-invoice-emission.ts`)
- Regla crítica: ante códigos SRI 43/70 solo se permite *consultar*, nunca reemitir
  el mismo comprobante (`lite-invoice-actions.ts`)
- Datos tributarios: RUC, régimen, agente de retención, obligado a llevar contabilidad

## Reportes

Funciones:
- Reportes nativos de Frappe embebidos (`frappe-reports`)
- Órdenes, productos más vendidos, ventas por forma de pago, comprobantes electrónicos
- Cierre de caja

---

# 6. Reglas para cambios de código

Cuando implementes una funcionalidad:

Antes:

Explica:
- Qué archivos modificarás.
- Qué lógica agregarás.
- Posibles riesgos.

Después:

Indica:
- Archivos modificados.
- Cómo probar la funcionalidad.
- Posibles mejoras futuras.

---

# 7. Seguridad

Considerar siempre:

- Validación de datos.
- Protección de información sensible.
- Manejo correcto de errores.
- Control de permisos.
- No exponer claves o variables privadas.

---

# 8. Testing

Toda nueva funcionalidad debe considerar:

- Pruebas unitarias cuando sea posible.
- Pruebas de integración si afecta APIs.
- Validación manual del flujo completo.

---

# 9. Estilo de trabajo

No asumir información faltante.

Si falta contexto:

Preguntar antes de implementar.

Cuando existan varias soluciones:

Comparar ventajas y desventajas.

Priorizar:
1. Correctitud.
2. Seguridad.
3. Mantenibilidad.
4. Rendimiento.
5. Rapidez.

---

# 10. Comandos del proyecto

Instalación:
```
npm install
```

Desarrollo (usa el proxy de `src/proxy.conf.json` hacia el backend Frappe):
```
npm start
```

Build de producción:
```
npm run build
```

Pruebas unitarias (Karma/Jasmine):
```
npm test
```

Pruebas E2E (Playwright):
```
npm run test:e2e
```

Formateo:
```
npm run prettier
npm run prettier:verify
```

Lint: `npm run lint` está roto actualmente (no existe target `lint` en `angular.json`
tras la migración a `angular-eslint` 22). No usar como validación hasta corregirlo.

Despliegue: cualquier `push` a `main` dispara `.github/workflows/deploy.yml`, que
compila y despliega automáticamente por SSH a producción. No hay ambiente de staging
intermedio: un push a `main` es un despliegue real.

---

# 11. Contexto del ecosistema (no repetir al usuario)

## Alcance de trabajo

- **Front activo:** este repo (`/home/frappe/front-restaurante2025`, Angular).
- **Backend activo:** apps `facturada_*` en `/home/frappe/frappe-bench/apps`:
  `facturada_core`, `facturada_lite`, `facturada_restaurante`, `facturada_api`,
  `facturada_platform` (legacy). `facturada_erpnext` / `facturada_erpnext_lab` son
  integraciones ERPNext aparte (no leídas aún; leer solo si la tarea las toca).
- **IGNORAR:** `restaurante_app` (antiguo) y `/home/frappe/front-gym` / `gym_management`
  (otra app distinta; solo interactúa con Lite vía recibos y fuentes protegidas).
- Cada app backend tiene `AGENTS.md` (reglas), `ESTADO.md` (estado/pendientes) y a veces
  `docs/`. Releer su `ESTADO.md` antes de tocar esa app.
- Contratos front↔back documentados en `facturada_lite/docs/`:
  `frontend_electronic_states.md` (copia en este repo), `frontend_sales_reports.md`,
  `frontend_invoice_cancellation.md`. Si cambia el backend, actualizar ambas copias.

## Reparto de responsabilidades en el backend

- **Core:** negocio, usuarios/roles, licencias/features, perfil tributario,
  establecimientos, puntos de emisión, secuencias, terminales POS, bodegas,
  `ui_capabilities`. Matriz de permisos en `api/business_permissions.py`.
- **Lite:** facturas, NC, guías de remisión, productos/variantes, clientes, inventario,
  notas de venta POS, recibos/cobros, reportes. API para el front en `api/frontend.py`
  (`get_user_context`, `get_available_business_roles`).
- **Restaurante:** mesas, órdenes, cocina, splits, caja (apertura/retiro/cierre),
  tickets/comandas, `get_dashboard_metrics`.
- **API:** adaptador externo `/api/v1/facturada` (clientes API, no lo usa el front).
- Roles de negocio: Administrador, Gerente, Cajero, Facturacion, Mesero, Cocina, Usuario
  (+ Recepcionista solo con feature `gym`). Roles autorizan acciones; features habilitan
  módulos; nunca inferir uno del otro. `Administrator` de Frappe ≠ rol Administrador.

## Reglas del backend que el front debe respetar

- Usar `ui_capabilities` de `get_user_context` para decisiones de UI nuevas; no quitar
  `features`/`permissions` legados. La visibilidad en front es solo orientativa: el
  backend autoriza.
- No confiar en totales/impuestos/stock calculados en front; el backend recalcula.
- Estados SRI: consulta y reintento son distintos. `PROCESSING`/pendiente → solo
  consultar (nunca reemitir). Códigos 43/70 → solo consultar. Facturas
  `Reemplazada`/con `regenerated_invoice` no permiten reintento ni revisión manual.
- La lista de Facturas solo trae `Factura`; las NC van por `get_all_credit_notes`.
  `credit_note_summary` (FULL/PARTIAL/PENDING/NONE): solo FULL se muestra como anulación
  por compensación; el estado fiscal original no cambia.
- Una orden de restaurante se factura una sola vez. Una nota POS con `lite_invoice` no se
  cancela: se usa nota de crédito. Estados de cocina ≠ estados tributarios.
- El stock sale al enviar la venta numerada (antes del SRI), no al autorizar; NC
  reingresan al autorizar. Borradores no mueven stock.
- Reportes comerciales: solo facturas vigentes; "cobrado" es acumulado actual, no caja
  diaria. `posting_date` es fecha; para hora usar `creation`/`movement_datetime`.
- Zona horaria de vigencia del certificado: Ecuador continental (backend valida en UTC).

## Entorno de desarrollo

- Sitio piloto: `facturada_core_simple_test`, backend en `127.0.0.1:8002`, Socket.IO en
  `:9000`. Proxy en `src/proxy.conf.json` (alternativa red local: `proxy.conf_local.json`).
- Arrancar front: `npx ng serve --host 0.0.0.0 --port 4200 --proxy-config src/proxy.conf.json`.
- Tests backend: `bench --site facturada_core_simple_test run-tests --module <modulo>`;
  Redis no disponible hace fallar varias suites (no afirmar que pasaron).
- Cambios de DocType/campos requieren `bench --site <sitio> migrate`.
- Mantener `ESTADO.md` (este repo y cada app) al cierre de sesión cuando el usuario lo pida.

## Pendientes conocidos (a 2026-10-28)

- Front: `npm run lint` roto; ruta de proxy del README; revisar `package-lock.json` y la
  dependencia `@tailwindcss/oxide-linux-x64-gnu`; filtros estado/tipo/ambiente del
  endpoint de métricas del dashboard; nginx sirviendo `ngsw.json` sin caché; PWA en Android/iOS;
  impresión desde celular o tablet.
- Lite: Cuentas por Cobrar e Historial de Abonos (acordar contrato con el front antes);
  reporte de ingresos por fecha real de abono.
- Restaurante / recetas: conversión de unidades (comprar en kg, recetar en g); costeo y margen;
  devoluciones (una nota de crédito no devuelve insumos; un plato anulado ya en preparación tampoco, es merma); cancelar
  una orden falla si otra orden movió después el mismo producto (Lite solo cancela el último movimiento); las ventas
  directas de un plato en Lite no descuentan insumos; carga masiva de insumos y recetas;
  al volver de Por Bodega a Simple el stock de las bodegas no se consolida; probar la factura
  SRI real de una orden con receta (sin doble salida).

## Lecturas al iniciar una sesión (si el usuario pide "retomar")

1. `/home/frappe/front-restaurante2025/ESTADO.md` (estado del front).
2. `ESTADO.md` de la app backend que toque la tarea, en `/home/frappe/frappe-bench/apps/<app>/`
   (`facturada_lite`, `facturada_core`, `facturada_restaurante`, `facturada_api`).
3. `AGENTS.md` de esa misma app, solo si se va a modificar su código.
4. Contratos front↔back en `facturada_lite/docs/` si la tarea toca estados SRI, reportes
   o anulaciones.
No leer `restaurante_app` ni `front-gym` salvo que el usuario lo pida.

## Pruebas: las hace Codex

Por decisión del usuario, **Codex crea y ejecuta las pruebas** (front y backend) siguiendo
`TESTING_CODEX.md`. Por defecto Claude no escribe ni corre pruebas; si un cambio necesita
pruebas, indícalo en el resumen final para que Codex las haga, y mantén `TESTING_CODEX.md` al
día cuando cambien comandos, rutas o reglas. **Excepción:** si el usuario pide expresamente
que Claude haga las pruebas (ocurrió en la sesión de recetas, 2026-10-27/28), las escribe y
corre con los comandos de `TESTING_CODEX.md`, sin tocar las aserciones de Codex: solo ajusta
fixtures cuando cambia una regla, y lo dice.

## Migración desde Restaurante (2026-10-29)

La carga administrativa se hace exclusivamente en el Desk: abrir FacturADA
Business → Migración → Importar desde Restaurante, o buscar FacturADA Legacy
Import → Importar desde Restaurante. Requiere System Manager/Administrator y
permiso Administrador del negocio en backend. Angular no tiene pantalla, enlace
ni ruta company-migration. Conserva las marcas Migrado y bloqueos de operación
en las listas/detalles de históricos. Destino vacío salvo consumidor final y
mismo RUC; revisión antes de confirmación atómica/idempotente. Stock actual por
entradas únicas; historial de movimientos conservado en ZIP. No traslada usuarios,
firmas, planes ni configuración fiscal. Ver docs/MIGRACION_RESTAURANTE.md.

En la migración histórica se permite número de autorización ausente con
advertencia: estado declarado del origen, número vacío, notas/mensaje de
autorización no acreditada, estados técnicos UNKNOWN y recepción no confirmada.
No cambia el carácter Migrado/solo lectura ni habilita reemisión o cobro.

La eliminación administrativa de comprobantes de Pruebas por negocio está solo
en Desk: FacturADA Business → Mantenimiento → Eliminar documentos de Pruebas.
No ofrecerla desde Angular. Requiere superadministración, revisión y confirmación;
no borra Producción ni operaciones vinculadas, no reinicia secuencias ni cupos.
Backend: facturada_lite.api.sandbox_cleanup; guía en Lite docs/LIMPIEZA_PRUEBAS_DESK.md.
