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
- **Número de autorización ausente:** ya no impide importar facturas/NC antiguas.
  Se intenta recuperar desde un XML autorizado local coincidente; si no existe,
  queda vacío y aparece una advertencia. El documento conserva el estado declarado
  en el origen, pero sus notas/mensaje indican autorización no acreditada; no se
  marcan recepción ni autorización del proveedor como confirmadas. Sigue Migrado
  y de solo lectura. No se inventa el número ni se envía/consulta al SRI.
- **Clave de acceso ausente:** continúa bloqueando comprobantes declarados
  autorizados. XML ajeno, ambiguo o con DTD también sigue bloqueado.

La lógica antigua puede conservar AUTORIZADO sin persistir authorization_code;
por eso ese mensaje no demuestra por sí solo que el SRI rechazó la factura.

Contrato backend, namespace facturada_lite.migration.service:
get_context(business), preview multipart(business,warehouse?,file),
confirm(business,name), download_source(business,name). Solo administración Desk.
El ZIP original permanece privado; la normalización se aplica en memoria tanto
en revisión como en confirmación y no modifica ni borra el archivo original.

Guía completa: apps/facturada_lite/docs/TRANSFERENCIA_RESTAURANTE.md.
Pruebas: PRUEBAS_MIGRACION_DESK_2026-10-29.md.

## Corregir secuenciales desde el Desk

FacturADA Business → Configuración → Secuencias → abrir el registro y modificar
Secuencial actual. Solo Administrator o System Manager puede bajar ese valor.
Es el último número usado: colocar 50 deja 51 como siguiente. Angular no permite
disminuirlo, incluso usando una sesión de superadministrador. Se mantienen
rango 0..999999999, enlaces e identidad de la secuencia. Bajar el contador no
borra ni renumera documentos: no se reutilizan facturas/NC existentes (tampoco
anuladas), y el control del historial migrado sigue vigente al emitir.
