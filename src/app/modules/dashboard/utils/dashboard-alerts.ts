import { Aviso } from 'src/app/shared/components/avisos/avisos.component';
import { DashboardView, SignatureStatus } from '../dashboard.models';

export type DashboardAlert = Pick<Aviso, 'titulo' | 'mensaje' | 'tipo'>;

export interface DashboardAlertsInput {
  view: DashboardView;
  signature: SignatureStatus;
  /** Turno sin apertura cuando la caja aplica al panel operativo. */
  cashClosed: boolean;
  billingError?: string;
}

/**
 * Avisos de la parte superior del dashboard. El plan y el inventario no se
 * repiten aquí: el panel de facturación ya los muestra en su propia sección.
 */
export function buildDashboardAlerts(input: DashboardAlertsInput): DashboardAlert[] {
  // Mesero y Cocina no administran caja ni firma.
  if (input.view === 'service' || input.view === 'kitchen' || input.view === 'none') return [];

  const alerts: DashboardAlert[] = [];
  if (input.billingError) alerts.push({ titulo: 'Comprobantes', mensaje: input.billingError, tipo: 'error' });
  if (input.cashClosed) {
    alerts.push({ titulo: 'Caja', mensaje: 'No hay apertura de caja activa. Realiza la apertura para iniciar el turno.', tipo: 'warning' });
  }

  const { signature } = input;
  if (signature.missing) {
    alerts.push({ titulo: 'Firma', mensaje: 'Registra tu firma electrónica para poder emitir comprobantes.', tipo: 'warning' });
  } else if (signature.expired) {
    alerts.push({ titulo: 'Firma', mensaje: 'La firma electrónica ha expirado.', tipo: 'error' });
  } else if (signature.daysLeft !== null && signature.daysLeft <= 30) {
    alerts.push({ titulo: 'Firma', mensaje: `La firma vencerá en ${signature.daysLeft} día(s).`, tipo: 'warning' });
  }
  return alerts;
}
