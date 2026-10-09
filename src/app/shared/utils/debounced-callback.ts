import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime } from 'rxjs';

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Devuelve un disparador que ejecuta `callback` cuando deja de llamarse durante
 * `ms` milisegundos. Se usa para no consultar al backend en cada tecla.
 */
export function debouncedCallback(destroyRef: DestroyRef, callback: () => void, ms = SEARCH_DEBOUNCE_MS): () => void {
  const trigger = new Subject<void>();
  trigger.pipe(debounceTime(ms), takeUntilDestroyed(destroyRef)).subscribe(() => callback());
  return () => trigger.next();
}
