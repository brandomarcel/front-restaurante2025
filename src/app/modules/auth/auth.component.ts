import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AngularSvgIconModule } from 'angular-svg-icon';
import { toast } from 'ngx-sonner';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css'],
  imports: [AngularSvgIconModule, RouterOutlet,CommonModule],
})
export class AuthComponent implements OnInit {
  logoPreview: string | null = null;
  constructor() { }

  ngOnInit(): void {

    const logo = localStorage.getItem('logo');
    console.log('Logo cargado:', logo);
    if (logo) {
      this.logoPreview = logo;
    }
  }



}
