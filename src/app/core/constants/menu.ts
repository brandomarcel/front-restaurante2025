// core/constants/menu.ts
import { MenuItem, Role } from '../models/menu.model';

export class Menu {
  public static pages: MenuItem[] = [
    {
      group: 'Principal',
      separator: false,
      allowedRoles: ['GERENTE','CAJERO'],
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
        },
      ],
    },

    
    {
      group: 'Facturación',
      separator: true,
      allowedRoles: ['GERENTE', 'CAJERO'],
      items: [
        {
          icon: 'assets/icons/tablericons/cash-register.svg',
          label: 'Facturar',
          route: '/dashboard/invoicing',
        },
        {
          icon: 'assets/icons/tablericons/file-invoice.svg',
          label: 'Lista de Facturas',
          route: '/dashboard/invoices',
        },
        {
          icon: 'assets/icons/tablericons/file-invoice.svg',
          label: 'Lista de Notas de Crédito',
          route: '/dashboard/credit-notes',
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
          children: [
            { label: 'Apertura', route: '/caja/apertura' },
            { label: 'Cierre', route: '/caja/cierre' },
            { label: 'Retiros', route: '/caja/retiro' },
          ],
        },
      ],
    },

    {
      group: 'Reportes',
      separator: false,
      allowedRoles: ['GERENTE'],
      items: [
        {
          icon: 'assets/icons/tablericons/report-analytics.svg',
          label: 'Reportes',
          route: '/report',
          children: [
            { label: 'Productos Mas Vendidos', route: '/report/ventasproducto' },
            { label: 'Cierres de Caja', route: '/report/report-cierre-caja'},
          ],
        },
      ],
    },

    {
      group: 'Configuracion',
      separator: false,
      allowedRoles: ['GERENTE'],
      items: [
        {
          icon: 'assets/icons/tablericons/users.svg',
          label: 'Clientes',
          route: '/dashboard/customers',
        },
        {
          icon: 'assets/icons/tablericons/package.svg',
          label: 'Productos',
          route: '/dashboard/products',
        },
        {
          icon: 'assets/icons/tablericons/shopping-bag.svg',
          label: 'Ordenes',
          route: '/dashboard/orders',
        },
        {
          icon: 'assets/icons/tablericons/category.svg',
          label: 'Categorias',
          route: '/dashboard/categories',
        },
        {
          icon: 'assets/icons/tablericons/users.svg',
          label: 'Usuarios',
          route: '/dashboard/users',
        },
      ],
    },
  ];
}
