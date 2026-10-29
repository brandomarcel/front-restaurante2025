import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { REQUIRE_AUTH } from 'src/app/core/interceptor/auth-context';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-company-migration', standalone: true, imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './company-migration.component.html'
})
export class CompanyMigrationComponent implements OnInit, OnDestroy {
  context: any;
  preview: any;
  result: any;
  error = '';
  busy = false;
  warehouse = '';
  file: File | null = null;
  private subscriptions = new Subscription();
  private business = '';
  private base = `${environment.apiUrl}/method/facturada_lite.migration.service.`;
  private auth = new HttpContext().set(REQUIRE_AUTH, true);
  labels: Record<string, string> = {
    customers: 'Clientes', categories: 'Categorías', products: 'Productos', tables: 'Mesas',
    orders: 'Órdenes', splits: 'Subcuentas', openings: 'Aperturas de caja', closings: 'Cierres de caja',
    withdrawals: 'Retiros', invoices: 'Facturas', credit_notes: 'Notas de crédito',
    stock_history: 'Movimientos anteriores (archivo)', taxes: 'Impuestos', payment_methods: 'Formas de pago'
  };

  constructor(private http: HttpClient, private capabilities: CompanyCapabilitiesService) {}

  ngOnInit(): void {
    this.business = this.capabilities.activeBusinessId || '';
    this.load();
  }
  ngOnDestroy(): void { this.subscriptions.unsubscribe(); }
  get counts(): Array<{key: string; count: number}> {
    return Object.entries(this.preview?.counts || {}).map(([key, count]) => ({key, count: Number(count)}));
  }
  get sameBusiness(): boolean { return this.business === this.capabilities.activeBusinessId; }
  sourceUrl(name: string): string {
    return this.base + 'download_source?business=' + encodeURIComponent(this.business) + '&name=' + encodeURIComponent(name);
  }
  load(): void {
    if (!this.business) { this.error = 'Selecciona una empresa antes de importar.'; return; }
    this.subscriptions.add(this.http.get<any>(this.base + 'get_context', {
      params: new HttpParams().set('business', this.business), context: this.auth
    }).subscribe({ next: res => this.context = res.message, error: err => this.showError(err) }));
  }
  choose(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] || null;
    this.resetPreview();
  }
  resetPreview(): void { this.preview = null; this.result = null; this.error = ''; }
  inspect(): void {
    if (!this.file || this.busy || !this.sameBusiness) return;
    if (!this.file.name.toLowerCase().endsWith('.zip') || this.file.size > 50 * 1024 * 1024) {
      this.error = 'Selecciona un ZIP de hasta 50 MB.'; return;
    }
    this.busy = true; this.resetPreview();
    const data = new FormData();
    data.append('business', this.business); data.append('warehouse', this.warehouse); data.append('file', this.file);
    this.subscriptions.add(this.http.post<any>(this.base + 'preview', data, { context: this.auth }).pipe(finalize(() => this.busy = false))
      .subscribe({ next: res => this.preview = res.message, error: err => this.showError(err) }));
  }
  import(): void {
    if (!this.preview?.can_import || this.busy || !this.sameBusiness || this.result) return;
    this.busy = true; this.error = '';
    this.subscriptions.add(this.http.post<any>(this.base + 'confirm', { business: this.business, name: this.preview.name }, { context: this.auth })
      .pipe(finalize(() => this.busy = false)).subscribe({ next: res => { this.result = res.message; this.load(); }, error: err => this.showError(err) }));
  }
  private showError(error: any): void {
    this.error = error?.status === 403 ? 'No tienes permiso para importar en esta empresa.'
      : String(error?.error?.exception || error?.message || 'No se pudo completar la transferencia.').replace(/<[^>]*>/g, '').slice(0, 1000);
  }
}
