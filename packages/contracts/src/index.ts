export type HealthResponse = {
  status: 'ok';
  service: 'order-tracking-workbench';
};

export type Recipient = {
  company: string;
  name: string;
  phone: string;
  email: string;
  address: {
    line1: string;
    suburb: string;
    state: string;
    postcode: string;
    country: 'AU';
  };
};

export type OrderItem = {
  id: string;
  sku: string;
  quantity: unknown;
  shipmentId: string;
};

export type Order = {
  id: string;
  orderedAt: string;
  status: string;
  recipient: Recipient;
  items: OrderItem[];
};

export type Product = {
  sku: string;
  name: string;
  description?: string;
  rrpAud: string;
  weightKg?: number;
  dimensionsCm?: {
    length: number;
    width: number;
    height: number;
  };
  volumeCm3?: number;
  sourceVolumetricWeightKg?: number;
};

export type Shipment = {
  id: string;
  orderId: string;
  carrier: 'auspost-startrack' | 'tnt';
  trackingNumber: string;
};

export type Dataset = {
  orders: Order[];
  products: Product[];
  shipments: Shipment[];
};

export type DataIssue = {
  itemId: string;
  code:
    | 'missing_product'
    | 'invalid_price'
    | 'invalid_quantity'
    | 'invalid_shipment';
  message: string;
};

export type CalculatedItem = {
  id: string;
  sku: string;
  quantity: number | null;
  shipmentId: string;
  product: Product | null;
  status: 'valid' | 'invalid';
  unitExGstAud: string | null;
  subtotalExGstAud: string | null;
};

export type OrderTotals = {
  status: 'complete' | 'incomplete';
  currency: 'AUD';
  subtotalExGstAud: string | null;
  gstAud: string | null;
  totalAud: string | null;
  shipping: {
    amountAud: string;
    source: 'not_implemented';
    message: string;
  };
};

export type OrderDetail = Omit<Order, 'items'> & {
  items: CalculatedItem[];
  shipments: Shipment[];
  issues: DataIssue[];
  totals: OrderTotals;
};

export type OrderSummary = Pick<Order, 'id' | 'orderedAt' | 'status'> & {
  company: string;
  recipientName: string;
  itemCount: number;
  shipmentCount: number;
  totals: OrderTotals;
};

export type TrackingResult = Shipment & {
  queryStatus: 'available' | 'unavailable' | 'not_implemented';
  message: string;
  currentStatus: string | null;
  lastUpdatedAt: string | null;
  events: { description: string; date: string; location: string | null }[];
  source: 'auspost-test' | null;
};
