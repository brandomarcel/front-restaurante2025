import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AperturaCajaComponent } from './apertura-caja.component';

describe('AperturaCajaComponent', () => {
  let component: AperturaCajaComponent;
  let fixture: ComponentFixture<AperturaCajaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AperturaCajaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AperturaCajaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
