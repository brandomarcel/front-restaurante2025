import { Injectable } from '@angular/core';

/**
 * Mantiene la pantalla encendida (Screen Wake Lock API) mientras una vista lo necesite,
 * por ejemplo la pantalla de Cocina. Si el navegador no la soporta, no hace nada.
 * El navegador libera el bloqueo al ocultar la pestaña; se vuelve a pedir al regresar.
 */
@Injectable({ providedIn: 'root' })
export class WakeLockService {
  private sentinel: WakeLockSentinel | null = null;
  private wanted = false;
  private listening = false;

  get supported(): boolean {
    return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
  }

  async acquire(): Promise<void> {
    this.wanted = true;
    if (!this.supported) return;
    if (!this.listening) {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.listening = true;
    }
    await this.request();
  }

  async release(): Promise<void> {
    this.wanted = false;
    if (this.listening) {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      this.listening = false;
    }
    const sentinel = this.sentinel;
    this.sentinel = null;
    try {
      await sentinel?.release();
    } catch { /* ya liberado */ }
  }

  private readonly onVisibilityChange = (): void => {
    if (this.wanted && document.visibilityState === 'visible') void this.request();
  };

  private async request(): Promise<void> {
    if (this.sentinel && !this.sentinel.released) return;
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
    } catch {
      // Sin permiso, batería baja o pestaña oculta: la pantalla sigue su ajuste normal.
      this.sentinel = null;
    }
  }
}
