import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { PublicMenu, PublicMenuService } from 'src/app/services/public-menu.service';

/**
 * Carta que ve el cliente al escanear el QR del negocio (`/menu/:token`). Sin sesión ni
 * menú lateral: fotos una debajo de otra (se amplían con los dedos o tocándolas) o un
 * botón para abrir el PDF en el visor del teléfono, que es lo que mejor funciona en móvil.
 */
@Component({
  selector: 'app-public-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './public-menu.component.html',
})
export class PublicMenuComponent implements OnInit {
  menu: PublicMenu | null = null;
  loading = true;
  unavailable = false;

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
}
