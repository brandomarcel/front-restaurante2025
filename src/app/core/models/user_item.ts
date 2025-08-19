export interface UserItem {
  name: string;        // en Frappe suele ser el email
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  enabled: 0 | 1 | boolean;
  role_profile_name?: string;
  role_key?: RoleKey;  // derivado
}
export type RoleKey = 'cajero' | 'gerente';
