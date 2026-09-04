export interface MenuItem {
  group: string;
  separator?: boolean;
  selected?: boolean;
  active?: boolean;
  items: Array<SubMenuItem>;
  allowedRoles?: Role[]; // opcional: regla a nivel grupo
  hideInLite?: boolean;
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
  hideInLite?: boolean;
}
export type Role = 'SYSTEM MANAGER' | 'GERENTE' | 'CAJERO' | 'FACTURACION' | 'MESERO' | 'COCINA' | 'USUARIO';
