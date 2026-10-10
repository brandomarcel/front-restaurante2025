import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { CajaNavComponent } from './caja-nav.component';

describe('CajaNavComponent', () => {
  function render(permissions: string[], state: any = 'open') {
    TestBed.configureTestingModule({
      imports: [CajaNavComponent],
      providers: [provideRouter([]), { provide: CompanyCapabilitiesService, useValue: { isEnabled: () => true, hasPermission: (key: string) => permissions.includes(key) } }]
    });
    const fixture = TestBed.createComponent(CajaNavComponent);
    fixture.componentInstance.active = 'retiro';
    fixture.componentInstance.state = state;
    fixture.componentInstance.opening = 'AP-9';
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('muestra los tres pasos del turno y marca el actual', () => {
    const el = render(['billing.create']);
    const links = Array.from(el.querySelectorAll('a')).map((a) => a.textContent!.trim());
    expect(links).toEqual(['1 Abrir', '2 Retiros', '3 Cerrar']);
    expect(el.querySelector('[aria-current="page"]')!.textContent).toContain('Retiros');
    expect(el.textContent).toContain('Caja abierta');
  });

  it('Gestión de cajas solo para gerente o administrador', () => {
    expect(render(['billing.manage']).textContent).toContain('Gestión de cajas');
  });

  it('un cajero no ve Gestión de cajas', () => {
    expect(render(['billing.create'], 'closed').textContent).not.toContain('Gestión de cajas');
  });
});
