import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OrderKitchenCardComponent } from './order-kitchen-card.component';

describe('OrderKitchenCardComponent', () => {
  let component: OrderKitchenCardComponent;
  let fixture: ComponentFixture<OrderKitchenCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OrderKitchenCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OrderKitchenCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
