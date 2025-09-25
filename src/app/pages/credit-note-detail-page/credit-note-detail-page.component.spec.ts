import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreditNoteDetailPageComponent } from './credit-note-detail-page.component';

describe('CreditNoteDetailPageComponent', () => {
  let component: CreditNoteDetailPageComponent;
  let fixture: ComponentFixture<CreditNoteDetailPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreditNoteDetailPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreditNoteDetailPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
