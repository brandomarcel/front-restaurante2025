# Migrar Restaurante desde el Desk de FacturADA

Actualizado: 2026-10-29. La carga se retiró de Angular; la ruta
`/dashboard/company-migration` ya no existe.

1. Preparar en FacturADA un negocio vacío con el mismo RUC y los módulos requeridos.
2. En el sistema antiguo: Company → Migración → Exportar para FacturADA.
3. En Desk de FacturADA: FacturADA Business → abrir el negocio → Migración →
   **Importar desde Restaurante**. También desde la lista FacturADA Legacy Import.
4. Elegir ZIP y bodega si aplica; pulsar **Revisar archivo**.
5. Revisar cantidades, errores, advertencias y secuenciales. **Descargar diagnóstico**
   permite guardar todos los mensajes. Confirmar solo cuando no haya errores.

Requiere System Manager/Administrator y autorización de administrador sobre el
negocio. La API también comprueba ambos permisos. Cambiar negocio, bodega o ZIP
invalida la revisión. La confirmación vuelve a validar y carga atómicamente.
Los históricos siguen en las listas normales de Angular con marca Migrado y
solo lectura; no se reactivan emisión, cobros, caja ni movimientos históricos.

## Errores del sistema anterior

- **Identificación ausente:** solo se recupera automáticamente desde el nombre
  exacto `<empresa>-<10 o 13 dígitos>`, convención del DocType Cliente antiguo.
  La recuperación queda en advertencias. Si no coincide, corregir el origen.
- **Identificación duplicada:** el diagnóstico muestra el valor y ambos registros.
  No se fusionan personas automáticamente; corregir las referencias en el origen.
- **Clave/autorización ausente:** puede recuperarse de un XML autorizado local
  incluido en el ZIP. Debe contener estado AUTORIZADO, número de autorización y
  comprobante correspondiente al RUC/tipo/ambiente/serie/clave. Un XML de factura
  firmado sin envoltura de autorización no acredita ese número. Si falta evidencia,
  adjuntar la autorización original al documento en el origen y exportar otra vez.
  No se inventa la autorización ni se envía/consulta nada al SRI.

La lógica antigua puede conservar AUTORIZADO sin persistir authorization_code;
por eso ese mensaje no demuestra por sí solo que el SRI rechazó la factura.

Contrato backend, namespace facturada_lite.migration.service:
get_context(business), preview multipart(business,warehouse?,file),
confirm(business,name), download_source(business,name). Solo administración Desk.
El ZIP original permanece privado; la normalización se aplica en memoria tanto
en revisión como en confirmación y no modifica ni borra el archivo original.

Guía completa: apps/facturada_lite/docs/TRANSFERENCIA_RESTAURANTE.md.
Pruebas: PRUEBAS_MIGRACION_DESK_2026-10-29.md.
