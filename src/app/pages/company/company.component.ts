
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { OnlyNumbersDirective } from 'src/app/core/directives/only-numbers.directive';
import { CompanyInfo, CompanyService } from 'src/app/services/company.service';

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
  imports: [CommonModule,FormsModule,ReactiveFormsModule,OnlyNumbersDirective],
  templateUrl: './company.component.html',
  styleUrl: './company.component.css'
})
export class CompanyComponent implements OnInit {
  form!: FormGroup;
  companyId!: number;
  submitted = false;

  constructor(
    private fb: FormBuilder,
    private service: CompanyService
  ) {}

  ngOnInit() {
    this.initForm();
    this.loadCompanyInfo();
  }
  get f() {
    return this.form.controls;
  }
  initForm() {
    this.form = this.fb.group({
      businessName: ['', Validators.required],
      ruc: ['', [Validators.required, Validators.pattern(/^\d{13}$/)]],
      address: ['', Validators.required],
      phone: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      establishmentCode: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
      emissionPoint: ['', [Validators.required, Validators.pattern(/^\d{3}$/)]],
      invoiceSeq: ['', Validators.required],
      saleNoteSeq: ['', Validators.required]
    });
    
  }

  loadCompanyInfo() {
    this.service.getAll().subscribe((data:any) => {
      if (data.length) {
        const company = data[0];
        console.log('company', company);
        this.companyId = company.id!;
        this.form.patchValue(company);
      }
    });
  }

  save() {
    this.submitted = true;
    if (this.form.invalid) return;

    this.service.update(this.companyId, this.form.value).subscribe(() => {
      alert('Datos actualizados correctamente');
    });
  }
}