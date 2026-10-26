import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { UppercaseDirective, toUpperText } from './uppercase.directive';

@Component({
  imports: [ReactiveFormsModule, UppercaseDirective],
  template: `<input appUppercase [formControl]="name" />`,
})
class HostComponent {
  name = new FormControl('');
}

describe('UppercaseDirective', () => {
  let fixture: ComponentFixture<HostComponent>;
  let input: HTMLInputElement;

  beforeEach(() => {
    fixture = TestBed.configureTestingModule({ imports: [HostComponent] }).createComponent(HostComponent);
    fixture.detectChanges();
    input = fixture.nativeElement.querySelector('input');
  });

  function type(value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('convierte el texto escrito y el FormControl a mayúsculas', () => {
    type('maría pérez');
    expect(input.value).toBe('MARÍA PÉREZ');
    expect(fixture.componentInstance.name.value).toBe('MARÍA PÉREZ');
  });

  it('respeta la ñ y los caracteres no alfabéticos', () => {
    type('peña & cía. s.a. 2');
    expect(fixture.componentInstance.name.value).toBe('PEÑA & CÍA. S.A. 2');
  });

  it('conserva la posición del cursor al editar en medio del texto', () => {
    type('ANA');
    input.value = 'ANxA';
    input.setSelectionRange(3, 3);
    input.dispatchEvent(new Event('input'));
    expect(input.value).toBe('ANXA');
    expect(input.selectionStart).toBe(3);
  });

  it('toUpperText tolera null/undefined', () => {
    expect(toUpperText(null)).toBe('');
    expect(toUpperText(undefined)).toBe('');
    expect(toUpperText('quito')).toBe('QUITO');
  });
});
