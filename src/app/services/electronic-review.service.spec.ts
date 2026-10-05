import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ElectronicReviewService } from './electronic-review.service';
import { environment } from 'src/environments/environment';

describe('Electronic review RPC contract', () => {
  let service: ElectronicReviewService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ElectronicReviewService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('sends verified_no_sri_record only for explicit invoice verification', () => {
    service.confirm('FLINV-1', 'Revisado por clave', 'FBU-1', false, true).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/method/facturada_lite.api.frontend.confirm_lite_invoice_electronic_review`);
    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBeTrue();
    expect(request.request.body).toEqual({ business: 'FBU-1', invoice_name: 'FLINV-1', review_reason: 'Revisado por clave', verified_no_sri_record: 1 });
    request.flush({ message: { data: { name: 'FLINV-1' } } });
  });
  it('uses ordinary review for guides without invoice regeneration fields', () => {
    service.confirm('FLRG-1', 'Revisado', 'FBU-1', true, true).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/method/facturada_lite.api.frontend.confirm_lite_remission_guide_electronic_review`);
    expect(request.request.body).toEqual({ business: 'FBU-1', guide_name: 'FLRG-1', review_reason: 'Revisado' });
    request.flush({ message: { data: { name: 'FLRG-1' } } });
  });
});
