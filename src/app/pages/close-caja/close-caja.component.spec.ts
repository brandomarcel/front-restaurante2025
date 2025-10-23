import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CloseCajaComponent } from './close-caja.component';

describe('CloseCajaComponent', () => {
  let component: CloseCajaComponent;
  let fixture: ComponentFixture<CloseCajaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CloseCajaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CloseCajaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
