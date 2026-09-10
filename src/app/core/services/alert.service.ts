// src/app/shared/services/alert.service.ts
import { Injectable } from '@angular/core';
import Swal, { SweetAlertIcon, SweetAlertResult } from 'sweetalert2';

@Injectable({ providedIn: 'root' })
export class AlertService {

  private readonly customClass = {
    popup: 'facturada-swal-popup',
    title: 'facturada-swal-title',
    htmlContainer: 'facturada-swal-content',
    icon: 'facturada-swal-icon',
    actions: 'facturada-swal-actions',
    confirmButton: 'facturada-swal-confirm',
    cancelButton: 'facturada-swal-cancel',
    closeButton: 'facturada-swal-close'
  };

  private baseOptions() {
    return {
      customClass: this.customClass,
      buttonsStyling: false,
      heightAuto: false,
      backdrop: 'rgba(15, 23, 42, 0.48)',
      showClass: {
        popup: 'swal2-show facturada-swal-enter'
      },
      hideClass: {
        popup: 'swal2-hide facturada-swal-leave'
      }
    };
  }

  infoHtml(mensaje: string, titulo: string = 'Información'): Promise<SweetAlertResult> {
    return Swal.fire({
      ...this.baseOptions(),
      title: `<strong>${titulo}</strong>`,
      icon: 'info',
      html: mensaje,
      showCloseButton: true,
      showCancelButton: false,
      focusConfirm: false,
      confirmButtonText: 'Entendido',
      confirmButtonAriaLabel: 'Confirmar',
      cancelButtonAriaLabel: 'Cancelar'
    });
  }

  simple(title: string, text: string, icon: SweetAlertIcon = 'info'): Promise<SweetAlertResult> {
    return Swal.fire({
      ...this.baseOptions(),
      title,
      text,
      icon,
      confirmButtonText: 'Entendido'
    });
  }

  success(message: string): void {
    void Swal.fire({
      ...this.baseOptions(),
      title: 'Éxito',
      text: message,
      icon: 'success',
      confirmButtonText: 'Continuar'
    });
  }

  error(message: string): void {
    void Swal.fire({
      ...this.baseOptions(),
      title: 'Ocurrió un problema',
      text: message,
      icon: 'error',
      confirmButtonText: 'Entendido'
    });
  }

  confirm(message: string, title = '¿Estás seguro?' , icon: 'warning' | 'success' | 'error' = 'warning'): Promise<SweetAlertResult> {
    return Swal.fire({
      ...this.baseOptions(),
      title,
      text: message,
      icon: icon,
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar'
    });
  }
}
