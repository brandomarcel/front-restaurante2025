import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { InvoicesService } from 'src/app/services/invoices.service';
import { InvoicesComponent } from './invoices.component';

describe('InvoicesComponent', () => {
  let component: InvoicesComponent;
  let fixture: ComponentFixture<InvoicesComponent>;
  let service: jasmine.SpyObj<InvoicesService>;
  const rows = [
    {
      name: 'FLINV-1',
      document_number: '001-001-000000001',
      status: 'Autorizada',
      customer_name: 'Ana Pérez',
      total: 10,
    },
    { name: 'FLINV-2', document_number: '001-001-000000002', status: 'Emitida', customer_name: 'Luis Mora', total: 20 },
  ];

  function setup(isLiteMode = true, query: Record<string, string> = {}) {
    service = jasmine.createSpyObj<InvoicesService>('InvoicesService', ['getAllInvoices']);
    service.getAllInvoices.and.returnValue(of({ message: { data: rows, total: rows.length } }) as any);
    TestBed.configureTestingModule({
      imports: [InvoicesComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
        { provide: InvoicesService, useValue: service },
        { provide: CompanyCapabilitiesService, useValue: { isLiteMode, hasPermission: () => true } },
      ],
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

  it('offers the agreed business groups instead of technical statuses', () => {
    setup();
    const values = component.statusOptions.map((option) => option.value);
    expect(values).toEqual(['autorizadas', 'en-proceso', 'con-error', 'anuladas']);
    component.setStatus('en-proceso');
    expect(service.getAllInvoices).toHaveBeenCalledWith(10, 0, 'EN_PROCESO', '');
    service.getAllInvoices.calls.reset();
    component.setStatus('en-proceso');
    expect(service.getAllInvoices).not.toHaveBeenCalled();
  });

  it('restores old status links, search, dates and page before querying the server', () => {
    setup(true, { estado: 'Rechazada', q: 'Ana', desde: '2026-11-01', hasta: '2026-11-10', pagina: '3' });
    expect(component.statusFiltro).toBe('con-error');
    expect(service.getAllInvoices).toHaveBeenCalledOnceWith(10, 20, 'CON_ERROR', 'Ana', {
      from: '2026-11-01',
      to: '2026-11-10',
    });
  });

  it('passes date changes to the backend, resets the page and preserves server counts', () => {
    setup();
    service.getAllInvoices.and.returnValue(
      of({
        message: {
          data: [],
          total: 0,
          status_counts: { ALL: 4, Autorizada: 0, EN_PROCESO: 3, CON_ERROR: 1, Anulada: 0 },
        },
      }) as any,
    );
    component.page = 3;
    component.onDatesChange({ from: '2026-11-01', to: '2026-11-10' });
    expect(service.getAllInvoices).toHaveBeenCalledWith(10, 0, undefined, '', { from: '2026-11-01', to: '2026-11-10' });
    expect(component.page).toBe(1);
    expect(component.statusCounts?.['ALL']).toBe(4);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.text-danger-700').textContent.trim()).toBe('1');
    component.limpiarFiltros();
    expect(component.dateRange).toBeUndefined();
  });
  it('renders cancellation in both table and mobile rows even when SRI remains authorized', () => {
    setup();
    component.invoices = [
      {
        name: 'VOID-1',
        status: 'Autorizada',
        sri: { provider_status: 'AUTHORIZED' },
        credit_note_summary: { state: 'FULL' },
      },
    ];
    component.aplicarFiltros();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Anulada con nota de crédito');
    expect(fixture.nativeElement.querySelector('tbody tr').className).toContain('bg-muted/40');
    expect(fixture.nativeElement.querySelector('ul li').className).toContain('bg-muted/40');
  });

  it('debounces the backend search but filters the visible page immediately', () => {
    setup();
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-10-08T12:00:00Z'));
    try {
      service.getAllInvoices.calls.reset();
      component.search = 'a';
      component.search = 'ana';
      expect(component.invoicesFiltradas.map((row) => row.name)).toEqual(['FLINV-1']);
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
