import { MenuItem } from '../models/menu.model';

export class Menu {
  public static pages: MenuItem[] = [
    // {
    //   group: 'Base',
    //   separator: false,
    //   items: [
    //     {
    //       icon: 'assets/icons/heroicons/outline/chart-pie.svg',
    //       label: 'Dashboard',
    //       route: '/dashboard',
    //       children: [{ label: 'Nfts', route: '/dashboard/nfts' }],
    //     },

    //     {
    //       icon: 'assets/icons/heroicons/outline/lock-closed.svg',
    //       label: 'Auth',
    //       route: '/auth',
    //       children: [
    //         { label: 'Sign up', route: '/auth/sign-up' },
    //         { label: 'Sign in', route: '/auth/sign-in' },
    //         { label: 'Forgot Password', route: '/auth/forgot-password' },
    //         { label: 'New Password', route: '/auth/new-password' },
    //         { label: 'Two Steps', route: '/auth/two-steps' },
    //       ],
    //     },
    //     {
    //       icon: 'assets/icons/heroicons/outline/exclamation-triangle.svg',
    //       label: 'Errors',
    //       route: '/errors',
    //       children: [
    //         { label: '404', route: '/errors/404' },
    //         { label: '500', route: '/errors/500' },
    //       ],
    //     },
    //     {
    //       icon: 'assets/icons/heroicons/outline/cube.svg',
    //       label: 'Components',
    //       route: '/components',
    //       children: [{ label: 'Table', route: '/components/table' }],
    //     },
    //   ],
    // },

    // {
    //   group: 'Inicio',
    //   separator: true,
    //   items: [
    //     {
    //       icon: 'assets/icons/heroicons/outline/chart-pie.svg',
    //       label: 'Dashboard',
    //       route: '/dashboard',
    //     }
    //   ],
    // },
    {
      group: 'Principal',
      separator: false,
      items: [
        {
          icon: 'assets/icons/heroicons/outline/chart-pie.svg',
          label: 'Dashboard',
          route: '/dashboard/nfts',
        },
         {
          icon: 'assets/icons/heroicons/outline/building-storefront.svg',
          label: 'POS',
          route: '/dashboard/pos',
        }
        
      ],
    },

    // {
    //   group: 'Punto de Venta',
    //   separator: true,
    //   items: [
    //     {
    //       icon: 'assets/icons/heroicons/outline/building-storefront.svg',
    //       label: 'POS',
    //       route: '/dashboard/pos',
    //     }
    //   ],
    // },

    {
      group: 'Caja',
      separator: false,
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
// {
//           icon: 'assets/icons/heroicons/outline/download.svg',
//           label: 'Reporte',
//           route: '/dashboard/ventasproducto',
//         },

     {
      group: 'Reportes',
      separator: false,
      items: [
        {
          icon: 'assets/icons/heroicons/outline/download.svg',
          label: 'Reportes',
          route: '/dashboard',
          children: [
            { label: 'Productos Mas Vendidos', route: '/dashboard/ventasproducto' },
            { label: 'Cierres de Caja', route: '/dashboard/report-cierre-caja' },
            
          ],
        },

      ],
    },


    {
      group: 'Configuracion',
      separator: false,
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
        // {
        //   icon: 'assets/icons/heroicons/outline/bell.svg',
        //   label: 'Reportes',
        //   route: '/dashboard/reports',
        // },
        {
          icon: 'assets/icons/heroicons/outline/list-bullet.svg',
          label: 'Categorias',
          route: '/dashboard/categories',
        },
        // {
        //   icon: 'assets/icons/heroicons/outline/folder.svg',
        //   label: 'Folders',
        //   route: '/folders',
        //   children: [
        //     { label: 'Current Files', route: '/folders/current-files' },
        //     { label: 'Downloads', route: '/folders/download' },
        //     { label: 'Trash', route: '/folders/trash' },
        //   ],
        // },
        

        // {
        //   icon: 'assets/icons/heroicons/outline/download.svg',
        //   label: 'Cierre de Caja',
        //   route: '/dashboard/close-caja',
        // },
        // {
        //   icon: 'assets/icons/heroicons/outline/download.svg',
        //   label: 'Apertura de Caja',
        //   route: '/dashboard/apertura-caja',
        // },
        // {
        //   icon: 'assets/icons/heroicons/outline/download.svg',
        //   label: 'Retiro de Caja',
        //   route: '/dashboard/retiro-caja',
        // }

      ],
    },

    


    //     {
    //   group: 'Reportes',
    //   separator: true,
    //   items: [
    //     {
    //       icon: 'assets/icons/heroicons/outline/download.svg',
    //       label: 'Reporte',
    //       route: '/dashboard/ventasproducto',
    //     },
    //   ],
    // },
    //  {
    //   group: 'Caja',
    //   separator: true,
    //   items: [
    //     {
    //       icon: 'assets/icons/heroicons/outline/download.svg',
    //       label: 'Reporte',
    //       route: '/dashboard/ventasproducto',
    //     },
    //   ],
    // },
  ];
}
