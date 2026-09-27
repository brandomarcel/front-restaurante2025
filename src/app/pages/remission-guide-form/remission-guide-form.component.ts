import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { NgxSpinnerComponent, NgxSpinnerService } from 'ngx-spinner';
import { toast } from 'ngx-sonner';
import { finalize } from 'rxjs';
import { CompanyCapabilitiesService } from 'src/app/core/services/company-capabilities.service';
import { RemissionGuidesService } from 'src/app/services/remission-guides.service';
import { liteEmissionMessages } from 'src/app/core/utils/lite-invoice-emission';

/** Códigos de identificación SRI usados en transportista/destinatario. */
const IDENTIFICATION_TYPES = [
  { value: '04', label: 'RUC' },
  { value: '05', label: 'Cédula' },
  { value: '06', label: 'Pasaporte' },
  { value: '08', label: 'Identificación del exterior' }
];

const MOTIVOS_TRASLADO = ['Venta', 'Traslado por cambio de establecimiento', 'Exportación', 'Devolución', 'Otros'];

/** Cédula (05) exige 10 dígitos numéricos y RUC (04) 13; Pasaporte/exterior (06/08) no tienen formato fijo. */
function transportistaIdentificationValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value || '').trim();
    if (!value) return null;
    const tipo = String(control.parent?.get('tipoIdentificacionTransportista')?.value || '').trim();
    if (tipo === '05' && !/^\d{10}$/.test(value)) return { cedulaInvalida: true };
    if (tipo === '04' && !/^\d{13}$/.test(value)) return { rucInvalido: true };
    return null;
  };
}

/** El destinatario no tiene un selector de tipo de identificación: solo se valida el largo cuando es puramente numérico (cédula/RUC). */
function identificacionDestinatarioValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value || '').trim();
    if (!value) return null;
    if (/^\d+$/.test(value) && value.length !== 10 && value.length !== 13) {
      return { identificacionInvalida: true };
    }
    return null;
  };
}

function plateValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value || '').trim().toUpperCase();
    if (!value) return null;
    return /^[A-Z]{2,3}-?\d{3,4}$/.test(value) ? null : { placaInvalida: true };
  };
}

function docSustentoNumberValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = String(control.value || '').trim();
    if (!value) return null;
    return /^\d{3}-\d{3}-\d{9}$/.test(value) ? null : { formatoInvalido: true };
  };
}

/** El fin del transporte nunca puede ser anterior a su inicio. */
function transportDateRangeValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = group.get('fechaIniTransporte')?.value;
    const end = group.get('fechaFinTransporte')?.value;
    if (!start || !end) return null;
    return new Date(end) >= new Date(start) ? null : { rangoFechaInvalido: true };
  };
}

/** El documento sustento es un solo dato: si se llena uno de los tres campos, deben llenarse los tres. */
function docSustentoGroupValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const cod = String(group.get('codDocSustento')?.value || '').trim();
    const num = String(group.get('numDocSustento')?.value || '').trim();
    const fecha = String(group.get('fechaEmisionDocSustento')?.value || '').trim();
    const anyFilled = !!(cod || num || fecha);
    const allFilled = !!(cod && num && fecha);
    return anyFilled && !allFilled ? { docSustentoIncompleto: true } : null;
  };
}

@Component({
  selector: 'app-remission-guide-form',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, NgxSpinnerComponent],
  templateUrl: './remission-guide-form.component.html'
})
export class RemissionGuideFormComponent implements OnInit {
  identificationTypes = IDENTIFICATION_TYPES;
  motivosTraslado = MOTIVOS_TRASLADO;

  form: FormGroup;
  guideName = '';
  submitting = false;
  submitted = false;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private svc: RemissionGuidesService,
    private spinner: NgxSpinnerService,
    public capabilities: CompanyCapabilitiesService
  ) {
    this.form = this.fb.group({
      establishment: ['', Validators.required],
      emission_point: ['', Validators.required],
      environment: [this.defaultEnvironment(), Validators.required],
      dirEstablecimiento: ['', Validators.required],
      dirPartida: ['', Validators.required],
      razonSocialTransportista: ['', Validators.required],
      tipoIdentificacionTransportista: ['04', Validators.required],
      rucTransportista: ['', [Validators.required, transportistaIdentificationValidator()]],
      fechaIniTransporte: ['', Validators.required],
      fechaFinTransporte: ['', Validators.required],
      placa: ['', [Validators.required, plateValidator()]],
      destinatarios: this.fb.array([this.createDestinatario()])
    }, { validators: transportDateRangeValidator() });

    // El formato válido de la identificación del transportista depende del
    // tipo elegido (10 dígitos para cédula, 13 para RUC): al cambiar el tipo
    // hay que re-evaluar el campo, no solo cuando el usuario lo edita.
    this.form.get('tipoIdentificacionTransportista')?.valueChanges.subscribe(() => {
      this.form.get('rucTransportista')?.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    this.guideName = this.route.snapshot.paramMap.get('id') || '';
    if (this.guideName) this.loadExisting(this.guideName);
    else if (this.form.value.establishment === '' && this.establishmentOptions.length === 1) {
      this.form.patchValue({ establishment: this.recordId(this.establishmentOptions[0]) });
    }
  }

  get isEditMode(): boolean { return !!this.guideName; }

  get establishmentOptions(): any[] {
    return this.capabilities.activeEstablishments;
  }

  get emissionPointOptions(): any[] {
    const establishment = this.form?.get('establishment')?.value;
    return establishment ? this.capabilities.activeEmissionPointsFor(establishment) : [];
  }

  /**
   * La Guía de Remisión tiene su propio consecutivo SRI (código 06),
   * independiente del de Factura (01) o Nota de Crédito (04) aunque
   * compartan establecimiento y punto de emisión. Sin una secuencia activa
   * para esta combinación, "Guardar y emitir" fallaría en el backend; se
   * avisa antes en vez de dejar que el usuario descubra el error al emitir.
   */
  get hasActiveSequence(): boolean {
    const value = this.form?.getRawValue();
    if (!value?.establishment || !value?.emission_point) return false;
    return this.capabilities.hasActiveSequence('Guia de Remision', value.establishment, value.emission_point, value.environment);
  }

  get destinatarios(): FormArray {
    return this.form.get('destinatarios') as FormArray;
  }

  /**
   * Resumen de errores para el submit: con varios destinatarios/detalles el
   * texto de error bajo cada campo puede no notarse. Esto arma una lista
   * explícita ("Destinatario 2, Detalle 1: ...") para que el usuario ubique
   * exactamente qué falta sin tener que revisar campo por campo.
   */
  get validationSummary(): string[] {
    if (!this.submitted) return [];
    const errors: string[] = [];

    if (this.form.get('establishment')?.invalid) errors.push('Selecciona un establecimiento.');
    if (this.form.get('emission_point')?.invalid) errors.push('Selecciona un punto de emisión.');
    if (this.form.get('dirEstablecimiento')?.invalid) errors.push('Dirección del establecimiento requerida.');
    if (this.form.get('dirPartida')?.invalid) errors.push('Dirección de partida requerida.');
    if (this.form.get('razonSocialTransportista')?.invalid) errors.push('Razón social del transportista requerida.');
    const rucErrors = this.form.get('rucTransportista')?.errors;
    if (rucErrors?.['required']) errors.push('Identificación del transportista requerida.');
    else if (rucErrors?.['cedulaInvalida']) errors.push('La cédula del transportista debe tener 10 dígitos.');
    else if (rucErrors?.['rucInvalido']) errors.push('El RUC del transportista debe tener 13 dígitos.');
    const placaErrors = this.form.get('placa')?.errors;
    if (placaErrors?.['required']) errors.push('Placa requerida.');
    else if (placaErrors?.['placaInvalida']) errors.push('Formato de placa inválido.');
    if (this.form.get('fechaIniTransporte')?.invalid) errors.push('Fecha de inicio de transporte requerida.');
    if (this.form.get('fechaFinTransporte')?.invalid) errors.push('Fecha de fin de transporte requerida.');
    if (this.form.errors?.['rangoFechaInvalido']) errors.push('La fecha de fin de transporte no puede ser anterior a la de inicio.');

    if (!this.destinatarios.length) errors.push('Agrega al menos un destinatario.');
    this.destinatarios.controls.forEach((destinatario, di) => {
      const label = `Destinatario ${di + 1}`;
      if (destinatario.get('identificacionDestinatario')?.errors?.['required']) errors.push(`${label}: identificación requerida.`);
      else if (destinatario.get('identificacionDestinatario')?.errors?.['identificacionInvalida']) errors.push(`${label}: identificación debe tener 10 o 13 dígitos.`);
      if (destinatario.get('razonSocialDestinatario')?.invalid) errors.push(`${label}: razón social requerida.`);
      if (destinatario.get('dirDestinatario')?.invalid) errors.push(`${label}: dirección de destino requerida.`);
      if (destinatario.get('motivoTraslado')?.invalid) errors.push(`${label}: motivo de traslado requerido.`);
      if (destinatario.get('numDocSustento')?.errors?.['formatoInvalido']) errors.push(`${label}: formato de documento sustento inválido.`);
      if ((destinatario as FormGroup).errors?.['docSustentoIncompleto']) errors.push(`${label}: completa código, número y fecha del documento sustento, o déjalos todos vacíos.`);

      const detalles = destinatario.get('detalles') as FormArray;
      if (!detalles?.length) {
        errors.push(`${label}: agrega al menos un detalle.`);
        return;
      }
      detalles.controls.forEach((detalle, ki) => {
        const detalleLabel = `${label}, Detalle ${ki + 1}`;
        if (detalle.get('codigoInterno')?.invalid) errors.push(`${detalleLabel}: código requerido.`);
        if (detalle.get('descripcion')?.invalid) errors.push(`${detalleLabel}: descripción requerida.`);
        if (detalle.get('cantidad')?.invalid) errors.push(`${detalleLabel}: cantidad debe ser numérica y mayor que cero.`);
        if (detalle.get('unidadMedida')?.invalid) errors.push(`${detalleLabel}: unidad de medida requerida.`);
      });
    });

    return errors;
  }

  detalles(destinatarioIndex: number): FormArray {
    return this.destinatarios.at(destinatarioIndex).get('detalles') as FormArray;
  }

  createDestinatario(): FormGroup {
    return this.fb.group({
      identificacionDestinatario: ['', [Validators.required, identificacionDestinatarioValidator()]],
      razonSocialDestinatario: ['', Validators.required],
      dirDestinatario: ['', Validators.required],
      motivoTraslado: ['Venta', Validators.required],
      codDocSustento: [''],
      numDocSustento: ['', docSustentoNumberValidator()],
      fechaEmisionDocSustento: [''],
      detalles: this.fb.array([this.createDetalle()])
    }, { validators: docSustentoGroupValidator() });
  }

  createDetalle(): FormGroup {
    return this.fb.group({
      codigoInterno: ['', Validators.required],
      descripcion: ['', Validators.required],
      cantidad: [1, [Validators.required, Validators.min(0.01)]],
      unidadMedida: ['Unidad', Validators.required]
    });
  }

  addDestinatario(): void {
    this.destinatarios.push(this.createDestinatario());
  }

  removeDestinatario(index: number): void {
    if (this.destinatarios.length <= 1) return;
    this.destinatarios.removeAt(index);
  }

  addDetalle(destinatarioIndex: number): void {
    this.detalles(destinatarioIndex).push(this.createDetalle());
  }

  removeDetalle(destinatarioIndex: number, detalleIndex: number): void {
    const detalles = this.detalles(destinatarioIndex);
    if (detalles.length <= 1) return;
    detalles.removeAt(detalleIndex);
  }

  onEstablishmentChange(): void {
    this.form.patchValue({ emission_point: '' });
  }

  private loadExisting(name: string): void {
    this.spinner.show();
    this.svc.getDetail(name).pipe(finalize(() => this.spinner.hide())).subscribe({
      next: (guide: any) => {
        if (String(guide?.status || '').trim().toUpperCase() !== 'BORRADOR') {
          toast.error('Solo se pueden editar guías en estado Borrador.');
          this.router.navigate(['/dashboard/remission-guides', name]);
          return;
        }
        // `get_lite_remission_guide_detail` normaliza a snake_case bajo
        // `transport`/`destinatarios[].*`, distinto del camelCase que se
        // envía al crear (`infoGuiaRemision`, `dirEstablecimiento`, ...): son
        // dos contratos distintos (uno de entrada, otro de salida), no un
        // error de tipeo.
        const info = guide?.transport || {};
        this.form.patchValue({
          establishment: guide?.establishment || '',
          emission_point: guide?.emission_point || '',
          environment: guide?.environment || this.defaultEnvironment(),
          dirEstablecimiento: info?.dir_establecimiento || '',
          dirPartida: info?.dir_partida || '',
          razonSocialTransportista: info?.razon_social_transportista || '',
          tipoIdentificacionTransportista: info?.tipo_identificacion_transportista || '04',
          rucTransportista: info?.ruc_transportista || '',
          fechaIniTransporte: info?.fecha_ini_transporte || '',
          fechaFinTransporte: info?.fecha_fin_transporte || '',
          placa: info?.placa || ''
        });
        const destinatarios = Array.isArray(guide?.destinatarios) ? guide.destinatarios : [];
        if (destinatarios.length) {
          const array = this.fb.array(destinatarios.map((destinatario: any) => {
            const detalles = Array.isArray(destinatario?.detalles) && destinatario.detalles.length
              ? destinatario.detalles.map((detalle: any) => this.fb.group({
                codigoInterno: [detalle?.codigo_interno || detalle?.codigoInterno || '', Validators.required],
                descripcion: [detalle?.descripcion || '', Validators.required],
                cantidad: [Number(detalle?.cantidad ?? 1), [Validators.required, Validators.min(0.01)]],
                unidadMedida: [detalle?.unidad_medida || detalle?.unidadMedida || 'Unidad', Validators.required]
              }))
              : [this.createDetalle()];
            return this.fb.group({
              identificacionDestinatario: [destinatario?.identificacion_destinatario || '', [Validators.required, identificacionDestinatarioValidator()]],
              razonSocialDestinatario: [destinatario?.razon_social_destinatario || '', Validators.required],
              dirDestinatario: [destinatario?.dir_destinatario || '', Validators.required],
              motivoTraslado: [destinatario?.motivo_traslado || 'Venta', Validators.required],
              codDocSustento: [destinatario?.cod_doc_sustento || ''],
              numDocSustento: [destinatario?.num_doc_sustento || '', docSustentoNumberValidator()],
              fechaEmisionDocSustento: [destinatario?.fecha_emision_doc_sustento || ''],
              detalles: this.fb.array(detalles)
            }, { validators: docSustentoGroupValidator() });
          }));
          this.form.setControl('destinatarios', array);
        }
      },
      error: (err) => {
        toast.error(this.readError(err));
        this.router.navigate(['/dashboard/remission-guides']);
      }
    });
  }

  private buildPayload(): any {
    const value = this.form.getRawValue();
    return {
      ...(this.guideName ? { name: this.guideName } : {}),
      establishment: value.establishment,
      emission_point: value.emission_point,
      environment: value.environment,
      version: '1.1.0',
      infoGuiaRemision: {
        dirEstablecimiento: String(value.dirEstablecimiento || '').trim(),
        dirPartida: String(value.dirPartida || '').trim(),
        razonSocialTransportista: String(value.razonSocialTransportista || '').trim(),
        tipoIdentificacionTransportista: value.tipoIdentificacionTransportista,
        rucTransportista: String(value.rucTransportista || '').trim(),
        fechaIniTransporte: value.fechaIniTransporte,
        fechaFinTransporte: value.fechaFinTransporte,
        placa: String(value.placa || '').trim().toUpperCase()
      },
      destinatarios: value.destinatarios.map((destinatario: any) => ({
        identificacionDestinatario: String(destinatario.identificacionDestinatario || '').trim(),
        razonSocialDestinatario: String(destinatario.razonSocialDestinatario || '').trim(),
        dirDestinatario: String(destinatario.dirDestinatario || '').trim(),
        motivoTraslado: destinatario.motivoTraslado,
        ...(destinatario.codDocSustento ? { codDocSustento: String(destinatario.codDocSustento).trim() } : {}),
        ...(destinatario.numDocSustento ? { numDocSustento: String(destinatario.numDocSustento).trim() } : {}),
        ...(destinatario.fechaEmisionDocSustento ? { fechaEmisionDocSustento: destinatario.fechaEmisionDocSustento } : {}),
        detalles: destinatario.detalles.map((detalle: any) => ({
          codigoInterno: String(detalle.codigoInterno || '').trim(),
          descripcion: String(detalle.descripcion || '').trim(),
          cantidad: Number(detalle.cantidad) || 0,
          unidadMedida: String(detalle.unidadMedida || '').trim()
        }))
      }))
    };
  }

  guardarBorrador(): void {
    if (!this.capabilities.hasPermission('billing.create')) {
      toast.error('No tienes permisos para crear guías de remisión.');
      return;
    }
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toast.error('Revisa los campos obligatorios.');
      return;
    }
    this.submitting = true;
    this.spinner.show();
    this.svc.saveDraft(this.buildPayload()).pipe(finalize(() => { this.spinner.hide(); this.submitting = false; })).subscribe({
      next: (data: any) => {
        toast.success('Borrador guardado.');
        const name = String(data?.name || this.guideName || '').trim();
        if (name) this.router.navigate(['/dashboard/remission-guides', name]);
        else this.router.navigate(['/dashboard/remission-guides']);
      },
      error: (err) => toast.error(this.readError(err))
    });
  }

  guardarYEmitir(): void {
    if (!this.capabilities.hasPermission('billing.create')) {
      toast.error('No tienes permisos para emitir guías de remisión.');
      return;
    }
    this.submitted = true;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      toast.error('Revisa los campos obligatorios.');
      return;
    }
    if (!this.hasActiveSequence) {
      toast.error('No existe una secuencia activa de Guía de Remisión para este establecimiento, punto de emisión y ambiente. Configúrala en Secuencias de documentos.');
      return;
    }
    this.submitting = true;
    this.spinner.show();
    const payload = this.buildPayload();

    // Un borrador existente ya tiene sus datos guardados: primero se
    // persisten los cambios y solo entonces se emite (nunca se reintenta
    // automáticamente si la emisión falla).
    const runEmit = (name: string) => {
      this.svc.emitDraft(name).pipe(finalize(() => { this.spinner.hide(); this.submitting = false; })).subscribe({
        next: (res: any) => this.handleEmitResult(res, name),
        error: (err) => toast.error(this.readError(err))
      });
    };

    if (this.isEditMode) {
      this.svc.saveDraft(payload).subscribe({
        next: () => runEmit(this.guideName),
        error: (err) => {
          this.spinner.hide();
          this.submitting = false;
          toast.error(this.readError(err));
        }
      });
    } else {
      this.svc.createAndEmit(payload).pipe(finalize(() => { this.spinner.hide(); this.submitting = false; })).subscribe({
        next: (res: any) => this.handleEmitResult(res, res?.invoiceName || res?.data?.name),
        error: (err) => toast.error(this.readError(err))
      });
    }
  }

  private handleEmitResult(res: any, fallbackName?: string): void {
    const messages = [
      ...liteEmissionMessages(res?.emission),
      ...liteEmissionMessages(res?.data)
    ].filter(Boolean);
    const state = String(res?.state || '').toUpperCase();
    const name = String(res?.data?.name || fallbackName || this.guideName || '').trim();
    if (['ERROR', 'PROVIDER_ERROR', 'REJECTED'].includes(state)) {
      toast.error(messages[0] || 'La guía no fue autorizada.');
    } else {
      toast.success(messages[0] || 'Guía de remisión emitida.');
    }
    if (name) this.router.navigate(['/dashboard/remission-guides', name]);
    else this.router.navigate(['/dashboard/remission-guides']);
  }

  cancelar(): void {
    if (this.guideName) this.router.navigate(['/dashboard/remission-guides', this.guideName]);
    else this.router.navigate(['/dashboard/remission-guides']);
  }

  private recordId(record: any): string {
    return String(record?.name ?? '').trim();
  }

  private defaultEnvironment(): 'Pruebas' | 'Produccion' {
    const value = String(
      this.capabilities.business?.environment || this.capabilities.business?.ambiente || ''
    ).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
    return value.includes('PROD') ? 'Produccion' : 'Pruebas';
  }

  private readError(err: any): string {
    const raw = err?.error?._server_messages || err?.error?.message || err?.error?._error_message || err?.message;
    let message = '';
    try {
      const parsed = typeof raw === 'string' && raw.trim().startsWith('[') ? JSON.parse(raw) : raw;
      const first = Array.isArray(parsed) ? parsed[0] : parsed;
      const value = typeof first === 'string' ? (() => { try { return JSON.parse(first); } catch { return first; } })() : first;
      message = typeof value === 'string' ? value : value?.message || '';
    } catch { message = String(raw || ''); }
    return message || 'No se pudo completar la acción.';
  }
}
