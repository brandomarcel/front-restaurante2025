import { BehaviorSubject, of, Subject } from 'rxjs';
import { FrappeReportsComponent } from './frappe-reports.component';
import { reportDefinitions } from './frappe-report-definitions';
import { ReportsHomeComponent } from '../reports-home/reports-home.component';

describe('Frappe reports', () => {
  let component: FrappeReportsComponent;
  let capabilities: any;
  let service: any;
  let response: Subject<any>;
  const columns = [
    { fieldname: 'business', label: 'Negocio' },
    { fieldname: 'grand_total', label: 'Total', fieldtype: 'Currency' },
    { fieldname: 'name', label: 'Factura' },
    { fieldname: 'total_collected', label: 'Cobrado', fieldtype: 'Currency' }
  ];

  beforeEach(() => {
    capabilities = { features: { billing: true, products: true, restaurant: true }, activeBusinessId: 'A',
      reportScope: 'global', hasPermission: () => true };
    response = new Subject();
    service = { run: jasmine.createSpy('run').and.returnValue(response),
      exportExcel: jasmine.createSpy('exportExcel').and.returnValue(of(new Blob())) };
    component = new FrappeReportsComponent(
      { data: new BehaviorSubject({ defaultReport: 'FacturADA Lite Ventas' }) } as any,
      service, { getAll: () => of([]) } as any,
      { getSoloFechaEcuador: () => '2026-10-08' } as any,
      { show: () => {}, hide: () => {} } as any, capabilities);
    component.ngOnInit();
    spyOn<any>(component, 'downloadBlob');
  });
  afterEach(() => component.ngOnDestroy());

  it('renders reordered array columns and exports all report rows', () => {
    response.next({ message: { columns, result: [['A', 11.5, 'INV-1', 5]] } });
    expect(component.displayColumns.map(column => column.fieldname)).toEqual(['name', 'grand_total', 'total_collected']);
    expect(component.getCell(component.rows[0], component.displayColumns[0], 0)).toBe('INV-1');
    response.complete();
    component.exportExcel();
    expect(service.exportExcel).toHaveBeenCalledWith('FacturADA Lite Ventas', jasmine.any(Object));
    expect((component as any).downloadBlob).toHaveBeenCalled();
  });

  it('requires a fresh query after filters change', () => {
    response.next({ message: { columns, result: [] } });
    component.filters['from_date'] = '2026-09-01';
    component.exportExcel();
    expect(service.exportExcel).not.toHaveBeenCalled();
  });

  it('discards results from a previously selected business', () => {
    capabilities.activeBusinessId = 'B';
    response.next({ message: { columns, result: [{ name: 'PRIVATE-A' }] } });
    expect(component.rows).toEqual([]);
    component.exportExcel();
    expect(service.exportExcel).not.toHaveBeenCalled();
  });

  it('cancels an obsolete query when the report changes', () => {
    component.selectReport('Ventas por Fecha Lite', false);
    expect(response.observed).toBeFalse();
    response.next({ message: { columns, result: [{ name: 'OLD' }] } });
    expect(component.rows).toEqual([]);
    expect(component.loading).toBeFalse();
  });

  it('validates date ranges and integer limits before querying', () => {
    service.run.calls.reset();
    component.filters['from_date'] = '2026-10-09';
    component.runReport();
    expect(service.run).not.toHaveBeenCalled();
    component.filters['from_date'] = '2026-10-01';
    component.filters['limit'] = 1.5;
    component.runReport();
    expect(service.run).not.toHaveBeenCalled();
  });

  it('formats counts and manual review without treating them as currency', () => {
    expect(component.isMoneyColumn({ fieldname: 'total_facturas', fieldtype: 'Int' })).toBeFalse();
    expect(component.isMoneyColumn({ fieldname: 'grand_total', fieldtype: 'Currency' })).toBeTrue();
    expect(component.formatCell({ review: 1 }, { fieldname: 'review', fieldtype: 'Check' }, 0)).toBe('Sí');
    expect(component.formatCell({ review: 0 }, { fieldname: 'review', fieldtype: 'Check' }, 0)).toBe('No');
  });

  it('applies report scope equally to the catalog and report selector', () => {
    component.ngOnDestroy();
    capabilities.reportScope = 'billing';
    component.ngOnInit();
    expect(component.reports.every(report => report.category === 'billing')).toBeTrue();
    const home = new ReportsHomeComponent(capabilities);
    expect(home.visibleReports.map(card => card.route)).toEqual(component.reports.map(report => report.route));
  });

  it('uses registered restaurant reports and the backend filter names', () => {
    const definitions = reportDefinitions(true);
    expect(definitions.some(report => report.name === 'Orders Report')).toBeFalse();
    const orders = definitions.find(report => report.name === 'FacturADA Restaurant Orders')!;
    expect(orders.filters.some(filter => filter.key === 'order_type')).toBeTrue();
    expect(orders.visibleColumns).toContain('creation');
    component.selectReport('Orders Report', false);
    expect(component.selectedReportName).toBe(orders.name);
  });
});
