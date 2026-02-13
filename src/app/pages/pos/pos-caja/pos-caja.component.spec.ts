import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PosCajaComponent } from './pos-caja.component';

describe('PosCajaComponent', () => {
  let component: PosCajaComponent;
  let fixture: ComponentFixture<PosCajaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosCajaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PosCajaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
