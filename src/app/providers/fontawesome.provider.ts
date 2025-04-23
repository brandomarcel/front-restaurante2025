import { importProvidersFrom } from '@angular/core';
import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';

export function provideFontAwesome() {
  return importProvidersFrom(FontAwesomeModule), {
    provide: FaIconLibrary,
    useFactory: () => {
      const lib = new FaIconLibrary();
      lib.addIconPacks(fas); // 🎯 Todos los íconos sólidos
      return lib;
    }
  };
}
