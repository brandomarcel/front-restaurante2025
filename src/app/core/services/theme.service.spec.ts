import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService: paleta de marca', () => {
  let stored: (string | null)[], attributes: (string | null)[];
  beforeEach(() => {
    stored = ['theme', 'theme_palette'].map((key) => localStorage.getItem(key));
    attributes = ['class', 'data-theme', 'dir'].map((key) => document.documentElement.getAttribute(key));
    localStorage.removeItem('theme');
    localStorage.removeItem('theme_palette');
    TestBed.configureTestingModule({ providers: [ThemeService] });
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    ['theme', 'theme_palette'].forEach((key, i) =>
      stored[i] === null ? localStorage.removeItem(key) : localStorage.setItem(key, stored[i]!),
    );
    ['class', 'data-theme', 'dir'].forEach((key, i) =>
      attributes[i] === null
        ? document.documentElement.removeAttribute(key)
        : document.documentElement.setAttribute(key, attributes[i]!),
    );
  });
  it('usa FacturADA sin preferencias previas', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();
    expect(service.theme().color).toBe('facturada');
    expect(document.documentElement.getAttribute('data-theme')).toBe('facturada');
  });
  it('migra violet una vez preservando modo oscuro y dirección', () => {
    localStorage.setItem('theme', JSON.stringify({ color: 'violet', mode: 'dark', direction: 'rtl' }));
    const service = TestBed.inject(ThemeService);
    TestBed.flushEffects();
    expect(service.theme()).toEqual({ color: 'facturada', mode: 'dark', direction: 'rtl' });
    expect(localStorage.getItem('theme_palette')).toBe('facturada-2026-11');
    expect(document.documentElement.classList.contains('dark')).toBeTrue();
    expect(document.documentElement.dir).toBe('rtl');
  });
  it('respeta una paleta elegida después de la migración', () => {
    localStorage.setItem('theme_palette', 'facturada-2026-11');
    localStorage.setItem('theme', JSON.stringify({ color: 'violet', mode: 'light', direction: 'ltr' }));
    expect(TestBed.inject(ThemeService).theme().color).toBe('violet');
  });
  it('tolera preferencias con JSON dañado', () => {
    localStorage.setItem('theme', 'invalid-json');
    expect(() => TestBed.inject(ThemeService)).not.toThrow();
    TestBed.flushEffects();
    expect(document.documentElement.getAttribute('data-theme')).toBe('facturada');
  });
});
