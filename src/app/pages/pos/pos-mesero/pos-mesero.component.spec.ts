import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PosMeseroComponent } from './pos-mesero.component';

describe('PosMeseroComponent', () => {
  let component: PosMeseroComponent;
  let fixture: ComponentFixture<PosMeseroComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosMeseroComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PosMeseroComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
