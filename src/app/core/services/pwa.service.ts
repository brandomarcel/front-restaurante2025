import { Injectable, computed, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, interval } from 'rxjs';
import { toast } from 'ngx-sonner';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** Evento no estándar de Chromium con el que se ofrece instalar la app. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Avisos de PWA: nueva versión disponible y pérdida/recuperación de conexión.
 * No cachea ni reintenta datos de negocio; solo informa al usuario.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly swUpdate = inject(SwUpdate);
  private offlineToastId: string | number | undefined;
  private installEvent: BeforeInstallPromptEvent | null = null;
  private readonly installable = signal(false);
  private readonly installed = signal(this.isStandalone());

  /** Chrome/Edge/Android ofrecen instalar; en iOS no existe el evento y se muestran los pasos manuales. */
  readonly canShowInstall = computed(() => !this.installed() && (this.installable() || this.isIos()));

  init(): void {
    this.watchConnection();
    this.watchUpdates();
    this.watchInstall();
  }

  async install(): Promise<void> {
    if (this.installEvent) {
      const event = this.installEvent;
      this.installEvent = null;
      this.installable.set(false);
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === 'accepted') this.installed.set(true);
      return;
    }
    if (this.isIos()) {
      toast.info('Para instalar: toca Compartir y elige «Agregar a pantalla de inicio».', { duration: 10000 });
    }
  }

  private watchInstall(): void {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.installEvent = event as BeforeInstallPromptEvent;
      this.installable.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.installEvent = null;
      this.installable.set(false);
      this.installed.set(true);
    });
  }

  private isStandalone(): boolean {
    return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  }

  /** iPadOS se identifica como Mac, por eso también se revisa el soporte táctil. */
  private isIos(): boolean {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
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
