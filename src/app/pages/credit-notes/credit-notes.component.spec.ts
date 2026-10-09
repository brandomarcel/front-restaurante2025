import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { CreditNoteService } from 'src/app/services/credit-note.service';
import { CreditNotesComponent } from './credit-notes.component';

describe('CreditNotesComponent', () => {
  let component: CreditNotesComponent;
  let fixture: ComponentFixture<CreditNotesComponent>;
  let service: jasmine.SpyObj<CreditNoteService>;
  const rows = [
    { name: 'FLINV-NC-1', document_number: '001-001-000000010', status: 'Emitida', customer_name: 'Ana Pérez', related_document_number: '001-001-000000001', grand_total: 5 },
    { name: 'FLINV-NC-2', document_number: '001-001-000000011', status: 'Autorizada', customer_name: 'Luis Mora', grand_total: 8 }
  ];

  beforeEach(() => {
    service = jasmine.createSpyObj<CreditNoteService>('CreditNoteService', ['getAllCreditNotes']);
    service.getAllCreditNotes.and.returnValue(of({ message: { data: rows, total: rows.length } }) as any);
    TestBed.configureTestingModule({
      imports: [CreditNotesComponent],
      providers: [
        provideRouter([]),
        { provide: CreditNoteService, useValue: service },
        // Restaurante: las notas de crédito deben seguir leyéndose con el contrato Lite.
        { provide: CompanyCapabilitiesService, useValue: { isLiteMode: false, hasPermission: () => true } }
      ]
    });
    fixture = TestBed.createComponent(CreditNotesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders Lite status labels even when the business operates as restaurant', () => {
    expect(service.getAllCreditNotes).toHaveBeenCalledOnceWith(10, 0, undefined, '');
    expect(fixture.nativeElement.textContent).toContain('Autorización pendiente');
    expect(component.statusOptions.map(option => option.value)).toContain('Anulada');
  });

  it('debounces the backend search', () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-08T12:00:00Z'));
    try {
      service.getAllCreditNotes.calls.reset();
      component.search = 'luis';
      expect(component.invoicesFiltradas.map(row => row.name)).toEqual(['FLINV-NC-2']);
      expect(service.getAllCreditNotes).not.toHaveBeenCalled();
      jasmine.clock().tick(300);
      expect(service.getAllCreditNotes).toHaveBeenCalledOnceWith(10, 0, undefined, 'luis');
    } finally {
      jasmine.clock().uninstall();
    }
  });
});
