
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { OnlyNumbersDirective } from 'src/app/core/directives/only-numbers.directive';
import { CompanyInfo, CompanyService } from 'src/app/services/company.service';
import { AlertService } from '../../core/services/alert.service';
import { UtilsService } from '../../core/services/utils.service';

export interface EmpresaForm {
  businessName: FormControl<string>;
  ruc: FormControl<string>;
  address: FormControl<string>;
  phone: FormControl<string>;
  email: FormControl<string>;
  establishmentCode: FormControl<string>;
  emissionPoint: FormControl<string>;
  invoiceSeq: FormControl<number | null>;
  saleNoteSeq: FormControl<number | null>;
}
@Component({
  selector: 'app-company',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, OnlyNumbersDirective],
  templateUrl: './company.component.html',
  styleUrl: './company.component.css'
})
export class CompanyComponent implements OnInit {
  form!: FormGroup;
  companyId!: number;
  submitted = false;

  isToggled = false;
  ambiente = 'PRUEBAS';
  constructor(
    private fb: FormBuilder,
    private service: CompanyService,
    private alertService: AlertService,
    private utilsService: UtilsService
  ) { }

  ngOnInit() {
    this.initForm();
    this.loadCompanyInfo();
  }
  get f() {
    return this.form.controls;
  }
  initForm() {
    this.form = this.fb.group({
      businessname: ['', Validators.required],
      ruc: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
      ambiente: [''],
      address: ['', Validators.required],
      phone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      establishmentcode: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
      emissionpoint: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
      invoiceseq_prod: ['', Validators.required],
      invoiceseq_pruebas: ['', Validators.required],
      salenoteseq: ['', Validators.required]
    });

  }

  loadCompanyInfo() {
    this.service.getAll().subscribe((data: any) => {
      console.log('data', data.data);
      if (data) {
        const company = data.data[0];
        console.log('company', company);
        this.companyId = company.name!;
        company.ambiente = company.ambiente === 'PRUEBAS' ? false : true;

        this.form.patchValue(company);
        this.ambiente = this.form.value.ambiente ? 'PRODUCCION' : 'PRUEBAS';
      }
    });
  }

  cambiarAmbiente() {
    this.ambiente = this.form.value.ambiente ? 'PRODUCCION' : 'PRUEBAS';

    // Opcional: podrías emitir un evento o cambiar configuración real aquí
    console.log(`Ambiente actual: ${this.ambiente}`);
    this.service.update(this.companyId, { ambiente: this.ambiente }).subscribe((res: any) => {
      console.log('res', res);
      const ambiente = res.data.ambiente || '';
      this.alertService.success('Ambiente cambiado correctamente');
      localStorage.setItem('ambiente', ambiente);

      this.utilsService.cambiarAmbiente(ambiente);

    });
  }

  save() {
    this.submitted = true;
    if (this.form.invalid) return;

    this.service.update(this.companyId, this.form.value).subscribe(() => {
      this.alertService.success('Datos actualizados correctamente');
    });
  }
}