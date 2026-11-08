// core/constants/menu.ts
import { MenuItem, Role } from '../models/menu.model';
import { CASH_OPERATOR_PERMISSIONS } from '../utils/cash-register';

/*
 * Grupos por tarea (vender, cobrar, consultar documentos, mantener el catálogo,
 * administrar), no por módulo técnico. Las opciones de restaurante y de
 * facturador conviven en los mismos grupos: cada una se muestra según sus
 * propias condiciones de plan, permiso y rol.
 *
 * Las condiciones van en cada opción y no en el grupo, para que mover una
 * opción de grupo no cambie quién la ve. Un grupo sin título (`group: ''`) no
 * muestra encabezado.
 */
export class Menu {
  public static pages: MenuItem[] = [
    {
      group: '',
      items: [
        {
          icon: 'assets/icons/tablericons/chart-donut-3.svg',
          label: 'Dashboard',
          route: '/dashboard/main',
          allowedRoles: ['ADMINISTRADOR', 'GERENTE', 'CAJERO', 'FACTURACION', 'USUARIO', 'MESERO'],
        },
      ],
    },

    {
      group: 'Vender',
      items: [
        {
          icon: 'assets/icons/tablericons/building-store.svg',
          label: 'POS',
          route: '/dashboard/pos',
          featureKey: 'restaurant_pos',
          uiVisibilityKey: 'pos',
          requiredFeatures: ['restaurant_pos', 'pos'],
          allowedRoles: ['ADMINISTRADOR', 'GERENTE', 'CAJERO'],
          permissionKey: 'billing.create',
          hideInLite: true,
        },
        {
          icon: 'assets/icons/tablericons/building-store.svg',
          label: 'POS',
          route: '/dashboard/pos',
          featureKey: 'restaurant',
          uiVisibilityKey: 'pos',
          requiredFeatures: ['restaurant', 'orders', 'pos'],
          permissionKey: 'restaurant.orders.create',
          // Variante del mesero: quien cobra ya ve el «POS» de arriba.
          hideWhenPermission: 'billing.create',
        },
        {
          icon: 'assets/icons/heroicons/outline/building-storefront.svg',
          label: 'Mesas',
          route: '/dashboard/tables',
          featureKey: 'tables',
          uiVisibilityKey: 'restaurantTables',
          requiredFeatures: ['restaurant'],
          permissionKey: 'restaurant.orders.read',
          hideForRoles: ['COCINA'],
        },
        {
          icon: 'assets/icons/tablericons/shopping-bag.svg',
          label: 'Órdenes',
          route: '/dashboard/orders',
          featureKey: 'orders',
          uiVisibilityKey: 'restaurantOrders',
          requiredFeatures: ['restaurant'],
          // El mesero crea pero no actualiza órdenes: sin esto no veía sus pedidos sin mesa.
          anyPermissionKeys: ['restaurant.orders.update', 'restaurant.orders.create'],
          hideInLite: true,
          // Cocina trabaja desde su pantalla; la lista muestra totales en dinero.
          hideForRoles: ['COCINA'],
        },
        {
          icon: 'assets/icons/tablericons/chart-donut-3.svg',
          label: 'Pantalla de cocina',
          route: '/dashboard/orders-realtime',
          featureKey: 'kitchen',
          uiVisibilityKey: 'restaurantKitchen',
          permissionKeys: ['restaurant.orders.read', 'restaurant.orders.update'],
          hideInLite: true,
        },
        {
          icon: 'assets/icons/tablericons/cash-register.svg',
          label: 'Facturar',
          route: '/dashboard/invoicing',
          featureKey: 'direct_invoice',
          requiredFeatures: ['billing'],
          permissionKey: 'billing.create',
        },
        {
          icon: 'assets/icons/tablericons/cash-register.svg',
          label: 'Punto de venta',
          route: '/dashboard/pos-generic',
          featureKey: 'generic_pos',
          uiVisibilityKey: 'pos',
          requiredFeatures: ['billing', 'generic_pos', 'pos'],
          permissionKey: 'billing.create',
        },
      ],
    },

    {
      group: 'Caja y cobros',
      items: [
        {
          // La caja depende únicamente de `cash_register` (habilitada por el
          // backend cuando `billing` + `pos` están activos, sea Restaurante POS
          // o POS genérico); no se condiciona a `restaurant`.
          icon: 'assets/icons/tablericons/cash-banknote.svg',
          label: 'Mi caja',
          route: '/caja',
          featureKey: 'cash_register',
          anyPermissionKeys: [...CASH_OPERATOR_PERMISSIONS],
          children: [
            { label: 'Apertura', route: '/caja/apertura', anyPermissionKeys: [...CASH_OPERATOR_PERMISSIONS] },
            { label: 'Retiros', route: '/caja/retiro', anyPermissionKeys: [...CASH_OPERATOR_PERMISSIONS] },
            { label: 'Cierre', route: '/caja/cierre', anyPermissionKeys: [...CASH_OPERATOR_PERMISSIONS] },
            { label: 'Gestión de cajas', route: '/caja/gestion', anyPermissionKeys: ['restaurant.manage', 'billing.manage'] },
          ],
        },
        {
          icon: 'assets/icons/tablericons/cash-banknote.svg',
          label: 'Cartera y abonos',
          route: '/dashboard/receivables',
          featureKey: 'billing',
          featureKeys: ['billing', 'api'],
          requiredFeatures: ['billing'],
          permissionKey: 'billing.read',
        },
      ],
    },

    {
      group: 'Documentos',
      items: [
        {
          icon: 'assets/icons/tablericons/file-invoice.svg',
          label: 'Facturas',
          route: '/dashboard/invoices',
          featureKey: 'direct_invoice',
          featureKeys: ['direct_invoice', 'generic_pos', 'api'],
          requiredFeatures: ['billing'],
          permissionKey: 'billing.read',
        },
        {
          icon: 'assets/icons/tablericons/file-invoice.svg',
          label: 'Notas de venta',
          route: '/dashboard/pos-sale-notes',
          featureKey: 'generic_pos',
          requiredFeatures: ['billing'],
          permissionKey: 'billing.read',
        },
        {
          icon: 'assets/icons/tablericons/file-invoice.svg',
          label: 'Notas de crédito',
          route: '/dashboard/credit-notes',
          featureKey: 'credit_note',
          featureKeys: ['credit_note', 'api'],
          requiredFeatures: ['billing'],
          permissionKey: 'billing.read',
        },
        {
          icon: 'assets/icons/tablericons/file-invoice.svg',
          label: 'Guías de remisión',
          route: '/dashboard/remission-guides',
          featureKey: 'billing',
          permissionKey: 'billing.read',
        },
        // Negocios solo API (sin `billing`): consultan lo emitido por integración.
        {
          icon: 'assets/icons/tablericons/file-invoice.svg',
          label: 'Facturas',
          route: '/dashboard/invoices',
          featureKey: 'api',
          hideWhenFeature: 'billing',
          permissionKey: 'billing.read',
        },
        {
          icon: 'assets/icons/tablericons/file-invoice.svg',
          label: 'Notas de crédito',
          route: '/dashboard/credit-notes',
          featureKey: 'api',
          hideWhenFeature: 'billing',
          permissionKey: 'billing.read',
        },
      ],
    },

    {
      // Insumos y Recetas se abren desde las pestañas de Inventario (mismas condiciones).
      group: 'Catálogo',
      items: [
        {
          icon: 'assets/icons/tablericons/package.svg',
          label: 'Productos',
          route: '/dashboard/products',
          featureKey: 'products',
          permissionKey: 'products.read',
          allowedRoles: ['ADMINISTRADOR', 'GERENTE', 'CAJERO', 'FACTURACION', 'USUARIO'],
        },
        {
          icon: 'assets/icons/tablericons/category.svg',
          label: 'Categorías',
          route: '/dashboard/categories',
          featureKey: 'products',
          permissionKey: 'products.manage',
        },
        {
          icon: 'assets/icons/tablericons/qrcode.svg',
          label: 'Carta digital',
          route: '/dashboard/digital-menu',
          featureKey: 'restaurant',
          permissionKey: 'restaurant.manage',
          hideInApiOnly: true,
        },
        {
          icon: 'assets/icons/tablericons/repeat.svg',
          label: 'Inventario',
          route: '/dashboard/inventory',
          featureKey: 'inventory',
          permissionKey: 'inventory.read',
        },
        {
          icon: 'assets/icons/tablericons/building-store.svg',
          label: 'Bodegas',
          route: '/settings/lite/warehouses',
          featureKey: 'inventory',
          permissionKey: 'business.settings.manage',
          hideInApiOnly: true,
          hideUnlessWarehouseUi: true,
        },
        {
          icon: 'assets/icons/tablericons/users.svg',
          label: 'Clientes',
          route: '/dashboard/customers',
          featureKey: 'customers',
          permissionKey: 'customers.read',
          allowedRoles: ['ADMINISTRADOR', 'GERENTE', 'CAJERO', 'FACTURACION', 'USUARIO'],
        },
      ],
    },

    {
      group: 'Administración',
      items: [
        {
          icon: 'assets/icons/tablericons/report-analytics.svg',
          label: 'Reportes',
          route: '/report',
          // `reportsVisible` ya incluye el respaldo a `reports.view` cuando
          // el backend no envía `ui_capabilities.modules.reports` todavía.
          uiVisibilityKey: 'reports',
          hideInApiOnly: true,
        },
        {
          icon: 'assets/icons/tablericons/users.svg',
          label: 'Usuarios',
          route: '/dashboard/users',
          // `usersModuleVisible` ya incluye el respaldo a `business.users.manage`.
          uiVisibilityKey: 'users',
          permissionKey: 'business.settings.manage',
        },
        {
          // Datos del negocio y la infraestructura fiscal en un solo lugar.
          icon: 'assets/icons/heroicons/outline/cog-6-tooth.svg',
          label: 'Configuración',
          route: '/settings/lite',
          permissionKey: 'business.settings.manage',
          children: [
            { label: 'General', route: '/settings/lite', permissionKey: 'business.settings.manage', exactMatch: true },
            {
              label: 'Establecimientos',
              route: '/settings/lite/establishments',
              featureKeys: ['direct_invoice', 'billing', 'generic_pos', 'api'],
              permissionKey: 'business.settings.manage',
            },
            {
              label: 'Puntos de emisión',
              route: '/settings/lite/emission-points',
              featureKeys: ['direct_invoice', 'billing', 'generic_pos', 'api'],
              permissionKey: 'business.settings.manage',
            },
            {
              label: 'Secuencias',
              route: '/settings/lite/sequences',
              featureKeys: ['direct_invoice', 'billing', 'generic_pos', 'api'],
              permissionKey: 'business.settings.manage',
            },
            {
              label: 'Terminales POS',
              route: '/settings/lite/pos-terminals',
              featureKey: 'pos_terminal',
              permissionKey: 'business.settings.manage',
              hideInApiOnly: true,
            },
            {
              label: 'Integración API',
              route: '/settings/lite/api',
              featureKey: 'api',
              permissionKey: 'business.settings.manage',
            },
          ],
        },
      ],
    },
  ];
}
