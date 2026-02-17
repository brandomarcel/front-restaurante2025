import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderVM } from 'src/app/services/realtime-orders.service';

@Component({
  selector: 'app-order-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './order-modal.component.html',
})
export class OrderModalComponent {

  @Input({ required: true }) order!: OrderVM;

  @Output() close = new EventEmitter<void>();
  @Output() toPreparacion = new EventEmitter<OrderVM>();
  @Output() askClose = new EventEmitter<OrderVM>();

}
