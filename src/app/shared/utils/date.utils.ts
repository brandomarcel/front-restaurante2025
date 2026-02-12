export function diasRestantes(fechaExpiracion: string): number {
  if (!fechaExpiracion) return 0;

  const fechaCaducidad = new Date(fechaExpiracion);
  const hoy = new Date();

  const diferenciaMs = fechaCaducidad.getTime() - hoy.getTime();
  return Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));
}
