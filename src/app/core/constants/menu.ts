// core/constants/menu.ts
import { MenuItem, Role } from '../models/menu.model';

export class Menu {
  public static pages: MenuItem[] = [
    {
      group: 'Principal',
      separator: false,
      allowedRoles: ['GERENTE', 'CAJERO'],
      items: [
        {
          icon: 'assets/icons/tablericons/chart-donut-3.svg',
          label: 'Dashboard',
          route: '/dashboard/main',
        },
        {
          icon: 'assets/icons/tablericons/building-store.svg',
          label: 'POS',
          route: '/dashboard/pos',
          featureKey: 'restaurant_pos',
          hideInLite: true,
        },
        {
          icon: 'assets/icons/tablericons/chart-donut-3.svg',
          label: 'Ordenes en vivo',
          route: '/dashboard/orders-realtime',
          featureKey: 'kitchen',
          hideInLite: true,
        },
      ],
    },


    {
      group: 'Facturación',
      separator: true,
      allowedRoles: ['ADMINISTRADOR', 'GERENTE', 'CAJERO', 'FACTURACION', 'USUARIO'],
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
      group: 'Caja',
      separator: false,
      allowedRoles: ['GERENTE', 'CAJERO'],
      items: [
        {
          icon: 'assets/icons/tablericons/cash-banknote.svg',
          label: 'Caja',
          route: '/caja',
          featureKey: 'cash_register',
          hideInLite: true,
          children: [
            { label: 'Apertura', route: '/caja/apertura' },
            { label: 'Retiros', route: '/caja/retiro' },
            { label: 'Cierre', route: '/caja/cierre' },
            
          ],
        },
        {
          allowedRoles: ['CAJERO'],
          icon: 'assets/icons/tablericons/shopping-bag.svg',
          label: 'Lista Órdenes',
          route: '/dashboard/orders',
          featureKey: 'orders',
          hideInLite: true,
        },
        {
          icon: 'assets/icons/heroicons/outline/building-storefront.svg',
          label: 'Mesas',
          route: '/dashboard/tables',
          featureKey: 'tables',
        },
      ],
    },

    {
      group: 'Reportes',
      separator: false,
      allowedRoles: ['SYSTEM MANAGER', 'GERENTE', 'CAJERO'],
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
      group: 'Configuracion',
      separator: false,
      allowedRoles: ['ADMINISTRADOR', 'GERENTE', 'CAJERO', 'FACTURACION', 'MESERO', 'COCINA', 'USUARIO'],
      items: [
        {
          icon: 'assets/icons/tablericons/users.svg',
          label: 'Clientes',
          route: '/dashboard/customers',
          featureKey: 'customers',
          permissionKey: 'customers.read',
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
        },
        {
          icon: 'assets/icons/tablericons/repeat.svg',
          label: 'Inventario',
          route: '/dashboard/inventory',
          featureKey: 'inventory',
          permissionKey: 'inventory.read',
        },
        {
          icon: 'assets/icons/tablericons/shopping-bag.svg',
          label: 'Lista Órdenes',
          route: '/dashboard/orders',
          featureKey: 'orders',
          hideInLite: true,
        },
        {
          icon: 'assets/icons/heroicons/outline/building-storefront.svg',
          label: 'Mesas',
          route: '/dashboard/tables',
          featureKey: 'tables',
        },
        {
          icon: 'assets/icons/tablericons/category.svg',
          label: 'Categorias',
          route: '/dashboard/categories',
          featureKey: 'products',
          permissionKey: 'products.read',
        },
        {
          icon: 'assets/icons/tablericons/users.svg',
          label: 'Usuarios',
          route: '/dashboard/users',
          allowedRoles: ['ADMINISTRADOR', 'GERENTE'],
          hideInApiOnly: true,
        },
      ],
    },

    {
      group: 'Infraestructura fiscal',
      separator: true,
      allowedRoles: ['ADMINISTRADOR', 'GERENTE', 'CAJERO', 'FACTURACION', 'MESERO', 'COCINA', 'USUARIO'],
      items: [
        {
          icon: 'assets/icons/heroicons/outline/building-storefront.svg',
          label: 'Establecimientos',
          route: '/settings/lite/establishments',
          featureKeys: ['direct_invoice', 'billing', 'generic_pos', 'api'],
        },
        {
          icon: 'assets/icons/heroicons/outline/building-storefront.svg',
          label: 'Puntos de emisión',
          route: '/settings/lite/emission-points',
          featureKeys: ['direct_invoice', 'billing', 'generic_pos', 'api'],
        },
        {
          icon: 'assets/icons/heroicons/outline/clipboard-document-list.svg',
          label: 'Secuencias de documentos',
          route: '/settings/lite/sequences',
          featureKeys: ['direct_invoice', 'billing', 'generic_pos', 'api'],
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
          requiresApiConfiguration: true,
        },
      ],
    },

    {
      group: 'Configuracion',
      separator: false,
      allowedRoles: ['MESERO'],
      items: [

        {
          allowedRoles: ['MESERO'],
          icon: 'assets/icons/tablericons/shopping-bag.svg',
          label: 'Lista Órdenes',
          route: '/dashboard/orders',
          featureKey: 'orders',
          hideInLite: true,
        },
        {
          allowedRoles: ['MESERO'],
          icon: 'assets/icons/heroicons/outline/building-storefront.svg',
          label: 'Mesas',
          route: '/dashboard/tables',
          featureKey: 'tables',
        },

        {
          icon: 'assets/icons/tablericons/building-store.svg',
          label: 'POS',
          route: '/dashboard/pos',
          featureKey: 'restaurant_pos',
          hideInLite: true,
        },

      ],
    },

    {
      group: 'Produccion',
      separator: false,
      allowedRoles: ['COCINA'],
      items: [
        {
          icon: 'assets/icons/tablericons/chart-donut-3.svg',
          label: 'Ordenes en vivo',
          route: '/dashboard/orders-realtime',
          featureKey: 'kitchen',
          hideInLite: true,
        },
      ],
    },
  ];
}
