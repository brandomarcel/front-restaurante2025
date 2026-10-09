# Estado del proyecto Facturada

Última actualización: 2026-10-06.

## Objetivo Actual

Mantener una memoria breve del progreso y los pendientes sin ampliar `CLAUDE.md`.
El trabajo local observado se concentra en la configuración de desarrollo del frontend Angular y su conexión con Frappe.

## Últimos Cambios (Hecho)

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
