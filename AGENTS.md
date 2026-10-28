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

## Aviso de pedidos a Caja

- `NewOrderAlertService` avisa (sonido + toast con «Imprimir comanda») a quien cobra cuando otra persona
  crea una orden; también hay «Imprimir comanda» en las tarjetas «Nuevas» de Órdenes en vivo.

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

Lint: `npm run lint` está roto actualmente (no existe target `lint` en `angular.json`
tras la migración a `angular-eslint` 22). No usar como validación hasta corregirlo.

Despliegue: cualquier `push` a `main` dispara `.github/workflows/deploy.yml`, que
compila y despliega automáticamente por SSH a producción. No hay ambiente de staging
intermedio: un push a `main` es un despliegue real.

---

# 11. Pruebas (responsabilidad de Codex)

Codex es el responsable de **crear y ejecutar** las pruebas del frontend y del backend.
Antes de hacerlo, lee y sigue [TESTING_CODEX.md](TESTING_CODEX.md): sitio de pruebas,
mocks obligatorios del SRI, comandos verificados, línea base y formato del reporte.
