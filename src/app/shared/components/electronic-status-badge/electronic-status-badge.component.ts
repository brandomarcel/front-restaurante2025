import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { ElectronicStatusTone, ElectronicStatusView, electronicStatusView } from 'src/app/core/utils/electronic-document';

const TONE_CLASSES: Record<ElectronicStatusTone, string> = {
  success: 'badge-green',
  danger: 'badge-red',
  warning: 'badge-yellow',
  neutral: 'badge-gray'
};

/** Badge del estado general de un comprobante electrónico (factura, nota de crédito o guía). */
@Component({
  selector: 'app-electronic-status-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span class="badge whitespace-nowrap" [ngClass]="toneClass" [attr.title]="'Estado: ' + view.label">
      <span class="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true"></span>
      {{ view.label }}
    </span>
  `
})
export class ElectronicStatusBadgeComponent {
  @Input() document: any;
  /** Fuerza el modo de lectura; por defecto se usa la modalidad del negocio activo. */
  @Input() liteMode?: boolean;

  constructor(private capabilities: CompanyCapabilitiesService) {}

  get view(): ElectronicStatusView {
    return electronicStatusView(this.document, this.liteMode ?? this.capabilities.isLiteMode);
  }

  get toneClass(): string {
    return TONE_CLASSES[this.view.tone];
  }
}
