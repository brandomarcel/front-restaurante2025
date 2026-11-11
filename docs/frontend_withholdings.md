# Contrato front ↔ backend: comprobantes de retención y proveedores (Lite)

Estado: 2026-11-11. Primera versión: 2026-11-10. Copia en el front: `docs/frontend_withholdings.md` (mantener ambas iguales).

El negocio emite al SRI el **comprobante de retención electrónico** (codDoc 07, versión 2.0.0) a sus proveedores.
Una retención = un documento de sustento (la factura del proveedor). Se emite igual que una guía de remisión:
borrador → emitir → estados SRI compartidos (`frontend_electronic_states.md`). Consume cupo del plan como
cualquier comprobante autorizado en Producción.

## Quién y cuándo

- Requiere la función `billing` y que el perfil tributario tenga **«Agente de retención»** (`withholding_agent`).
  `ui_capabilities.modules.withholdings` = `{visible, can_create, can_manage, withholding_agent}`:
  `visible` = `billing` + `billing.read` + agente de retención. El menú usa `visible`.
- Permisos: listar/detalle/PDF/XML `billing.read`; crear/emitir `billing.create`; consultar/reintentar/revisión
  `billing.manage`. Proveedores: listar `billing.read`, crear/editar `billing.create`.
- La fecha de emisión es siempre la del día en que se emite (la clave de acceso lleva la fecha).
- Plazo del SRI: la retención se emite dentro de 5 días desde la emisión de la factura del proveedor. El backend no
  bloquea; devuelve `late: true` y el front avisa.

Todos los métodos están en `facturada_lite.api.frontend` y reciben `business` (opcional; si falta usa el negocio
activo). POST con cuerpo JSON en `payload` cuando se indica.

## Proveedores

```
GET  get_lite_suppliers(business, search?, limit=20, offset=0, include_inactive=0)
     -> {data: Supplier[], total, limit, offset, has_next}
     search: nombre o identificación (en el servidor).
POST save_lite_supplier(business, payload: Supplier sin name -> crea; con name -> actualiza)
     -> {data: Supplier}
```

```ts
interface Supplier {
  name: string;                  // ID interno (FLSUP-00001)
  supplier_name: string;         // razón social o nombres
  identification_type: '04' | '05' | '06' | '08';  // RUC, cédula, pasaporte, identificación del exterior
  identification: string;        // RUC 13 dígitos terminado en 001, cédula 10 dígitos
  email?: string | null;         // a este correo se envía la retención autorizada
  phone?: string | null;
  address?: string | null;
  related_party: boolean;        // parte relacionada (va en el XML y en el ATS)
  is_active: boolean;
}
```

Errores de validación: identificación repetida en el negocio, RUC/cédula con formato inválido.

## Configuración para el formulario

```
GET get_withholding_setup(business)
-> {data: {
  withholding_agent: boolean,
  block_message: string | null,     // por qué no se puede emitir (no es agente, sin firma, sin secuencia…)
  support_codes:   {code: string, label: string}[],   // sustento tributario (01 crédito tributario…)
  document_types:  {code: string, label: string}[],   // tipo del documento sustento (01 Factura, 03 Liquidación, 02 Nota de venta…)
  tax_codes:       {code: string, label: string, rate: number}[],  // tarifas del documento sustento: 4=IVA 15 %, 0=0 %, 6=No objeto, 7=Exento, 5=5 %…
  vat_withholding_rates: number[],  // [10, 20, 30, 50, 70, 100]
  payment_methods: {code: string, label: string}[],   // formas de pago SRI (20 transferencia, 01 efectivo…)
  income_concepts: {code: string, form_103: string, label: string, percentage: number, variable: boolean}[],
                                    // conceptos de renta (código ATS = codigo_retencion) con su % vigente; editable en el Desk
}}
```

## Leer la clave de acceso de la factura del proveedor

```
POST lookup_lite_access_key(business, access_key)
-> {data: {
  valid: boolean, message?: string,
  test_environment: boolean,          // clave del ambiente de pruebas del SRI: avisar
  document_type: string,              // código: '01', '03', '04'…
  number: string,                     // '001-001-000000123'
  issue_date: string,                 // 'YYYY-MM-DD'
  ruc: string,                        // RUC del emisor (el proveedor)
  supplier: Supplier | null,          // proveedor del negocio con ese RUC, si existe
}}
```

## Retenciones

```
GET  get_all_withholdings(business, limit=20, offset=0, status?, environment?, search?, from_date?, to_date?)
     -> {data: Withholding[], total, limit, offset, has_next,
         status_counts: {ALL, Autorizada, EN_PROCESO, CON_ERROR, Anulada}}
     status: un estado exacto o grupo (EN_PROCESO, CON_ERROR), grupos compartidos; `Anulada` corresponde a la anulación registrada desde el SRI.
     search: número, clave de acceso, proveedor (nombre o identificación), número del documento sustento.
GET  get_lite_withholding_detail(name, business) -> {data: Withholding}
POST create_lite_withholding(business, payload: WithholdingInput)          -> {data: Withholding}   // borrador; con payload.name actualiza el borrador
POST create_and_emit_lite_withholding(business, payload: WithholdingInput) -> {data, emission}
POST emit_lite_withholding(withholding_name, business)                     -> {data, emission}
POST refresh_lite_withholding_status(withholding_name, business)           -> {data, emission}
POST retry_lite_withholding(withholding_name, business)                    -> {data, emission}
POST confirm_lite_withholding_electronic_review(withholding_name, business)-> {data}
GET  download_lite_withholding_pdf(name, business)   // RIDE
GET  download_lite_withholding_xml(name, business)   // XML autorizado
```

`emission` tiene la misma forma que en facturas y guías (`normalizeLiteEmissionResponse`).

```ts
interface WithholdingInput {
  name?: string;                    // solo para actualizar un borrador
  establishment?: string;           // FacturADA Establishment (si falta, el principal)
  emission_point?: string;          // FacturADA Emission Point (si falta, el predeterminado)
  environment?: 'Pruebas' | 'Produccion';  // si falta, el del perfil tributario
  supplier: string;                 // Supplier.name
  support: {
    cod_sustento: string;           // '01'
    cod_doc_sustento: string;       // '01'
    num_doc_sustento: string;       // '001-001-000000123'
    fecha_emision_doc_sustento: string;   // 'YYYY-MM-DD'
    num_aut_doc_sustento?: string;  // clave de 49 dígitos (o 10/37 en físicos)
    forma_pago: string;             // '20'
    taxes: {tax_code: string; base_imponible: number}[];  // bases por tarifa; el backend calcula el IVA
  };
  retentions: {
    tax_type: 'Renta' | 'IVA';
    codigo_retencion?: string;      // Renta: código de concepto SRI (312, 3440, 332…). IVA: lo pone el backend
    base_imponible: number;         // Renta: base de la compra; IVA: el IVA de la factura
    porcentaje: number;             // Renta: 1.75, 2.75…; IVA: uno de vat_withholding_rates
  }[];
  additional_fields?: {field_name: string; field_value: string}[];
  notes?: string;
}

interface Withholding {
  name: string; business: string; establishment: string; emission_point: string;
  environment: 'Pruebas' | 'Produccion';
  status: string;                   // estados de frontend_electronic_states.md
  document_type: 'Comprobante de Retencion';
  posting_date: string;             // fecha de emisión
  periodo_fiscal: string;           // 'MM/AAAA'
  version: string;                  // '2.0.0'
  notes?: string | null;
  supplier: Supplier;               // copia al momento de emitir
  support: {
    cod_sustento: string; cod_sustento_label: string;
    cod_doc_sustento: string; cod_doc_sustento_label: string;
    num_doc_sustento: string; fecha_emision_doc_sustento: string; num_aut_doc_sustento?: string | null;
    forma_pago: string; forma_pago_label: string;
    total_sin_impuestos: number; total_iva: number; importe_total: number;
    taxes: {tax_code: string; label: string; tarifa: number; base_imponible: number; valor_impuesto: number}[];
  };
  retentions: {tax_type: 'Renta' | 'IVA'; codigo: string; codigo_retencion: string;
    base_imponible: number; porcentaje: number; valor_retenido: number}[];
  total_renta: number; total_iva_retenido: number; total_retenido: number;
  days_since_support: number;       // días entre la factura del proveedor y la emisión
  late: boolean;                    // más de 5 días
  additional_fields: {field_name: string; field_value: string}[];
  electronic: { /* igual que guías: access_key, document_number, authorization_number,
                   authorization_datetime, provider_status, code, reception_status, authorization_status,
                   manual_review_required, sri_message, emission_error, messages, polling… */ };
  email: {status: string | null; sent_at: string | null; error: string | null};
}
```

Reglas que valida el backend (el front puede adelantarlas, el backend decide):

- Al menos una retención; cada valor = base × porcentaje / 100, redondeado a 2 decimales.
- Retención de IVA: porcentaje en `vat_withholding_rates`; la suma de bases de IVA no supera el IVA del sustento.
- Retención de renta: código de 3 a 5 caracteres (A-Z, 0-9); la suma de bases no supera el total sin impuestos.
  Si el código está en `income_concepts` y no es `variable`, el backend exige su porcentaje.
  El SRI valida además que el porcentaje sea el vigente para ese código (p. ej. 312 = 2 %): si no, rechaza la
  retención y el mensaje del SRI queda en `electronic.sri_message`.
- `num_doc_sustento` con forma `001-001-000000123`; `num_aut_doc_sustento` de 10, 37 o 49 dígitos (sin espacios).
- Si la clave de 49 dígitos no corresponde al proveedor (otro RUC), al número o a la fecha: error.
- Fecha del sustento no posterior a hoy.
- Un proveedor con pasaporte o del exterior se emite como pago local (`pagoLocExt` 01): pagos al exterior no
  están soportados.

## Anulación (desde 2026-11-11)

Una retención autorizada no se edita. Si el negocio la anuló en el portal del SRI (con aceptación del proveedor),
la registra en FacturADA; no se envía nada al SRI.

- `get_lite_withholding_detail` agrega `sri_annulment: {available, allowed, block_reason}` (`allowed` = `billing.void`)
  y, en todo serializado, `sri_annulment_date`, `sri_annulment_reference`, `annulment_reason`, `annulled_by`,
  `annulled_by_name`, `annulled_at`.
- `POST register_lite_withholding_sri_annulment(withholding_name, sri_annulment_date, reason, sri_reference?,
  confirmed_in_sri, business?)` → `{data: <detalle>}`. Exige `confirmed_in_sri=1`, motivo ≥ 5 caracteres, fecha entre
  la emisión y hoy, comprobante `Autorizada`. Estado nuevo `Anulada`; consulta y reintento siguen bloqueados.
- Listas: `status=Anulada` y `status_counts.Anulada`.
- Contabilidad (facturada_erpnext): el barrido cancela la retención contable enlazada (o cierra la espera de compra).
