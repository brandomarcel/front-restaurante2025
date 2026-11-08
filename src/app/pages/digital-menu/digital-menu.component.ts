import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { toast } from 'ngx-sonner';
import { finalize } from 'rxjs/operators';
import { AlertService } from 'src/app/core/services/alert.service';
import { PublicMenuFile, PublicMenuService, PublicMenuSettings } from 'src/app/services/public-menu.service';

/**
 * Carta digital por QR (restaurante, Administrador/Gerente): el negocio sube fotos o un PDF de
 * su carta, la publica y descarga o imprime el QR. El enlace no cambia al cambiar los archivos,
 * así que los QR impresos siguen sirviendo; solo «Cambiar enlace» los invalida.
 */
@Component({
  selector: 'app-digital-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './digital-menu.component.html',
})
export class DigitalMenuComponent implements OnInit {
  settings: PublicMenuSettings | null = null;
  loading = true;
  loadError = '';
  uploading = '';
  busy = false;
  message = '';
  qrPng = '';

  readonly maxImageMb = 8;
  readonly maxPdfMb = 10;

  constructor(private menus: PublicMenuService, private alerts: AlertService) {}

  ngOnInit(): void {
    this.menus.getSettings().pipe(finalize(() => (this.loading = false))).subscribe({
      next: (settings) => this.apply(settings),
      error: (error) => (this.loadError = this.errorText(error, 'No se pudo cargar la carta digital.')),
    });
  }

  get publicUrl(): string {
    return this.settings ? this.menus.publicUrl(this.settings) : '';
  }

  get isPublished(): boolean {
    return !!this.settings?.enabled;
  }

  get images(): PublicMenuFile[] {
    return (this.settings?.files || []).filter((file) => file.kind === 'Imagen');
  }

  get pdf(): PublicMenuFile | null {
    return (this.settings?.files || []).find((file) => file.kind === 'PDF') || null;
  }

  get hasFiles(): boolean {
    return !!this.settings?.files?.length;
  }

  get canAddImages(): boolean {
    return this.images.length < (this.settings?.max_images || 20);
  }

  get messageChanged(): boolean {
    return (this.message || '').trim() !== (this.settings?.message || '').trim();
  }

  fileUrl(path: string): string {
    return this.menus.fileUrl(path);
  }

  sizeLabel(bytes: number): string {
    return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  // ---------- Archivos ----------
  async onImagesPicked(input: HTMLInputElement): Promise<void> {
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length || this.uploading) return;
    let replace = false;
    if (this.pdf) {
      const answer = await this.alerts.confirm('Tu carta ahora es un PDF. Al subir fotos, el PDF se quita.', 'Cambiar a fotos');
      if (!answer.isConfirmed) return;
      replace = true;
    }
    const room = (this.settings?.max_images || 20) - (replace ? 0 : this.images.length);
    if (files.length > room) toast.warning(`Solo caben ${room} fotos más; se suben las primeras.`);
    // Una por una, en el orden elegido: cada respuesta trae la carta actualizada.
    for (const [index, file] of files.slice(0, Math.max(0, room)).entries()) {
      if (!(await this.uploadOne(file, replace && index === 0, `Subiendo foto ${index + 1} de ${Math.min(files.length, room)}…`))) break;
    }
  }

  async onPdfPicked(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.uploading) return;
    if (this.hasFiles) {
      const answer = await this.alerts.confirm('El PDF reemplaza la carta actual (fotos o PDF anterior).', 'Subir PDF');
      if (!answer.isConfirmed) return;
    }
    await this.uploadOne(file, true, 'Subiendo PDF…');
  }

  private uploadOne(file: File, replace: boolean, label: string): Promise<boolean> {
    const limit = (file.type === 'application/pdf' || /\.pdf$/i.test(file.name) ? this.maxPdfMb : this.maxImageMb) * 1024 * 1024;
    if (file.size > limit) {
      toast.error(`${file.name} pesa ${this.sizeLabel(file.size)}; el máximo es ${this.sizeLabel(limit)}.`);
      return Promise.resolve(false);
    }
    this.uploading = label;
    return new Promise((resolve) => {
      this.menus.upload(file, replace).pipe(finalize(() => (this.uploading = ''))).subscribe({
        next: (settings) => { this.apply(settings); resolve(true); },
        error: (error) => { toast.error(this.errorText(error, `No se pudo subir ${file.name}.`)); resolve(false); },
      });
    });
  }

  move(file: PublicMenuFile, direction: 'up' | 'down'): void {
    if (this.busy) return;
    this.busy = true;
    this.menus.move(file.name, direction).pipe(finalize(() => (this.busy = false))).subscribe({
      next: (settings) => this.apply(settings),
      error: (error) => toast.error(this.errorText(error, 'No se pudo cambiar el orden.')),
    });
  }

  async remove(file: PublicMenuFile): Promise<void> {
    if (this.busy) return;
    const last = (this.settings?.files.length || 0) <= 1;
    const answer = await this.alerts.confirm(
      last && this.isPublished ? 'Es el último archivo: la carta dejará de mostrarse a los clientes.' : `Se quitará ${file.kind === 'PDF' ? 'el PDF' : 'esta foto'} de la carta.`,
      'Quitar de la carta'
    );
    if (!answer.isConfirmed) return;
    this.busy = true;
    this.menus.remove(file.name).pipe(finalize(() => (this.busy = false))).subscribe({
      next: (settings) => this.apply(settings),
      error: (error) => toast.error(this.errorText(error, 'No se pudo quitar el archivo.')),
    });
  }

  // ---------- Publicación ----------
  togglePublished(): void {
    if (this.busy || !this.settings) return;
    if (!this.isPublished && !this.hasFiles) {
      toast.error('Sube al menos una foto o un PDF antes de publicar.');
      return;
    }
    this.busy = true;
    const enabled = !this.isPublished;
    this.menus.save({ enabled }).pipe(finalize(() => (this.busy = false))).subscribe({
      next: (settings) => {
        this.apply(settings);
        toast.success(enabled ? 'Carta publicada: el QR ya funciona.' : 'Carta retirada: el QR muestra «no disponible».');
      },
      error: (error) => toast.error(this.errorText(error, 'No se pudo cambiar la publicación.')),
    });
  }

  saveMessage(): void {
    if (this.busy || !this.messageChanged) return;
    this.busy = true;
    this.menus.save({ message: this.message.trim() }).pipe(finalize(() => (this.busy = false))).subscribe({
      next: (settings) => { this.apply(settings); toast.success('Mensaje guardado.'); },
      error: (error) => toast.error(this.errorText(error, 'No se pudo guardar el mensaje.')),
    });
  }

  async copyLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.publicUrl);
      toast.success('Enlace copiado.');
    } catch {
      toast.error('No se pudo copiar. Selecciona el enlace y cópialo a mano.');
    }
  }

  async regenerateLink(): Promise<void> {
    if (this.busy) return;
    const answer = await this.alerts.confirm(
      'Los QR y enlaces que ya compartiste o imprimiste dejarán de funcionar. Úsalo solo si el enlace se filtró o quieres empezar de cero.',
      'Cambiar enlace'
    );
    if (!answer.isConfirmed) return;
    this.busy = true;
    this.menus.regenerateLink().pipe(finalize(() => (this.busy = false))).subscribe({
      next: (settings) => { this.apply(settings); toast.success('Enlace nuevo listo. Descarga e imprime el QR otra vez.'); },
      error: (error) => toast.error(this.errorText(error, 'No se pudo cambiar el enlace.')),
    });
  }

  get qrFileName(): string {
    const name = (this.settings?.business_name || 'carta').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    return `qr-carta-${name}.png`;
  }

  /** Tarjeta para la mesa: logo, nombre, QR y la instrucción. Se imprime desde una ventana aparte. */
  printCard(): void {
    if (!this.qrPng || !this.settings) return;
    const win = window.open('', '_blank', 'width=480,height=640');
    if (!win) {
      toast.error('El navegador bloqueó la ventana. Permite ventanas emergentes.');
      return;
    }
    const name = this.escape(this.settings.business_name);
    const logo = this.settings.logo ? `<img class="logo" src="${this.escape(this.menus.fileUrl(this.settings.logo))}" alt="">` : '';
    win.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>QR de la carta · ${name}</title>
<style>
  @page { size: A6; margin: 8mm; }
  body { font-family: system-ui, -apple-system, 'Segoe UI', sans-serif; margin: 0; color: #111; }
  .card { text-align: center; padding: 6mm 4mm; }
  .logo { max-height: 22mm; max-width: 50mm; object-fit: contain; }
  h1 { font-size: 18pt; margin: 3mm 0 1mm; }
  p { font-size: 11pt; margin: 0 0 4mm; }
  .qr { width: 62mm; height: 62mm; image-rendering: pixelated; }
  small { display: block; margin-top: 3mm; font-size: 8pt; color: #555; word-break: break-all; }
</style></head><body><div class="card">${logo}<h1>${name}</h1><p>Escanea para ver la carta</p>
<img class="qr" src="${this.qrPng}" alt="QR de la carta"><small>${this.escape(this.publicUrl)}</small></div>
<script>window.onload = function () { window.focus(); window.print(); };</script></body></html>`);
    win.document.close();
  }

  private apply(settings: PublicMenuSettings): void {
    const tokenChanged = settings?.token !== this.settings?.token;
    this.settings = settings;
    this.message = settings?.message || '';
    if (tokenChanged && settings?.token) this.loadQr();
  }

  private loadQr(): void {
    this.qrPng = '';
    this.menus.getQr(this.publicUrl).subscribe({
      next: (png) => (this.qrPng = png),
      error: () => toast.error('No se pudo generar el QR.'),
    });
  }

  private escape(value: string): string {
    return String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));
  }

  private errorText(error: any, fallback: string): string {
    const raw = error?.error?._server_messages;
    if (raw) {
      try {
        return String(JSON.parse(JSON.parse(raw)[0])?.message || fallback).replace(/<[^>]+>/g, '');
      } catch { /* mensaje genérico */ }
    }
    return error?.error?.message && typeof error.error.message === 'string' ? error.error.message : (error?.message || fallback);
  }
}
