import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CompanyService } from 'src/app/services/company.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  imports: [RouterOutlet]
})
export class DashboardComponent implements OnInit {
  constructor(
    private service: CompanyService
  ) { }

  ngOnInit(): void {

    this.loadCompanyInfo();
    console.log('estoy en dashboard');
  }

  loadCompanyInfo() {
    this.service.getAll().subscribe((data: any) => {
      console.log('data', data.data);
      if (data) {
        const company = data.data[0];

        localStorage.setItem('ambiente', company.ambiente);
        console.log('company', company);
      }
    });
  }

}
