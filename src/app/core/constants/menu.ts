// core/constants/menu.ts
import { MenuItem, Role } from '../models/menu.model';

export class Menu {
  public static pages: MenuItem[] = [
    {
      group: 'Principal',
      separator: false,
      allowedRoles: ['GERENTE','CAJERO'], // 👈 solo gerente
      items: [
        {
          icon: 'assets/icons/heroicons/outline/chart-pie.svg',
          label: 'Dashboard',
          route: '/dashboard/main',
        },
        {
          icon: 'assets/icons/heroicons/outline/building-storefront.svg',
          label: 'POS',
          route: '/dashboard/pos',
          
        },
      ],
    },

    {
      group: 'Facturación',
      separator: true,
      allowedRoles: ['GERENTE', 'CAJERO'], // 👈 ambos
      items: [
        {
          icon: 'assets/icons/heroicons/outline/banknotes.svg',
          label: 'Facturar',
          route: '/dashboard/invoicing',
        },
        {
          icon: 'assets/icons/heroicons/outline/clipboard-document-list.svg',
          label: 'Lista de Facturas',
          route: '/dashboard/invoices',
        },
        {
          icon: 'assets/icons/heroicons/outline/clipboard-document-list.svg',
          label: 'Lista de Notas de Crédito',
          route: '/dashboard/credit-notes',
        },
      ],
    },

    {
      group: 'Caja',
      separator: false,
      allowedRoles: ['GERENTE', 'CAJERO'], // 👈 solo gerente
      items: [
        {
          icon: 'assets/icons/heroicons/outline/banknotes.svg',
          label: 'Caja',
          route: '/caja',
          children: [
            { label: 'Apertura', route: '/caja/apertura' },
            { label: 'Cierre', route: '/caja/cierre' },
            { label: 'Retiros', route: '/caja/retiro' }
          ],
        },
      ],
    },

    {
      group: 'Reportes',
      separator: false,
      allowedRoles: ['GERENTE'], // 👈 solo gerente
      items: [
        {
          icon: 'assets/icons/heroicons/outline/download.svg',
          label: 'Reportes',
          route: '/report',
          children: [
            { label: 'Productos Mas Vendidos', route: '/report/ventasproducto' },
            { label: 'Cierres de Caja', route: '/report/report-cierre-caja' },
          ],
        },
      ],
    },

    {
      group: 'Configuracion',
      separator: false,
      allowedRoles: ['GERENTE'], // 👈 solo gerente
      items: [
        {
          icon: 'assets/icons/heroicons/outline/users.svg',
          label: 'Clientes',
          route: '/dashboard/customers',
        },
        {
          icon: 'assets/icons/heroicons/outline/list-bullet.svg',
          label: 'Productos',
          route: '/dashboard/products',
        },
        {
          icon: 'assets/icons/heroicons/outline/clipboard-document-list.svg',
          label: 'Ordenes',
          route: '/dashboard/orders',
        },
        {
          icon: 'assets/icons/heroicons/outline/clipboard-document-list.svg',
          label: 'Categorias',
          route: '/dashboard/categories',
        },
        {
          icon: 'assets/icons/heroicons/outline/users.svg',
          label: 'Usuarios',
          route: '/dashboard/users',
        },
      ],
    },
  ];
}
