// avisos.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Aviso {
  id: string;
  titulo: string;
  mensaje: string;
  tipo: 'error' | 'warning' | 'info' | 'success';
  fecha: Date;
}

@Component({
  selector: 'app-avisos',
  templateUrl: './avisos.component.html',
  styleUrls: ['./avisos.component.css'],
  standalone: true,
  imports: [CommonModule]
})
export class AvisosComponent {
  @Input() avisos: Aviso[] = [];
  @Output() eliminar = new EventEmitter<string>();

  eliminarAviso(id: string): void {
    this.eliminar.emit(id);
  }
}
