export interface MenuItem {
  group: string;
  separator?: boolean;
  selected?: boolean;
  active?: boolean;
  items: Array<SubMenuItem>;
  allowedRoles?: Role[]; // opcional: regla a nivel grupo
  hideInLite?: boolean;
  hideInApiOnly?: boolean;
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
  permissionKey?: string;
  hideInLite?: boolean;
  hideInApiOnly?: boolean;
}
export type Role = 'SYSTEM MANAGER' | 'ADMINISTRADOR' | 'GERENTE' | 'CAJERO' | 'FACTURACION' | 'MESERO' | 'COCINA' | 'USUARIO';
