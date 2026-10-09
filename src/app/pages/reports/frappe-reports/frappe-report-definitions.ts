export interface ReportFilterDefinition {
  key: string;
  label: string;
  type: 'date' | 'number' | 'text' | 'select' | 'payment';
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string | number }[];
}

export interface ReportDefinition {
  name: string;
  title: string;
  description: string;
  scopeNote?: string;
  badge: string;
  accent: string;
  defaultLimit: number;
  visibleColumns: string[];
  filters: ReportFilterDefinition[];
  category: 'billing' | 'products' | 'restaurant';
  route: string;
}

const dates = (): ReportFilterDefinition[] => [
  { key: 'from_date', label: 'Desde', type: 'date', required: true },
  { key: 'to_date', label: 'Hasta', type: 'date', required: true }
];
const select = (key: string, label: string, values: string[]): ReportFilterDefinition => ({
  key, label, type: 'select', options: values.map(value => ({ label: value, value }))
});
const limit = (): ReportFilterDefinition => ({ key: 'limit', label: 'Límite', type: 'number' });
const environment = (): ReportFilterDefinition => select('environment', 'Ambiente', ['Pruebas', 'Produccion']);
const status = (): ReportFilterDefinition => select('status', 'Estado', [
  'Borrador', 'Pendiente Emision', 'Emitida', 'Autorizada', 'Rechazada',
  'Error de Envio', 'En Revision', 'Reemplazada', 'Anulada'
]);
const salesScope = 'Incluye facturas vigentes. No incluye notas POS sin factura ni descuenta notas de crédito. Las fechas seleccionan facturas; el cobrado incluye sus abonos acumulados hasta hoy.';

export function reportDefinitions(restaurant: boolean): ReportDefinition[] {
  const lite: ReportDefinition[] = [
    {
      name: 'FacturADA Lite Ventas', title: 'Ventas facturadas', category: 'billing', route: '/report/ventas',
      description: 'Total vendido, pago declarado, cobrado y saldo por factura.', scopeNote: salesScope,
      badge: 'Ventas', accent: 'from-sky-500 to-blue-500', defaultLimit: 100,
      visibleColumns: ['name', 'posting_date', 'customer_name', 'status', 'grand_total', 'paid_amount', 'total_collected', 'outstanding_amount'],
      filters: [...dates(), status(), environment(), limit()]
    },
    {
      name: 'Ventas por Fecha Lite', title: 'Ventas por fecha', category: 'billing', route: '/report/ventas-por-fecha',
      description: 'Facturas, ventas y cobrado acumulado agrupados por fecha de emisión.', scopeNote: salesScope,
      badge: 'Ventas', accent: 'from-sky-500 to-blue-500', defaultLimit: 100,
      visibleColumns: ['posting_date', 'facturas', 'autorizadas', 'pendientes', 'rechazadas', 'subtotal', 'iva', 'total', 'cobrado'],
      filters: [...dates(), status(), environment()]
    },
    {
      name: 'Productos Más Vendidos', title: 'Productos más vendidos', category: 'products', route: '/report/productos-mas-vendidos',
      description: 'Productos vendidos en facturas vigentes, con cantidad, facturas, subtotal, IVA y total.',
      scopeNote: 'No incluye notas POS sin factura ni ventas netas de notas de crédito.',
      badge: 'Productos', accent: 'from-emerald-500 to-teal-500', defaultLimit: 50,
      visibleColumns: ['item', 'item_code', 'item_name', 'cantidad', 'facturas', 'subtotal', 'iva', 'total', 'ultima_venta'],
      filters: [...dates(), environment(), { key: 'item', label: 'Producto (identificador)', type: 'text' },
        select('item_type', 'Tipo', ['Producto', 'Servicio']), limit()]
    },
    {
      name: 'Comprobantes Electronicos', title: 'Comprobantes electrónicos', category: 'billing', route: '/report/comprobantes-electronicos',
      description: 'Historial de facturas y notas de crédito, con recepción, autorización y reemplazos.',
      scopeNote: 'Incluye documentos reemplazados y anulados. Su total no representa las ventas vigentes.',
      badge: 'SRI', accent: 'from-amber-500 to-orange-500', defaultLimit: 100,
      visibleColumns: ['tipo', 'documento', 'fecha_emision', 'grand_total', 'status', 'reception_status', 'authorization_status',
        'last_status_check_at', 'manual_review_required', 'regenerated_invoice', 'numero'],
      filters: [...dates(), select('tipo', 'Tipo', ['Factura', 'Nota de Credito']), status(), environment(),
        select('provider_status', 'Estado proveedor', ['AUTHORIZED', 'PROCESSING', 'NOT_AUTHORIZED', 'REJECTED', 'UNKNOWN', 'ERROR']), limit()]
    },
    {
      name: 'Ventas por Forma de Pago', title: 'Facturas por forma de pago', category: 'billing', route: '/report/ventas-forma-pago',
      description: 'Pago declarado y cobrado real por método y código SRI.', scopeNote: salesScope,
      badge: 'Pagos', accent: 'from-sky-500 to-blue-500', defaultLimit: 100,
      visibleColumns: ['payment_method', 'payment_code', 'facturas', 'total_declarado', 'total_cobrado', 'promedio', 'primera_fecha', 'ultima_fecha'],
      filters: [...dates(), { key: 'payment_method', label: 'Forma de pago', type: 'payment' }, environment(), limit()]
    }
  ];
  if (!restaurant) return lite;
  return [
    {
      name: 'FacturADA Restaurant Orders', title: 'Órdenes de restaurante', category: 'restaurant', route: '/report/orders',
      description: 'Órdenes por estado y tipo de consumo, con sus importes.',
      badge: 'Restaurante', accent: 'from-indigo-500 to-violet-500', defaultLimit: 50,
      visibleColumns: ['name', 'creation', 'customer_name', 'order_type', 'status', 'subtotal', 'taxes', 'total'],
      filters: [...dates(), select('status', 'Estado', ['Ingresada', 'Preparacion', 'Lista', 'Cerrada', 'Cancelada']),
        select('order_type', 'Tipo', ['Servirse', 'Llevar', 'Domicilio']), limit()]
    },
    {
      name: 'FacturADA Restaurant Sales by Payment', title: 'Cobros de restaurante', category: 'restaurant', route: '/report/cobros-restaurante',
      description: 'Pagos registrados en órdenes cerradas por método y código SRI.',
      scopeNote: 'Las fechas seleccionan órdenes por su creación. Incluye órdenes con o sin factura; no sumar este reporte al de facturas.',
      badge: 'Restaurante', accent: 'from-emerald-500 to-teal-500', defaultLimit: 100,
      visibleColumns: ['payment_method', 'payment_code', 'orders', 'total_collected', 'average', 'first_sale', 'last_sale'],
      filters: [...dates(), { key: 'payment_method', label: 'Forma de pago', type: 'payment' }, limit()]
    },
    ...lite
  ];
}
