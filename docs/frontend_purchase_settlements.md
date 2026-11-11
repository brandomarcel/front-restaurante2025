# Contrato front ↔ backend: liquidaciones de compra (Lite)

Estado: 2026-11-11. Primera versión: 2026-11-10. Copia en el front: `docs/frontend_purchase_settlements.md` (mantener iguales).

La **liquidación de compra de bienes y prestación de servicios** (SRI codDoc 03, versión 1.1.0) la emite el negocio
cuando compra a alguien que no puede darle factura: una persona sin RUC (agricultor, artesano, quien presta un
servicio ocasional) o un extranjero no residente. Es parecida a una factura, pero el negocio es el comprador y el
documento va a nombre del **proveedor**. Ciclo igual que retenciones y guías: borrador → emitir → estados SRI
compartidos (`frontend_electronic_states.md`). Consume cupo del plan en Producción. **No mueve inventario**: si lo
comprado es mercadería, la entrada se registra en Inventario como siempre.

## Quién y cuándo

- Requiere la función `billing`. `ui_capabilities.modules.purchase_settlements` = `{visible, can_create, can_manage}`
  (`visible` = `billing` + `billing.read`). Permisos: listar/detalle/PDF/XML `billing.read`; crear/emitir
  `billing.create`; consultar/reintentar/revisión `billing.manage`. Necesita la secuencia «Liquidacion de Compra».
- Proveedores: los mismos de retenciones (`get_lite_suppliers`, `save_lite_supplier`, ver
  `frontend_withholdings.md`). La liquidación se emite a cédula (05), pasaporte (06) o identificación del exterior
  (08). Con RUC (04) el backend la rechaza: quien tiene RUC debe entregar su factura.
- La fecha de emisión es siempre la del día en que se emite.
- Después de autorizada, si el negocio es agente de retención, el front ofrece «Crear retención» (formulario de
  retención con documento sustento 03, el número y la autorización de la liquidación, el proveedor y las bases ya
  puestos; sustento tributario 01 si la liquidación tiene IVA y 02 si no, el mismo que pone la contabilidad a su
  compra; el SRI exige retener el 100 % del IVA de una liquidación y el concepto 311 es el 3 %).

Métodos en `facturada_lite.api.frontend`, todos con `business` opcional. POST con `payload` cuando se indica.

## Configuración del formulario

```
GET get_purchase_settlement_setup(business)
-> {data: {
  block_message: string | null,     // sin firma, sin secuencia, sin billing…
  withholding_agent: boolean,       // para ofrecer «Crear retención» después de autorizada
  tax_codes: {code: string, label: string, rate: number}[],   // 0=IVA 0 %, 4=IVA 15 %, 5=5 %, 6=No objeto, 7=Exento…
  payment_methods: {code: string, label: string}[],           // 01 efectivo (sin sistema financiero), 20 transferencia…
  identification_types: {code: string, label: string}[],      // 05 Cédula, 06 Pasaporte, 08 Exterior
}}
```

## Liquidaciones

```
GET  get_all_purchase_settlements(business, limit=20, offset=0, status?, environment?, search?, from_date?, to_date?)
     -> {data: PurchaseSettlement[], total, limit, offset, has_next,
         status_counts: {ALL, Autorizada, EN_PROCESO, CON_ERROR, Anulada}}
     search: número, clave de acceso, proveedor (nombre o identificación), descripción de un producto.
GET  get_lite_purchase_settlement_detail(name, business)                     -> {data}
POST create_lite_purchase_settlement(business, payload: SettlementInput)       -> {data}   // borrador; con payload.name actualiza
POST create_and_emit_lite_purchase_settlement(business, payload)              -> {data, emission}
POST emit_lite_purchase_settlement(settlement_name, business)                 -> {data, emission}
POST refresh_lite_purchase_settlement_status(settlement_name, business)       -> {data, emission}
POST retry_lite_purchase_settlement(settlement_name, business)                -> {data, emission}
POST confirm_lite_purchase_settlement_electronic_review(settlement_name, business) -> {data}
GET  download_lite_purchase_settlement_pdf(name, business)   // RIDE
GET  download_lite_purchase_settlement_xml(name, business)   // XML autorizado
```

```ts
interface SettlementInput {
  name?: string;
  establishment?: string; emission_point?: string; environment?: 'Pruebas' | 'Produccion';
  supplier: string;                 // Supplier.name (cédula, pasaporte o exterior)
  forma_pago: string;               // '01' efectivo por defecto
  items: {
    descripcion: string;            // qué se compró (obligatorio)
    codigo?: string;                // código interno opcional
    unidad_medida?: string;         // 'kg', 'unidad'… opcional
    cantidad: number;               // > 0
    precio_unitario: number;        // >= 0, sin IVA
    descuento?: number;             // valor en dólares, >= 0 y <= cantidad × precio
    tax_code: string;               // de setup.tax_codes (productos del campo suelen ir con 0 %)
  }[];
  additional_fields?: {field_name: string; field_value: string}[];
  notes?: string;
}

interface PurchaseSettlement {
  name: string; business: string; establishment: string; emission_point: string;
  environment: 'Pruebas' | 'Produccion'; status: string; document_type: 'Liquidacion de Compra';
  posting_date: string; version: string; notes?: string | null;
  supplier: Supplier;               // copia al numerar (ver frontend_withholdings.md)
  supplier_address?: string | null;
  forma_pago: string; forma_pago_label: string;
  items: {descripcion: string; codigo?: string | null; unidad_medida?: string | null; cantidad: number;
    precio_unitario: number; descuento: number; tax_code: string; tax_label: string; tarifa: number;
    subtotal: number; iva: number; total: number}[];
  taxes: {tax_code: string; label: string; tarifa: number; base_imponible: number; valor: number}[];  // por tarifa
  total_sin_impuestos: number; total_descuento: number; total_iva: number; importe_total: number;
  additional_fields: {field_name: string; field_value: string}[];
  electronic: { /* igual que guías y retenciones */ };
  email: {status: string | null; sent_at: string | null; error: string | null};
  withholding?: {name: string; document_number: string | null; status: string} | null;  // retención creada sobre esta liquidación
}
```

Reglas del backend (el front puede adelantarlas; el backend recalcula todo):

- Al menos una línea; descripción obligatoria; cantidad > 0; precio >= 0; descuento entre 0 y cantidad × precio.
- Subtotal de línea = cantidad × precio − descuento; IVA = subtotal × tarifa; redondeo a 2 decimales.
- Total mayor que cero. Proveedor del negocio con identificación 05, 06 u 08.
- Pago en efectivo (01) por más de USD 1.000: el front avisa (no bloquea) que, para deducir el gasto y el crédito
  tributario, los pagos de más de USD 1.000 deben hacerse por el sistema financiero.
- Una liquidación autorizada no se edita.

## Anulación (desde 2026-11-11)

Si el negocio la anuló en el portal del SRI, la registra en FacturADA; no se envía nada al SRI.

- `get_lite_purchase_settlement_detail` agrega `sri_annulment: {available, allowed, block_reason}` y los campos
  `sri_annulment_date`, `sri_annulment_reference`, `annulment_reason`, `annulled_by`, `annulled_by_name`, `annulled_at`.
- `POST register_lite_purchase_settlement_sri_annulment(settlement_name, sri_annulment_date, reason, sri_reference?,
  confirmed_in_sri, business?)` → `{data: <detalle>}`. Mismas reglas que la retención y además: **bloqueada si tiene
  una retención vigente** (cualquier estado salvo Borrador, Rechazada o Anulada): primero se anula la retención. El
  campo `withholding` del detalle ignora las retenciones anuladas, así vuelve «Crear retención». Una retención en
  borrador sobre una liquidación anulada no se puede emitir.
- Listas: `status=Anulada` y `status_counts.Anulada`.
- Contabilidad (facturada_erpnext): el barrido cancela la compra por pagar; si tiene pagos o asientos del contador,
  queda en Error con el aviso y se reintenta cada 30 minutos hasta que el contador los cancele.
