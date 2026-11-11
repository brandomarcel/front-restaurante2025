import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ListFilterBarComponent } from './list-filter-bar.component';

@Component({
  standalone: true,
  imports: [ListFilterBarComponent],
  template:
    '<app-list-filter-bar [showDates]="false"><select aria-label="Tipo"><option>Factura</option></select></app-list-filter-bar>',
})
class ProjectedFilterHost {}

describe('ListFilterBarComponent', () => {
  beforeEach(() => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date(2026, 10, 10, 12));
  });
  afterEach(() => jasmine.clock().uninstall());

  function setup() {
    const fixture = TestBed.createComponent(ListFilterBarComponent);
    fixture.componentRef.setInput('tabs', [
      { value: '', label: 'Todas', countKey: 'ALL' },
      { value: 'con-error', label: 'Con error', countKey: 'CON_ERROR', alert: true },
    ]);
    fixture.detectChanges();
    return fixture;
  }

  it('emits only a changed status', () => {
    const fixture = setup(),
      component = fixture.componentInstance;
    const emit = spyOn(component.statusChange, 'emit');
    component.selectStatus('');
    expect(emit).not.toHaveBeenCalled();
    (fixture.nativeElement.querySelectorAll('button')[1] as HTMLButtonElement).click();
    expect(emit).toHaveBeenCalledOnceWith('con-error');
  });

  it('shows zero, hides absent counts and highlights errors', () => {
    const fixture = setup();
    expect(fixture.nativeElement.querySelectorAll('.tabular-nums').length).toBe(0);
    fixture.componentRef.setInput('counts', { ALL: 0, CON_ERROR: 3 });
    fixture.detectChanges();
    const counts = fixture.nativeElement.querySelectorAll('.tabular-nums');
    expect(counts[0].textContent.trim()).toBe('0');
    expect(counts[1].textContent.trim()).toBe('3');
    expect(counts[1].className).toContain('text-danger-700');
  });

  it('emits today, this month, previous month and clearing dates', () => {
    const component = setup().componentInstance;
    const emit = spyOn(component.datesChange, 'emit');
    component.onDateModeChange('today');
    expect(emit).toHaveBeenCalledWith({ from: '2026-11-10', to: '2026-11-10' });
    component.onDateModeChange('lastMonth');
    expect(emit).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-31' });
    component.onDateModeChange('month');
    expect(emit).toHaveBeenCalledWith({ from: '2026-11-01', to: '2026-11-10' });
    component.onDateModeChange('');
    expect(emit).toHaveBeenCalledWith({ from: '', to: '' });
  });

  it('starts custom dates in this month but preserves an existing range', () => {
    const fixture = setup(),
      component = fixture.componentInstance;
    const emit = spyOn(component.datesChange, 'emit');
    component.onDateModeChange('custom');
    expect(emit).toHaveBeenCalledOnceWith({ from: '2026-11-01', to: '2026-11-10' });
    emit.calls.reset();
    fixture.componentRef.setInput('fromDate', '2026-10-01');
    fixture.componentRef.setInput('toDate', '2026-10-03');
    fixture.detectChanges();
    component.onDateModeChange('custom');
    expect(component.draftFrom).toBe('2026-10-01');
    expect(emit).not.toHaveBeenCalled();
  });

  it('renders invalid-range feedback and does not emit it', () => {
    const fixture = setup(),
      component = fixture.componentInstance;
    const emit = spyOn(component.datesChange, 'emit');
    component.dateMode = 'custom';
    component.draftFrom = '2026-11-11';
    component.draftTo = '2026-11-10';
    component.onCustomDateChange();
    fixture.detectChanges();
    expect(emit).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('posterior');
    component.draftFrom = '2026-11-09';
    component.onCustomDateChange();
    expect(emit).toHaveBeenCalledOnceWith({ from: '2026-11-09', to: '2026-11-10' });
  });

  it('hides date controls for a fixed-day view and keeps projected controls', () => {
    const fixture = TestBed.createComponent(ProjectedFilterHost);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Fecha"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Tipo"]').textContent).toContain('Factura');
  });
});
