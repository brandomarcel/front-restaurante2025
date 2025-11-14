export function isNullOrEmpty(value: any): boolean {
  return value === null || value === undefined || value === '' || value.trim?.() === '';
}

export function getValueOrDefault(value: any, defaultValue: string = 'N/A'): string {
  return isNullOrEmpty(value) ? defaultValue : value;
}