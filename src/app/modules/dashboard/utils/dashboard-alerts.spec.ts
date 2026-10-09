import { SignatureStatus } from '../dashboard.models';
import { buildDashboardAlerts } from './dashboard-alerts';

describe('buildDashboardAlerts', () => {
  const missing: SignatureStatus = { label: 'Sin firma', tone: 'danger', missing: true, expired: false, daysLeft: null };
  const expiring: SignatureStatus = { label: 'Vence en 5 días', tone: 'warning', missing: false, expired: false, daysLeft: 5 };

  it('avisa caja sin apertura y firma faltante en el panel operativo', () => {
    const alerts = buildDashboardAlerts({ view: 'operations', signature: missing, cashClosed: true });
    expect(alerts.map((alert) => alert.titulo)).toEqual(['Caja', 'Firma']);
  });

  it('avisa error de comprobantes y vencimiento próximo de la firma', () => {
    const alerts = buildDashboardAlerts({ view: 'billing', signature: expiring, cashClosed: false, billingError: 'Sin conexión' });
    expect(alerts).toEqual([
      { titulo: 'Comprobantes', mensaje: 'Sin conexión', tipo: 'error' },
      { titulo: 'Firma', mensaje: 'La firma vencerá en 5 día(s).', tipo: 'warning' }
    ]);
  });

  it('Mesero no recibe avisos de caja ni firma', () => {
    expect(buildDashboardAlerts({ view: 'service', signature: missing, cashClosed: true })).toEqual([]);
  });
});
