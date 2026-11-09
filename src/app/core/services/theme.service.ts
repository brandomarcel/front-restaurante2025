import { Injectable, signal } from '@angular/core';
import { Theme } from '../models/theme.model';
import { effect } from '@angular/core';

/** Color de tema por defecto: la paleta de la marca (ver `styles.css`). */
export const DEFAULT_THEME_COLOR = 'facturada';
/** Marca de que el equipo ya pasó a la paleta de la marca (2026-11-08). */
const PALETTE_MIGRATION_KEY = 'theme_palette';
const PALETTE_VERSION = 'facturada-2026-11';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  public theme = signal<Theme>({ mode: 'light', color: DEFAULT_THEME_COLOR, direction: 'ltr' });

  constructor() {
    this.loadTheme();
    effect(() => {
      this.setConfig();
    });
  }

  private loadTheme() {
    let saved: Partial<Theme> | null = null;
    try {
      saved = JSON.parse(localStorage.getItem('theme') || 'null');
    } catch {
      saved = null;
    }
    if (!saved) return;
    let color = saved.color || DEFAULT_THEME_COLOR;
    // Hasta 2026-11 el color por defecto era «violet» y no había selector en pantalla: nadie lo eligió. Se pasa una
    // sola vez a la paleta de la marca; el modo claro/oscuro del equipo se respeta.
    if (localStorage.getItem(PALETTE_MIGRATION_KEY) !== PALETTE_VERSION) {
      if (color === 'violet') color = DEFAULT_THEME_COLOR;
      localStorage.setItem(PALETTE_MIGRATION_KEY, PALETTE_VERSION);
    }
    this.theme.set({
      mode: saved.mode === 'dark' ? 'dark' : 'light',
      color,
      direction: saved.direction === 'rtl' ? 'rtl' : 'ltr',
    });
  }

  private setConfig() {
    this.setLocalStorage();
    this.setThemeClass();
    this.setRTL();
  }

  public get isDark(): boolean {
    return this.theme().mode == 'dark';
  }

  private setThemeClass() {
    document.querySelector('html')!.className = this.theme().mode;
    document.querySelector('html')!.setAttribute('data-theme', this.theme().color);
  }

  private setLocalStorage() {
    localStorage.setItem('theme', JSON.stringify(this.theme()));
  }

  private setRTL() {
    document.querySelector('html')!.setAttribute('dir', this.theme().direction);
    this.setLocalStorage();
  }
}
