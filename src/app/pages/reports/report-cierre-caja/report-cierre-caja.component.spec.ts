import { Subject, of } from 'rxjs';
import { ReportCierreCajaComponent } from './report-cierre-caja.component';

describe('Cash closing report', () => {
  let component: ReportCierreCajaComponent;
  let capabilities: any;
  let service: any;
  let response: Subject<any>;
  beforeEach(() => {
    response = new Subject();
    capabilities = { activeBusinessId: 'A', reportScope: 'global', hasPermission: () => true, isEnabled: () => true };
    service = { getCashClosingsReport: jasmine.createSpy().and.returnValue(response),
      exportCashClosingsReport: jasmine.createSpy().and.returnValue(of(new Blob())) };
    component = new ReportCierreCajaComponent(service, capabilities, { error: () => {} } as any);
    component.ngOnInit();
  });
  afterEach(() => component.ngOnDestroy());
  it('reads actual backend withdrawals and differences for summary totals', () => {
    response.next({ message: { result: [{ withdrawals_total: 12, difference: -2, cash_system: 100 }] } });
    response.complete();
    expect(component.totalRetiradoSum).toBe(12);
    expect(component.totalDiferencia).toBe(-2);
    expect(component.money(component.rows[0], 'cash_system')).toBe(100);
    expect(component.canExport).toBeTrue();
    component.filters.status = 'Confirmado';
    expect(component.canExport).toBeFalse();
  });
  it('ignores responses from another business and prevents exporting them', () => {
    capabilities.activeBusinessId = 'B';
    response.next({ message: { result: [{ name: 'PRIVATE-A' }] } });
    expect(component.rows).toEqual([]);
    expect(component.canExport).toBeFalse();
  });
  it('cancels subscriptions when destroyed', () => {
    component.ngOnDestroy();
    expect(response.observed).toBeFalse();
  });
  it('excludes the native total row from counts and summary sums', () => {
    response.next({ message: { add_total_row: 1,
      columns: [{ fieldname: 'name' }, { fieldname: 'withdrawals_total' }, { fieldname: 'difference' }],
      result: [{ name: 'CLOSE-1', withdrawals_total: 12, difference: -2 }, ['Total', 12, -2]] } });
    expect(component.rows.length).toBe(1);
    expect(component.totalRetiradoSum).toBe(12);
    expect(component.totalDiferencia).toBe(-2);
  });
  it('checks report scope and permission before loading', () => {
    capabilities.reportScope = 'billing';
    service.getCashClosingsReport.calls.reset();
    component.buscar();
    expect(service.getCashClosingsReport).not.toHaveBeenCalled();
    expect(component.canView).toBeFalse();
  });
});
