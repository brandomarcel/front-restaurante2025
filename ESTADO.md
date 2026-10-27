# Estado del proyecto Facturada

Última actualización: 2026-10-26.

## Objetivo Actual

Mantener una memoria breve del progreso y los pendientes sin ampliar `CLAUDE.md`.
El trabajo local observado se concentra en la configuración de desarrollo del frontend Angular y su conexión con Frappe.

## Últimos Cambios (Hecho)

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
