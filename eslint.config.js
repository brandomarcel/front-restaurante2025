// @ts-check
// Configuración plana de ESLint 9 (reemplaza al antiguo .eslintrc.json, que ESLint 9 ya no lee).
// Se ejecuta con `npm run lint` llamando a eslint directo: el builder de angular-eslint 22 pide
// Angular 22 y el proyecto está en Angular 19, así que no se usa `ng lint`.
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', '.angular/**', 'coverage/**', 'projects/**'],
  },
  {
    files: ['src/**/*.ts'],
    extends: [...angular.configs.tsRecommended],
    languageOptions: { parser: tseslint.parser },
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'app', style: 'camelCase' }],
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'app', style: 'kebab-case' }],
      // Estilo moderno (inject() en vez del constructor): el proyecto usa inyección por constructor.
      '@angular-eslint/prefer-inject': 'off',
    },
  },
  {
    files: ['src/**/*.html'],
    extends: [...angular.configs.templateRecommended],
    rules: {
      // Estilo moderno (@if/@for en vez de *ngIf/*ngFor): el proyecto usa las directivas estructurales.
      '@angular-eslint/template/prefer-control-flow': 'off',
    },
  },
);
