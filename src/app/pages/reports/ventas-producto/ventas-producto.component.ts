import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VentasProductoService } from 'src/app/services/ventas-producto.service';
import { NgxPaginationModule } from 'ngx-pagination';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';

@Component({
  selector: 'app-ventas-producto',
  standalone: true,
  imports: [CommonModule, FormsModule,NgxPaginationModule],
  templateUrl: './ventas-producto.component.html',
  styleUrl: './ventas-producto.component.css'
})
export class VentasProductoComponent implements OnInit {
  fromDate = '';
  toDate = '';
  loading = false;
  data: any[] = [];
  columns: any[] = [];

  page = 1;
  pageSize = 20; // Valor por defecto (puede cambiar a 50, 100, etc.)


  constructor(private ventasService: VentasProductoService) { }

  ngOnInit(): void {
    const today = new Date();
    const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    this.toDate = today.toISOString().split('T')[0];
    this.fromDate = firstDayLastMonth.toISOString().split('T')[0];

    this.cargarDatos();
  }


  setPageSize(size: number): void {
  this.pageSize = size;
  this.page = 1;
}

get totalPages(): number {
  return Math.ceil(this.data.length / this.pageSize) || 1;
}

  cargarDatos(): void {
    this.loading = true;

    const filters = {
      from_date: this.fromDate,
      to_date: this.toDate
    };

    this.ventasService.getReporteMasVendidos(filters).subscribe({
      next: (res) => {
        this.data = res.message.result || [];
        this.columns = res.message.columns || [];

        this.loading = false;
      },
      error: (err) => {
        console.error('Error al cargar datos:', err);
        this.loading = false;
      }
    });
  }


exportarExcel(): void {
  // Crear una hoja con las fechas como encabezado
  const encabezado = [
    [`Reporte de Productos Más Vendidos`],
    [`Desde: ${this.fromDate}`],
    [`Hasta: ${this.toDate}`],
    [] // Fila vacía antes de los datos
  ];

  // Convertir los datos a hoja
  const datos = XLSX.utils.json_to_sheet(this.data);

  // Agregar encabezado antes de los datos
  const hojaCompleta = XLSX.utils.aoa_to_sheet(encabezado); // `aoa`: array of arrays

  // Combina encabezado y datos
  XLSX.utils.sheet_add_json(hojaCompleta, this.data, {
    origin: -1, // Agrega los datos debajo del encabezado
    skipHeader: false // Incluye los nombres de columna
  });

  const libro: XLSX.WorkBook = {
    Sheets: { 'Productos Más Vendidos': hojaCompleta },
    SheetNames: ['Productos Más Vendidos']
  };

  const excelBuffer: any = XLSX.write(libro, { bookType: 'xlsx', type: 'array' });

  const blob: Blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  FileSaver.saveAs(blob, 'productos_mas_vendidos.xlsx');
}

}
