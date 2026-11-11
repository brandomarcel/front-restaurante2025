export interface MenuItem {
  group: string;
  separator?: boolean;
  selected?: boolean;
  active?: boolean;
  items: Array<SubMenuItem>;
  allowedRoles?: Role[]; // opcional: regla a nivel grupo
  hideInLite?: boolean;
  hideInApiOnly?: boolean;
  hideWhenFeature?: import('../services/company-capabilities.service').CompanyFeatureKey;
  /** Oculta el ítem en restaurantes que usan inventario Simple (no tienen bodegas que administrar). */
  hideUnlessWarehouseUi?: boolean;
  featureKey?: import('../services/company-capabilities.service').CompanyFeatureKey;
  featureKeys?: import('../services/company-capabilities.service').CompanyFeatureKey[];
  requiredFeatures?: import('../services/company-capabilities.service').CompanyFeatureKey[];
  permissionKey?: string;
  permissionKeys?: string[];
  /** Permite mostrar la opción cuando cualquiera de estos permisos está activo. */
  anyPermissionKeys?: string[];
  /**
   * Prioriza `ui_capabilities` (get_user_context) sobre `featureKey` cuando
   * el backend lo envía; `featureKey` queda como respaldo para negocios que
   * todavía no reciben ese contrato. Ver `UI_VISIBILITY_RESOLVERS` en
   * `menu.service.ts`.
   */
  uiVisibilityKey?: UiVisibilityKey;
}

export interface SubMenuItem {
  icon?: string;
  label?: string;
  route?: string | null;
  expanded?: boolean;
  active?: boolean;
  children?: Array<SubMenuItem>;
  allowedRoles?: Role[]; // opcional: regla a nivel grupo
  featureKey?: import('../services/company-capabilities.service').CompanyFeatureKey;
  /** Capacidades alternativas para módulos que pueden operar en más de un plan. */
  featureKeys?: import('../services/company-capabilities.service').CompanyFeatureKey[];
  requiredFeatures?: import('../services/company-capabilities.service').CompanyFeatureKey[];
  permissionKey?: string;
  permissionKeys?: string[];
  /** Permite mostrar la opción cuando cualquiera de estos permisos está activo. */
  anyPermissionKeys?: string[];
  hideInLite?: boolean;
  hideInApiOnly?: boolean;
  /** Oculta la opción si el usuario tiene este permiso (evita duplicar un acceso ya mostrado en otro grupo). */
  hideWhenPermission?: string;
  /** Oculta el ítem cuando el rol efectivo del usuario es uno de estos (p. ej. Cocina no usa listas con precios). */
  hideForRoles?: Role[];
  /** Requiere que el contexto exponga api_configuration.enabled. */
  requiresApiConfiguration?: boolean;
  hideWhenFeature?: import('../services/company-capabilities.service').CompanyFeatureKey;
  hideUnlessWarehouseUi?: boolean;
  /** Activa solo con la ruta exacta (su ruta es prefijo de otras opciones, p. ej. `/settings/lite`). */
  exactMatch?: boolean;
  /** Etiqueta para negocios sin la función `restaurant` (p. ej. «Catálogo digital» en vez de «Carta digital»). */
  labelOutsideRestaurant?: string;
  /** Ver `MenuItem.uiVisibilityKey`. */
  uiVisibilityKey?: UiVisibilityKey;
}
/** Ver `UI_VISIBILITY_RESOLVERS` en `menu.service.ts`. */
export type UiVisibilityKey = 'pos' | 'reports' | 'users' | 'restaurantOrders' | 'restaurantTables' | 'restaurantKitchen' | 'withholdings' | 'purchase_settlements';
export type Role = 'SYSTEM MANAGER' | 'ADMINISTRADOR' | 'GERENTE' | 'CAJERO' | 'FACTURACION' | 'MESERO' | 'COCINA' | 'USUARIO';
