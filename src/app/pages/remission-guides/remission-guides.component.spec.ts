import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { RemissionGuidesService } from 'src/app/services/remission-guides.service';
import { RemissionGuidesComponent } from './remission-guides.component';

describe('RemissionGuidesComponent', () => {
  it('only filters by the seven statuses guides use and invites to create the first guide', () => {
    const service = jasmine.createSpyObj<RemissionGuidesService>('RemissionGuidesService', ['getAll']);
    service.getAll.and.returnValue(of({ message: { data: [], total: 0 } }) as any);
    TestBed.configureTestingModule({
      imports: [RemissionGuidesComponent],
      providers: [
        provideRouter([]),
        { provide: RemissionGuidesService, useValue: service },
        { provide: CompanyCapabilitiesService, useValue: { isLiteMode: true, hasPermission: () => true } }
      ]
    });
    const fixture = TestBed.createComponent(RemissionGuidesComponent);
    fixture.detectChanges();

    const values = fixture.componentInstance.statusOptions.map(option => option.value);
    expect(values.length).toBe(7);
    expect(values).not.toContain('Reemplazada');
    expect(values).not.toContain('Anulada');
    expect(fixture.nativeElement.textContent).toContain('Crear la primera guía');
  });
});
