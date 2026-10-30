# Secuencias: excepción de superadministración solo Desk

2026-10-29. Validación contra facturada_core_simple_test, datos ficticios y rollback.

- Core: **79 OK**, incluye 4 nuevas: bajar mediante documento Desk como Administrator;
  System Manager permitido frente a rol Administrador de negocio rechazado;
  API Angular rechaza bajar incluso para Administrator y permite aumentar;
  superadministrador conserva límites e identidad inmutable.
- Lite: **235 OK**, incluye una nueva que impide numerar una factura cuando el
  siguiente número ya está en una factura anulada del mismo negocio/ambiente/serie.
  No se entrega clave ni se modifica el documento anterior.

Comandos desde el Bench con arnés HTTP/SMTP bloqueado activo:

```bash
PYTHONPATH=/tmp/facturada-legacy-tests-fence bench --site facturada_core_simple_test run-tests --app facturada_core
PYTHONPATH=/tmp/facturada-legacy-tests-fence bench --site facturada_core_simple_test run-tests --app facturada_lite
```

El arnés de /tmp es temporal; restaurar bloqueo equivalente según TESTING_CODEX.md
antes de repetir. Evidencia /tmp/facturada-sequence-core-tests.log y
/tmp/facturada-sequence-lite-tests.log. Sin cambios de esquema ni datos reales.
No hubo cambios de código Angular ni se repitieron sus pruebas/build en esta
revisión. No se desplegó ni modificó ningún contador de una empresa real.

El permiso de bajar el contador no omite el control de números/contadores del
historial importado al emitir; no renumera documentos existentes.
