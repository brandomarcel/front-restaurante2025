// core/constants/menu.ts
import { MenuItem, Role } from '../models/menu.model';

export class Menu {
  public static pages: MenuItem[] = [
    {
      group: 'Principal',
      separator: false,
      allowedRoles: ['ADMINISTRADOR', 'GERENTE', 'CAJERO', 'FACTURACION', 'USUARIO', 'MESERO'],
      items: [
        {
          icon: 'assets/icons/tablericons/chart-donut-3.svg',
          label: 'Dashboard',
          route: '/dashboard/main',
          allowedRoles: ['ADMINISTRADOR', 'GERENTE', 'CAJERO', 'FACTURACION', 'USUARIO'],
        },
        {
          icon: 'assets/icons/tablericons/building-store.svg',
          label: 'POS',
          route: '/dashboard/pos',
          featureKey: 'restaurant_pos',
          allowedRoles: ['ADMINISTRADOR', 'GERENTE', 'CAJERO'],
          permissionKey: 'billing.create',
          hideInLite: true,
        },
        {
          icon: 'assets/icons/tablericons/chart-donut-3.svg',
          label: 'Ordenes en vivo',
          route: '/dashboard/orders-realtime',
          featureKey: 'kitchen',
          permissionKeys: ['restaurant.orders.read', 'restaurant.orders.update'],
          hideInLite: true,
        },
      ],
    },


    {
      group: 'Facturación',
      separator: true,
      featureKey: 'billing',
      items: [
        {
          icon: 'assets/icons/tablericons/cash-register.svg',
          label: 'Facturar',
          route: '/dashboard/invoicing',
          featureKey: 'direct_invoice',
          hideWhenFeature: 'generic_pos',
          permissionKey: 'billing.create',
        },
        {
          icon: 'assets/icons/tablericons/cash-register.svg',
          label: 'Punto de venta',
          route: '/dashboard/pos-generic',
          featureKey: 'generic_pos',
          permissionKey: 'billing.create',
        },
        {
          icon: 'assets/icons/tablericons/file-invoice.svg',
          label: 'Lista Facturas',
          route: '/dashboard/invoices',
          featureKey: 'direct_invoice',
          featureKeys: ['direct_invoice', 'generic_pos', 'api'],
          permissionKey: 'billing.read',
        },
        {
          icon: 'assets/icons/tablericons/file-invoice.svg',
          label: 'Notas de Venta',
          route: '/dashboard/pos-sale-notes',
          featureKey: 'generic_pos',
          permissionKey: 'billing.read',
        },
        {
          icon: 'assets/icons/tablericons/file-invoice.svg',
          label: 'Lista Notas Crédito',
          route: '/dashboard/credit-notes',
          featureKey: 'credit_note',
          featureKeys: ['credit_note', 'api'],
          permissionKey: 'billing.read',
        },
      ],
    },

    {
      group: 'Restaurante',
      separator: false,
      featureKey: 'restaurant',
      items: [
        {
          icon: 'assets/icons/tablericons/cash-banknote.svg',
          label: 'Caja',
          route: '/caja',
          featureKey: 'cash_register',
          requiredFeatures: ['restaurant_pos', 'cash_register'],
          permissionKey: 'restaurant.cash.manage',
          children: [
            { label: 'Apertura', route: '/caja/apertura', permissionKey: 'restaurant.cash.manage' },
            { label: 'Retiros', route: '/caja/retiro', permissionKey: 'restaurant.cash.manage' },
            { label: 'Cierre', route: '/caja/cierre', permissionKey: 'restaurant.cash.manage' },
            { label: 'Gestión de caja', route: '/caja/gestion', permissionKey: 'restaurant.manage' },
            
          ],
        },
        {
          icon: 'assets/icons/tablericons/shopping-bag.svg',
          label: 'Lista Órdenes',
          route: '/dashboard/orders',
          featureKey: 'orders',
          permissionKeys: ['restaurant.orders.read', 'restaurant.orders.update'],
          hideInLite: true,
        },
        {
          icon: 'assets/icons/heroicons/outline/building-storefront.svg',
          label: 'Mesas',
          route: '/dashboard/tables',
          featureKey: 'tables',
          permissionKey: 'restaurant.orders.read',
        },
        {
          icon: 'assets/icons/tablericons/building-store.svg',
          label: 'POS Restaurante',
          route: '/dashboard/pos',
          featureKey: 'restaurant',
          requiredFeatures: ['orders'],
          permissionKey: 'restaurant.orders.create',
        },
      ],
    },

    {
      group: 'Reportes',
      separator: false,
      hideInApiOnly: true,
      items: [
        {
          icon: 'assets/icons/tablericons/report-analytics.svg',
          label: 'Reportes',
          route: '/report',
          permissionKey: 'reports.view',
        },
      ],
    },

    {
      group: 'Operación',
      separator: false,
      items: [
        {
          icon: 'assets/icons/tablericons/users.svg',
          label: 'Clientes',
          route: '/dashboard/customers',
          featureKey: 'customers',
          permissionKey: 'customers.read',
          allowedRoles: ['ADMINISTRADOR', 'GERENTE', 'CAJERO', 'FACTURACION', 'USUARIO'],
        },
        // {
        //   icon: 'assets/icons/tablericons/users-plus.svg',
        //   label: 'Proveedores',
        //   route: '/dashboard/suppliers',
        // },
        {
          icon: 'assets/icons/tablericons/package.svg',
          label: 'Productos',
          route: '/dashboard/products',
          featureKey: 'products',
          permissionKey: 'products.read',
          allowedRoles: ['ADMINISTRADOR', 'GERENTE', 'CAJERO', 'FACTURACION', 'USUARIO'],
        },
        {
          icon: 'assets/icons/tablericons/repeat.svg',
          label: 'Inventario',
          route: '/dashboard/inventory',
          featureKey: 'inventory',
          permissionKey: 'inventory.read',
        },
        {
          icon: 'assets/icons/tablericons/category.svg',
          label: 'Categorias',
          route: '/dashboard/categories',
          featureKey: 'products',
          permissionKey: 'products.manage',
        },
      ],
    },

    {
      group: 'Documentos API',
      separator: true,
      featureKey: 'api',
      hideWhenFeature: 'billing',
      items: [
        {
          icon: 'assets/icons/tablericons/file-invoice.svg',
          label: 'Lista Facturas',
          route: '/dashboard/invoices',
          featureKey: 'api',
          permissionKey: 'billing.read',
        },
        {
          icon: 'assets/icons/tablericons/file-invoice.svg',
          label: 'Lista Notas Crédito',
          route: '/dashboard/credit-notes',
          featureKey: 'api',
          permissionKey: 'billing.read',
        },
      ],
    },

    {
      group: 'Configuración',
      separator: false,
      permissionKey: 'business.settings.manage',
      items: [
        {
          icon: 'assets/icons/heroicons/outline/cog-6-tooth.svg',
          label: 'Configuración del negocio',
          route: '/settings/lite',
          permissionKey: 'business.settings.manage',
        },
        {
          icon: 'assets/icons/tablericons/users.svg',
          label: 'Usuarios',
          route: '/dashboard/users',
          permissionKey: 'business.users.manage',
        },
      ],
    },

    {
      group: 'Infraestructura fiscal',
      separator: true,
      items: [
        {
          icon: 'assets/icons/heroicons/outline/building-storefront.svg',
          label: 'Establecimientos',
          route: '/settings/lite/establishments',
          featureKeys: ['direct_invoice', 'billing', 'generic_pos', 'api'],
          permissionKey: 'business.settings.manage',
        },
        {
          icon: 'assets/icons/heroicons/outline/building-storefront.svg',
          label: 'Puntos de emisión',
          route: '/settings/lite/emission-points',
          featureKeys: ['direct_invoice', 'billing', 'generic_pos', 'api'],
          permissionKey: 'business.settings.manage',
        },
        {
          icon: 'assets/icons/heroicons/outline/clipboard-document-list.svg',
          label: 'Secuencias de documentos',
          route: '/settings/lite/sequences',
          featureKeys: ['direct_invoice', 'billing', 'generic_pos', 'api'],
          permissionKey: 'business.settings.manage',
        },
        {
          icon: 'assets/icons/tablericons/cash-register.svg',
          label: 'Terminales POS',
          route: '/settings/lite/pos-terminals',
          featureKey: 'pos_terminal',
          permissionKey: 'business.settings.manage',
          hideInApiOnly: true,
        },
        {
          icon: 'assets/icons/tablericons/file-invoice.svg',
          label: 'Integración API',
          route: '/settings/lite/api',
          featureKey: 'api',
          permissionKey: 'business.settings.manage',
        },
      ],
    },

    {
      group: 'Cocina',
      separator: false,
      featureKey: 'kitchen',
      items: [
        {
          icon: 'assets/icons/tablericons/chart-donut-3.svg',
          label: 'Pantalla de cocina',
          route: '/dashboard/orders-realtime',
          featureKey: 'kitchen',
          permissionKeys: ['restaurant.orders.read', 'restaurant.orders.update'],
          hideInLite: true,
        },
      ],
    },
  ];
}
