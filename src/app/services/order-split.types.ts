export interface SplitItemRequest {
  order_item?: string;
  product?: string;
  qty: number;
}

export interface SplitPaymentRequest {
  payment_method?: string;
  payment_code?: string;
  amount?: number;
  reference?: string;
  // Aliases que conserva el diálogo existente; el servicio los normaliza al
  // contrato nuevo antes de enviar la solicitud.
  formas_de_pago?: string;
  monto?: number;
}

export interface SplitOrderPayload {
  business?: string;
  order_name: string;
  split_label: string;
  customer?: string;
  items: SplitItemRequest[];
  payments?: SplitPaymentRequest[];
  notes?: string;
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
  business?: string;
  split_label?: string;
  order?: string;
  alias?: string;
  customer?: string;
  customer_name?: string;
  customer_identification_number?: string;
  status?: string;
  type?: string;
  subtotal?: number;
  iva?: number;
  total?: number;
  invoice?: string;
  lite_invoice?: string;
  fiscal_status?: string;
  provider_status?: string;
  sri_message?: string;
  access_key?: string;
  sri?: OrderSplitSRI | null;
  items?: OrderSplitItem[];
  payments?: OrderSplitPayment[];
  createdAt?: string;
}

export interface OrderSplitResponse {
  message?: OrderSplitRow[] | { data?: OrderSplitRow[] };
  data?: OrderSplitRow[];
}
