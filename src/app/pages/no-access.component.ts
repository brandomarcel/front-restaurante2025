import { Component } from '@angular/core';

@Component({
  selector: 'app-no-access',
  standalone: true,
  template: `
    <section class="mx-auto mt-10 max-w-xl rounded-lg border bg-white p-8 text-center shadow-sm">
      <h1 class="text-xl font-semibold text-slate-800">No tienes módulos disponibles</h1>
      <p class="mt-2 text-sm text-slate-500">
        Tu rol no tiene acceso a módulos habilitados para el modo de operación de esta empresa.
      </p>
    </section>
  `
})
export class NoAccessComponent {}
