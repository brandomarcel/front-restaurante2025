import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { BRAND, brandWhatsappUrl } from 'src/app/core/constants/brand.constants';
import { PublicMenu, PublicMenuService } from 'src/app/services/public-menu.service';

/**
 * Carta que ve el cliente al escanear el QR del negocio (`/menu/:token`). Sin sesión ni
 * menú lateral: fotos una debajo de otra (se amplían con los dedos o tocándolas) o un
 * botón para abrir el PDF en el visor del teléfono, que es lo que mejor funciona en móvil.
 *
 * Tiene su propia paleta (no la del tema del panel) y respeta el modo oscuro del teléfono.
 * Al final, un bloque de FacturADA para que otros negocios nos conozcan.
 */
@Component({
  selector: 'app-public-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-menu.component.html',
  styleUrls: ['./public-menu.component.css'],
})
export class PublicMenuComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly brand = BRAND;

  menu: PublicMenu | null = null;
  loading = true;
  unavailable = false;
  /** Página visible (índice), para resaltar el número en la barra de páginas. */
  activePage = 0;
  shareFeedback = '';

  @ViewChild('scroller') private scroller?: ElementRef<HTMLElement>;
  @ViewChildren('page') private pages?: QueryList<ElementRef<HTMLElement>>;
  private observer?: IntersectionObserver;
  private pagesSub?: Subscription;
  private feedbackTimer?: ReturnType<typeof setTimeout>;

  constructor(private route: ActivatedRoute, private menus: PublicMenuService, private title: Title) {}

  ngOnInit(): void {
    const token = String(this.route.snapshot.paramMap.get('token') || '').trim();
    if (!token) {
      this.loading = false;
      this.unavailable = true;
      return;
    }
    this.menus.getPublic(token).subscribe({
      next: (menu) => {
        this.menu = menu || null;
        this.unavailable = !menu?.files?.length;
        this.loading = false;
        if (menu?.business_name) this.title.setTitle(`Carta · ${menu.business_name}`);
      },
      error: () => {
        this.loading = false;
        this.unavailable = true;
      },
    });
  }

  ngAfterViewInit(): void {
    this.pagesSub = this.pages?.changes.subscribe(() => this.observePages());
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.pagesSub?.unsubscribe();
    clearTimeout(this.feedbackTimer);
  }

  get pdfUrl(): string {
    const pdf = this.menu?.files?.find((file) => file.kind === 'PDF');
    return pdf ? this.menus.fileUrl(pdf.url) : '';
  }

  get images(): string[] {
    return (this.menu?.files || []).filter((file) => file.kind === 'Imagen').map((file) => this.menus.fileUrl(file.url));
  }

  get logoUrl(): string {
    return this.menus.fileUrl(this.menu?.logo);
  }

  get initials(): string {
    const words = String(this.menu?.business_name || '').trim().split(/\s+/).filter(Boolean);
    return words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || '·';
  }

  get whatsappUrl(): string {
    // Dice desde qué carta llegó el contacto; la oferta es para cualquier tipo de negocio.
    const from = this.menu?.business_name ? ` en la carta de ${this.menu.business_name}` : '';
    return brandWhatsappUrl(`Hola, vi ${BRAND.product}${from} y quiero información para mi negocio.`);
  }

  goToPage(index: number): void {
    this.pages?.get(index)?.nativeElement.scrollIntoView({ behavior: this.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  async share(): Promise<void> {
    const url = window.location.href;
    const title = this.menu?.business_name ? `Carta de ${this.menu.business_name}` : 'Carta digital';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      this.flash('Enlace copiado');
    } catch (error) {
      // Cancelar el menú de compartir no es un error que mostrar.
      if ((error as DOMException)?.name !== 'AbortError') this.flash('No se pudo compartir');
    }
  }

  private flash(message: string): void {
    this.shareFeedback = message;
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = setTimeout(() => (this.shareFeedback = ''), 2200);
  }

  private observePages(): void {
    this.observer?.disconnect();
    const elements = this.pages?.map((ref) => ref.nativeElement) || [];
    if (elements.length < 2 || typeof IntersectionObserver === 'undefined') return;
    this.observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) this.activePage = elements.indexOf(visible.target as HTMLElement);
      },
      { root: this.scroller?.nativeElement || null, threshold: [0.25, 0.5, 0.75] },
    );
    elements.forEach((element) => this.observer!.observe(element));
  }

  private prefersReducedMotion(): boolean {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
