// src/app/shared/services/alert.service.ts
import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertResult } from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class AlertService {

  infoHtml(mensaje: string, titulo: string = 'Información'): Promise<SweetAlertResult> {
    return Swal.fire({
      title: `<strong>${titulo}</strong>`,
      icon: 'info',
      html: mensaje,
      showCloseButton: true,
      showCancelButton: true,
      focusConfirm: false,
      confirmButtonText: `
        <i class="fa fa-thumbs-up"></i> Entendido
      `,
      confirmButtonAriaLabel: 'Confirmar',
      cancelButtonText: `
        <i class="fa fa-thumbs-down"></i>
      `,
      cancelButtonAriaLabel: 'Cancelar'
    });
  }

  simple(title: string, text: string, icon: SweetAlertIcon = 'info'): Promise<SweetAlertResult> {
    return Swal.fire({ title, text, icon });
  }

  success(message: string): void {
    Swal.fire('Éxito', message, 'success');
  }

  error(message: string): void {
    Swal.fire('Error', message, 'error');
  }

  confirm(message: string, title = '¿Estás seguro?'): Promise<SweetAlertResult> {
    return Swal.fire({
      title,
      text: message,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí',
      cancelButtonText: 'Cancelar'
    });
  }
}
