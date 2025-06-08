import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VentasProductoComponent } from './ventas-producto.component';

describe('VentasProductoComponent', () => {
  let component: VentasProductoComponent;
  let fixture: ComponentFixture<VentasProductoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VentasProductoComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VentasProductoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
