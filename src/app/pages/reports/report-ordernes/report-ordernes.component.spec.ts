import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReportOrdernesComponent } from './report-ordernes.component';

describe('ReportOrdernesComponent', () => {
  let component: ReportOrdernesComponent;
  let fixture: ComponentFixture<ReportOrdernesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportOrdernesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReportOrdernesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
