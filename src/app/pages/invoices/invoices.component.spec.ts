import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { InvoicesService } from 'src/app/services/invoices.service';
import { InvoicesComponent } from './invoices.component';

describe('InvoicesComponent', () => {
  let component: InvoicesComponent;
  let fixture: ComponentFixture<InvoicesComponent>;
  let service: jasmine.SpyObj<InvoicesService>;
  const rows = [
    { name: 'FLINV-1', document_number: '001-001-000000001', status: 'Autorizada', customer_name: 'Ana Pérez', total: 10 },
    { name: 'FLINV-2', document_number: '001-001-000000002', status: 'Emitida', customer_name: 'Luis Mora', total: 20 }
  ];

  function setup(isLiteMode = true) {
    service = jasmine.createSpyObj<InvoicesService>('InvoicesService', ['getAllInvoices']);
    service.getAllInvoices.and.returnValue(of({ message: { data: rows, total: rows.length } }) as any);
    TestBed.configureTestingModule({
      imports: [InvoicesComponent],
      providers: [
        provideRouter([]),
        { provide: InvoicesService, useValue: service },
        { provide: CompanyCapabilitiesService, useValue: { isLiteMode, hasPermission: () => true } }
      ]
    });
    fixture = TestBed.createComponent(InvoicesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('loads the first page and renders a status badge per row', () => {
    setup();
    expect(service.getAllInvoices).toHaveBeenCalledOnceWith(10, 0, undefined, '');
    const badges = fixture.nativeElement.querySelectorAll('app-electronic-status-badge');
    expect(badges.length).toBeGreaterThanOrEqual(rows.length);
    expect(fixture.nativeElement.textContent).toContain('Autorización pendiente');
  });

  it('offers every backend status from the electronic contract with Lite labels', () => {
    setup();
    const values = component.statusOptions.map(option => option.value);
    expect(values).toContain('En Revision');
    expect(values).toContain('Reemplazada');
    expect(component.statusOptions.find(option => option.value === 'Emitida')?.label).toBe('Autorización pendiente');
  });

  it('debounces the backend search but filters the visible page immediately', () => {
    setup();
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-08T12:00:00Z'));
    try {
      service.getAllInvoices.calls.reset();
      component.search = 'a';
      component.search = 'ana';
      expect(component.invoicesFiltradas.map(row => row.name)).toEqual(['FLINV-1']);
      expect(service.getAllInvoices).not.toHaveBeenCalled();
      jasmine.clock().tick(300);
      expect(service.getAllInvoices).toHaveBeenCalledOnceWith(10, 0, undefined, 'ana');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('shows a contextual empty state with a clear action when filters hide every row', () => {
    setup();
    service.getAllInvoices.and.returnValue(of({ message: { data: [], total: 0 } }) as any);
    component.statusFiltro = 'Anulada';
    component.onStatusChange();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ninguna factura coincide con los filtros.');
    component.limpiarFiltros();
    expect(component.statusFiltro).toBe('');
    expect(service.getAllInvoices).toHaveBeenCalledWith(10, 0, undefined, '');
  });
});
