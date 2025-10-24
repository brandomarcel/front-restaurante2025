import 'zone.js';

// Si quieres apagar TODO:
const noop = () => {};
console.log = noop;
console.debug = noop;
console.trace = noop;
// Opcional: si también quieres silenciar info:
console.info = noop;

// Recomendación: deja warn/error activos para no perder avisos importantes
// console.warn = noop;
// console.error = noop;
