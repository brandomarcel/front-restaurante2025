import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PosShellComponent } from './pos-shell.component';

describe('PosShellComponent', () => {
  let component: PosShellComponent;
  let fixture: ComponentFixture<PosShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PosShellComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PosShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
