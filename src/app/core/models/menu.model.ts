export interface MenuItem {
  group: string;
  separator?: boolean;
  selected?: boolean;
  active?: boolean;
  items: Array<SubMenuItem>;
  allowedRoles?: Role[]; // opcional: regla a nivel grupo
}

export interface SubMenuItem {
  icon?: string;
  label?: string;
  route?: string | null;
  expanded?: boolean;
  active?: boolean;
  children?: Array<SubMenuItem>;
  allowedRoles?: Role[]; // opcional: regla a nivel grupo
}
export type Role = 'GERENTE' | 'CAJERO';
