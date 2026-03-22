export interface SplitItemRequest {
  order_item?: string;
  product?: string;
  qty: number;
}

export interface SplitPaymentRequest {
  formas_de_pago: string;
  monto: number;
}

export interface SplitOrderPayload {
  order_name: string;
  split_label: string;
  customer?: string;
  items: SplitItemRequest[];
  payments?: SplitPaymentRequest[];
}

export interface OrderSplitSRI {
  status?: string;
  authorization_datetime?: string;
  access_key?: string;
  invoice?: string;
  number?: string;
  grand_total?: number;
}

export interface OrderSplitItem {
  name?: string;
  order_item?: string;
  product?: string;
  product_name?: string;
  productId?: string;
  productName?: string;
  qty?: number;
  quantity?: number;
  rate?: number;
  price?: number;
  tax_rate?: number;
  subtotal?: number;
  iva?: number;
  total?: number;
}

export interface OrderSplitPayment {
  formas_de_pago?: string;
  method?: string;
  monto?: number;
  amount?: number;
}

export interface OrderSplitRow {
  name: string;
  split_label?: string;
  order?: string;
  alias?: string;
  customer?: string;
  status?: string;
  type?: string;
  subtotal?: number;
  iva?: number;
  total?: number;
  invoice?: string;
  sri?: OrderSplitSRI | null;
  items?: OrderSplitItem[];
  payments?: OrderSplitPayment[];
  createdAt?: string;
}

export interface OrderSplitResponse {
  message?: OrderSplitRow[] | { data?: OrderSplitRow[] };
  data?: OrderSplitRow[];
}
