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

Colores y tema (`src/styles.css`, `ThemeService`):
- Solo tokens del tema, nunca colores fijos de Tailwind (emerald, amber, red, sky, violet, slate…) para la interfaz.
  Neutros: `background`, `card`, `muted`, `border`, `foreground`, `muted-foreground`. Acción: `primary`,
  `destructive`. Estados: `success`, `warning`, `danger` e `info`, con escala 50…950 (`bg-success-50 text-success-800`,
  `border-warning-300`, `bg-danger-500/10`) y `-foreground` para sólidos. Atajos: `.tone-ok/info/warn/alert/danger`,
  `.badge-*`, `.btn-*`.
- Las escalas de estado se invierten solas en modo oscuro: no se escribe `dark:` para ellas. Un `dark:` solo hace falta
  para algo que no sea token.
- Tema por defecto «facturada»: azul de la marca `#2E3A8C` (en oscuro `#8B98F7`) y neutros con tinte marino. Los otros
  colores (`violet`, `blue`…) solo cambian el principal; no hay selector en pantalla. `ThemeService` pasa una vez a
  «facturada» a quien tenía `violet` guardado (marca `theme_palette` en `localStorage`).
- Gráficos ApexCharts: colores con `themeColor()` de `dashboard-charts.ts`, que lee las variables del tema.
- Azul marino `#1B1F3A` y ámbar `#FFB020` fijos solo en piezas de marca: login, panel del registro, logos y la carta
  pública (que tiene su propia paleta `--pm-*`).
- Los colores fijos que quedan son a propósito: capas oscuras detrás de ventanas, encabezados oscuros, degradados de los
  iconos de reportes y texto claro sobre fondos de color.



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
- Empresa de demostración (`business.is_demo` de `get_lite_setup`): solo Pruebas. «Producción» desactivada en
  Configuración; el backend rechaza perfil tributario, cliente API y emisión en Producción.
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
- Login contra Frappe por cookie de sesión (sin JWT). Pantalla `/auth/sign-in` con la marca FacturADA (no el color del
  tema ni el logo del último negocio); el ticket de ejemplo muestra cada vez un negocio distinto (tienda, ferretería,
  servicio técnico, cafetería…) porque el sistema es para cualquier negocio; errores junto al formulario. Sin recuperación por correo: «¿Olvidaste tu
  contraseña?» indica pedir una nueva al administrador (pantalla Usuarios). Con varios negocios, «Elige el negocio».
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

- «+ Agregar productos» (detalle de la orden → POS `?agregar=<orden>`) llama a `add_order_items`: solo suma renglones
  (lote `addition_batch`), cocina los ve «Agregado», comanda adicional solo del último lote.
- El detalle de la orden no edita productos (sin buscador, cantidades, precio ni quitar): sumar es «+ Agregar
  productos», quitar es «Anular…». `update_order_for_invoice` no pasa por cocina ni stock; el detalle solo lo usa para
  cliente y pago y le reenvía los ítems sin cambios. «Iniciar preparación»/«Marcar lista» usan `update_kitchen_order_status`.

## Sin cocina y «Mis órdenes»

- Sin `kitchen` no se ofrece «Enviar a cocina»/«Iniciar preparación». El mesero puro ve solo sus órdenes de hoy en
  «Órdenes» (`get_all_orders(mine=1)`, filtro de pantalla, no de seguridad).

## Pedidos sin mesa

- Se listan en la sección «Pedidos sin mesa» de Mesas y en «Órdenes» (visible al mesero por `restaurant.orders.create`).

## Cierre administrativo de órdenes

- «Cerrar manualmente…» (detalle de la orden; permiso `restaurant.orders.force_close`, Administrador y
  Gerente): motivo obligatorio, mesa libre, sin factura ni stock; no cobrada = no cuenta como venta.

## Anular un producto ya enviado

- Detalle de la orden, «Anular…» por producto (permiso `restaurant.orders.void_item`, Administrador y Gerente;
  `VoidItemDialogComponent`, `OrdersService.voidItem` → `void_order_item`). Cantidad parcial, motivo obligatorio. El
  renglón queda `kitchen_status = Cancelado` con `void_reason`/`voided_by`/`voided_at`/`stock_returned`: no suma ni se
  factura. Insumos vuelven solo si estaba Pendiente. Bloqueado con factura, pagos, subcuentas o último producto.
  El front separa los anulados (`voidedItems`) de lo editable (`orderItems`) y no los compara al guardar.
- Cocina no anula (`update_kitchen_item_status` rechaza `Cancelado`); recibe el aviso `item_voided`. Caja también.

## Carta / catálogo digital por QR (en código: «menu»)

- Feature `digital_menu` (todos los planes, no depende de `restaurant`), permiso `products.manage`. Restaurante dice
  «carta», el resto «catálogo»: usar `menuWords(menu_type)` / `PublicMenuService.wordsFor()` (género incluido), no
  escribir «carta» a mano. Sin `menu_type` (backend anterior) la página pública asume «Carta». El menú lateral cambia la
  etiqueta con `labelOutsideRestaurant` (`SubMenuItem`, resuelto en `menu.service.ts`).
- `DigitalMenuComponent` (`/dashboard/digital-menu`, feature `digital_menu`, permiso `products.manage`) y
  `PublicMenuComponent` (`/menu/:token`, ruta pública fuera del layout, sin sesión) con `PublicMenuService` →
  `facturada_restaurante.api.public_menu`. Fotos (hasta 20) o un PDF; pasar de uno a otro reemplaza con confirmación
  (`replace=1`). El QR (PNG) lo genera el backend con `pyqrcode` para el enlace público (ver abajo).
- La página pública tiene su propio contenedor con scroll (`h-[100dvh] overflow-y-auto`): `html` y `body` tienen
  `overflow: hidden` en toda la app. Producción: nginx debe servir `index.html` para `/menu/*` (como el resto de rutas).
- La página pública usa su propia paleta sobria (`public-menu.component.css`, variables `--pm-*` en `:host`) y el modo
  oscuro del teléfono (`prefers-color-scheme`), no el tema del panel. Termina siempre con un recuadro discreto de
  FacturADA, con mensaje genérico (no solo restaurantes);
  contacto y sitio en `core/constants/brand.constants.ts` (`BRAND`, `brandWhatsappUrl`), no repetirlos a mano.
- System Manager la gestiona también desde el Desk (formulario `FacturADA Restaurant Public Menu`, botón «Carta / catálogo
  digital» en FacturADA Business, sin grupo). Enlace y QR: `public_url` del backend (`facturada_app_url` en site_config, con prefijo:
  producción `https://facturada.bmarc-corp.com/portal`); sin configurar, `document.baseURI` de cada pantalla (respeta
  `baseHref`).

## Aviso de pedidos a Caja

- `NewOrderAlertService` avisa (sonido + toast con «Imprimir comanda») a quien cobra cuando otra persona
  crea una orden; también hay «Imprimir comanda» en cada orden abierta de Órdenes en vivo y un interruptor por equipo
  «Imprimir comandas solas» (marco oculto; sin diálogo solo con Chrome `--kiosk-printing`).

## Planes y módulos por negocio

- El front deriva módulos de `features`; los planes (FACTURADOR, RESTO_BASICO, RESTO_MESAS, RESTO_COCINA,
  RESTO_COMPLETO) se aplican en el Desk (Suscripción → «Aplicar plan»), catálogo en Core `api/plans.py`.
  Mesas y cocina son independientes de `restaurant`.

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

Lint (`eslint.config.js`, ESLint 9 directo; no `ng lint`, porque el builder de `angular-eslint` 22 pide Angular 22):
```
npm run lint
```
Reglas recomendadas de angular-eslint, sin `prefer-inject` ni `prefer-control-flow` (el proyecto usa constructor y
`*ngIf`). Línea base 2026-11-09: 19 avisos heredados (18 errores, 1 advertencia); un cambio no debe sumar nuevos.

Despliegue: cualquier `push` a `main` dispara `.github/workflows/deploy.yml`, que
compila y despliega automáticamente por SSH a producción. No hay ambiente de staging
intermedio: un push a `main` es un despliegue real.

---

# 11. Pruebas (responsabilidad de Codex)

Codex es el responsable de **crear y ejecutar** las pruebas del frontend y del backend.
Antes de hacerlo, lee y sigue [TESTING_CODEX.md](TESTING_CODEX.md): sitio de pruebas,
mocks obligatorios del SRI, comandos verificados, línea base y formato del reporte.

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
