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
- Facturación directa y notas de crédito (`invoicing`, `invoices`, `credit-notes`)
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

## Clientes

Funciones:
- Registro y actualización de clientes
- Historial de compras

## Productos e inventario

Funciones:
- Catálogo, precios y categorías
- Control de stock (módulo Inventario)
- El saldo de un producto solo cambia con movimientos (Entrada, Salida, Ajuste). La ficha del
  producto no ajusta stock: «Stock inicial» al crear y «Ajustar en Inventario →» al editar.

### Insumos y recetas (solo restaurante)

- Un **insumo** (`is_ingredient`) lleva stock y no se vende. Un **plato** tiene receta (insumo +
  cantidad por porción, merma, «el cliente puede pedirlo sin») y no lleva stock propio.
- Al crear la orden de restaurante se descuentan los insumos de la receta, no el plato.
  Cancelar la orden los devuelve. Una nota de crédito no los devuelve.
- Pantallas: Inventario → **Insumos** y **Recetas** (`/dashboard/inventory/ingredients` y
  `/recipes`, `pages/kitchen-supplies/`). El formulario de producto no crea insumos ni recetas.
- Requieren las funciones `restaurant` e `inventory`; el backend lo exige.
- El POS muestra las porciones que alcanzan (estimación) y el backend decide al crear la orden.
- Lenguaje según el negocio: restaurante dice «opciones» y propone «Sabor»; comercio dice
  "variantes" y propone Color/Talla. Un restaurante en inventario Simple no ve bodegas.

## Agregar productos a una orden abierta

- Si el cliente pide algo más, en el detalle de la orden «+ Agregar productos» (POS en modo agregar). Solo suma;
  no edita lo ya pedido. Bloqueado con factura, pagos o subcuentas. Cocina lo ve «Agregado», el stock se descuenta
  solo por lo agregado y la comanda adicional imprime únicamente ese lote. Quitar lo ya enviado: cancelar o cierre manual.

## Sin cocina y «Mis órdenes»

- Sin la función `kitchen` no hay «Enviar a cocina» ni «Iniciar preparación»: Caja imprime la comanda y cobra; la orden
  se cierra al cobrarse. El mesero puro ve en «Lista Órdenes» solo sus órdenes de hoy (filtro de pantalla `mine=1`).

## Pedidos sin mesa

- Un pedido para llevar o a domicilio no pertenece a ninguna mesa: aparece en la sección «Pedidos sin mesa»
  de Mesas y en «Lista Órdenes» (el mesero la ve con `restaurant.orders.create`).

## Cierre administrativo de órdenes

- «Cerrar» en Caja significa servida (se factura después). Para una orden que nunca se cerró (cliente se
  fue, duplicado, cobrada fuera del sistema) Administrador y Gerente usan «Cerrar manualmente…» en el
  detalle de la orden: motivo obligatorio, mesa libre, sin factura ni stock, auditado, y si no estaba
  cobrada no cuenta como venta. Permiso `restaurant.orders.force_close`.

## Aviso de pedidos a Caja

- Quien cobra (`billing.create`) recibe en cualquier pantalla un aviso sonoro y un toast con «Imprimir
  comanda» cuando otra persona crea una orden (`NewOrderAlertService`). La comanda también se imprime
  desde las tarjetas «Nuevas» de Órdenes en vivo. «Imprimir comandas solas» (menú del perfil, por equipo) la
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
- Lista Facturas solo trae `Factura`; las NC van por `get_all_credit_notes`.
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
  devoluciones (nota de crédito y plato cancelado desde cocina no devuelven insumos); las ventas
  directas de un plato en Lite no descuentan insumos; carga masiva de insumos y recetas;
  al volver de Por Bodega a Simple el stock de las bodegas no se consolida; probar la factura
  SRI real de una orden con receta (sin doble salida).
- Todo el trabajo de recetas, insumos, variantes por tipo de negocio y bodegas está **sin commit**.

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
