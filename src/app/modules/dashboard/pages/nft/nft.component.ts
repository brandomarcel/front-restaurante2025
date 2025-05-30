import { Component, OnInit } from '@angular/core';
import { NftAuctionsTableComponent } from '../../components/nft/nft-auctions-table/nft-auctions-table.component';
import { NftChartCardComponent } from '../../components/nft/nft-chart-card/nft-chart-card.component';
import { NftDualCardComponent } from '../../components/nft/nft-dual-card/nft-dual-card.component';
import { NftHeaderComponent } from '../../components/nft/nft-header/nft-header.component';
import { NftSingleCardComponent } from '../../components/nft/nft-single-card/nft-single-card.component';
import { Nft } from '../../models/nft';
import { CommonModule } from '@angular/common';
import { OrdersService } from '../../../../services/orders.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-nft',
  templateUrl: './nft.component.html',
  imports: [
    CommonModule,
    RouterModule

  ],
})
export class NftComponent implements OnInit {

  totalOrdersToday = 120;
  total_sales_today = 34500;
  ordersInProgress = 8;
  topProducts = [
    { name: 'Hamburguesa Clásica', count: 35 },
    { name: 'Pizza Pepperoni', count: 28 },
    { name: 'Tacos al Pastor', count: 22 },
  ];

  constructor(private ordersService: OrdersService) {

  }

  ngOnInit(): void {
    this.get_dashboard_metrics();
   }

  get_dashboard_metrics() {
    this.ordersService.get_dashboard_metrics().subscribe({
      next: (res: any) => {
        const data = res.message;
        console.log('Datos obtenidos de la API:', data);
        this.totalOrdersToday = data.total_orders_today;
        this.total_sales_today = data.total_sales_today;
        this.topProducts = data.top_products;
      },
      error: (error: any) => {
        console.error('Error al obtener los datos de la API:', error);
      },
    });
  }

}
