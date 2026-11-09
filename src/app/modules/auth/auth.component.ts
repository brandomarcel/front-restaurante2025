import { NgFor } from '@angular/common';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

interface SampleLine {
  qty: number;
  item: string;
  price: number;
}

interface SampleInvoice {
  business: string;
  lines: SampleLine[];
}

/** IVA general de Ecuador. Solo para el ticket de ejemplo; los cálculos reales los hace el backend. */
const SAMPLE_VAT = 0.15;

/**
 * Ventas de ejemplo de distintos tipos de negocio: el ticket del login cambia en cada visita para mostrar que
 * FacturADA sirve a cualquier negocio, no solo a restaurantes.
 */
const SAMPLE_INVOICES: SampleInvoice[] = [
  {
    business: 'Ferretería San José',
    lines: [
      { qty: 2, item: 'Foco LED 9 W', price: 1.5 },
      { qty: 1, item: 'Extensión 3 m', price: 4.5 },
      { qty: 1, item: 'Cinta aislante', price: 0.75 },
    ],
  },
  {
    business: 'Boutique Alma',
    lines: [
      { qty: 1, item: 'Camiseta algodón M', price: 12 },
      { qty: 1, item: 'Jean clásico 32', price: 28 },
    ],
  },
  {
    business: 'TecnoFix Servicio Técnico',
    lines: [
      { qty: 1, item: 'Mantenimiento de laptop', price: 25 },
      { qty: 1, item: 'Pasta térmica', price: 4 },
    ],
  },
  {
    business: 'Minimarket La Esquina',
    lines: [
      { qty: 2, item: 'Detergente 1 kg', price: 3.25 },
      { qty: 3, item: 'Papel higiénico x4', price: 2.1 },
    ],
  },
  {
    business: 'Cafetería Central',
    lines: [
      { qty: 2, item: 'Café pasado', price: 1.5 },
      { qty: 1, item: 'Sánduche de pollo', price: 3.5 },
    ],
  },
];

/**
 * Marco del login. Usa la marca de FacturADA (azul marino y ámbar), no el color de tema del panel ni el logo del
 * último negocio que entró en el equipo: en un equipo compartido eso mostraba el negocio de otra persona.
 */
@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  styleUrls: ['./auth.component.css'],
  imports: [RouterOutlet, NgFor],
})
export class AuthComponent {
  readonly sample = SAMPLE_INVOICES[Math.floor(Math.random() * SAMPLE_INVOICES.length)];
  readonly subtotal = round(this.sample.lines.reduce((sum, line) => sum + line.qty * line.price, 0));
  readonly vat = round(this.subtotal * SAMPLE_VAT);
  readonly total = round(this.subtotal + this.vat);

  /** Formato de dinero de Ecuador en pantalla: coma decimal. */
  money(value: number): string {
    return value.toFixed(2).replace('.', ',');
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
