import { Component, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import { OrdersService } from '../../../../services/orders.service';
import { RouterModule } from '@angular/router';
import { CajasService } from 'src/app/services/cajas.service';
import { UserData } from 'src/app/core/models/user_data';

@Component({
  selector: 'app-nft',
  templateUrl: './nft.component.html',
  imports: [
    CommonModule,
    RouterModule

  ],
})
export class NftComponent implements OnInit {

  // Métricas
  totalOrdersToday = 0;
  total_sales_today = 0;
  montoApertura = 0;
  totalRetiros = 0;
  efectivoSistema = 0;

  // Top productos (si los necesitas fuera del gráfico)
  topProducts: any[] = [];

  userData?: UserData | null;

  constructor(private ordersService: OrdersService,
    private cajasService: CajasService
  ) {

  }

  ngOnInit(): void {
    this.get_dashboard_metrics();
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    console.log('user', user);
    this.userData = user.user_data;

    this.cajasService.getDatosCierre(user.email).subscribe(res => {
      const data = res.message || {};
      console.log(data);
      this.montoApertura = data.monto_apertura;
      this.totalRetiros = data.total_retiros;
      this.efectivoSistema = data.efectivo_sistema;
    });

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
