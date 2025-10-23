import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RetiroCajaComponent } from './retiro-caja.component';

describe('RetiroCajaComponent', () => {
  let component: RetiroCajaComponent;
  let fixture: ComponentFixture<RetiroCajaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RetiroCajaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RetiroCajaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
