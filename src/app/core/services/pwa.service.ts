import { Injectable, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, interval } from 'rxjs';
import { toast } from 'ngx-sonner';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Avisos de PWA: nueva versión disponible y pérdida/recuperación de conexión.
 * No cachea ni reintenta datos de negocio; solo informa al usuario.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly swUpdate = inject(SwUpdate);
  private offlineToastId: string | number | undefined;

  init(): void {
    this.watchConnection();
    this.watchUpdates();
  }

  private watchConnection(): void {
    window.addEventListener('offline', () => this.showOffline());
    window.addEventListener('online', () => this.showOnline());
    if (!navigator.onLine) this.showOffline();
  }

  private checkForUpdate(): void {
    if (!navigator.onLine) return;
    this.swUpdate.checkForUpdate().catch(() => undefined);
  }

  private showOffline(): void {
    if (this.offlineToastId !== undefined) return;
    this.offlineToastId = toast.warning('Sin conexión a internet. Algunas funciones no estarán disponibles.', {
      duration: Infinity,
    });
  }

  private showOnline(): void {
    if (this.offlineToastId !== undefined) {
      toast.dismiss(this.offlineToastId);
      this.offlineToastId = undefined;
    }
    toast.success('Conexión restablecida.');
  }

  private watchUpdates(): void {
    if (!this.swUpdate.isEnabled) return;
    // Un POS puede quedar abierto todo el día sin navegar: se consulta cada hora y al volver a la pestaña.
    interval(UPDATE_CHECK_INTERVAL_MS).subscribe(() => this.checkForUpdate());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.checkForUpdate();
    });
    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => {
        toast.info('Hay una nueva versión de FacturADA disponible.', {
          duration: Infinity,
          action: {
            label: 'Actualizar',
            onClick: () => this.swUpdate.activateUpdate().then(() => document.location.reload()),
          },
        });
      });
  }
}
