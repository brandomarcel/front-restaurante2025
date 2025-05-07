import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'ecuadorTime'
})
export class EcuadorTimePipe implements PipeTransform {
  transform(value: string | Date): string {
    if (!value) return '';

    const date = new Date(value);
    
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'America/Guayaquil',
    };

    return new Intl.DateTimeFormat('es-EC', options).format(date);
  }
}
