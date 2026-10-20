import { CompanyComponent } from './company.component';

describe('CompanyComponent certificate dates', () => {
  const component: CompanyComponent = Object.create(CompanyComponent.prototype);

  it('shows stored UTC dates in Ecuador time with the exact start time', () => {
    const formatted = component.formatCertificateDateTime('2026-10-20 15:30:00');
    expect(formatted).toContain('20/10/2026');
    expect(formatted).toContain('10:30:00');
    expect(formatted).toContain('hora de Ecuador continental');
    expect(formatted).toBe(component.formatCertificateDateTime('2026-10-20T10:30:00-05:00'));
  });

  it('explains when a certificate becomes valid without asking to replace it', () => {
    component.certInfo = { status: 'No vigente', validFrom: '2026-10-20 15:30:00' };
    expect(component.certificateBlockingMessage).toContain('10:30:00');
    expect(component.certificateBlockingMessage).toContain('estará vigente');
    expect(component.certificateIsBlocking).toBeTrue();
    component.certInfo = { status: 'Vigente' };
    expect(component.certificateIsBlocking).toBeFalse();
  });
});
