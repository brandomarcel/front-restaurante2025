# Importación histórica sin número de autorización

2026-10-29. Por decisión explícita del usuario, falta de authorization_code en
facturas/NC históricas declaradas autorizadas pasa de error a advertencia.

Suite Lite completa: **238 OK** en facturada_core_simple_test, con datos ficticios,
rollback y bloqueo de HTTP/SMTP reales. Casos actualizados/agregados:

- Factura sin autorización: importa sin inventar número; conserva clave/estado de
  origen, mensaje y nota de autorización no acreditada, estados técnicos UNKNOWN,
  recepción no confirmada y protección de solo lectura; sin proveedor/cuota/correo.
- NC sin autorización: importa conservando vínculo a la factura e identidad.
- XML de factura sin envoltura de autorización: conserva el archivo e información,
  sin deducir el número de autorización a partir de la clave.
- Falta de clave, DTD (incluido UTF-16), XML ajeno/ambiguo siguen bloqueados.

Comando desde el Bench, arnés de red temporal activo según TESTING_CODEX.md:

```bash
PYTHONPATH=/tmp/facturada-legacy-tests-fence bench --site facturada_core_simple_test run-tests --app facturada_lite
```

El arnés /tmp es temporal y debe restaurarse antes de futuras ejecuciones.
Evidencia: /tmp/facturada-historical-authorization-tests.log (238 OK).
No se repitieron Core, Restaurante, API ni Angular: no cambió su código en esta
revisión. Sin cambio de esquema, llamadas al SRI, importación real o despliegue.

Los resultados históricos de reportes anteriores donde la falta del número
bloqueaba describen el comportamiento anterior; esta revisión lo sustituye.
