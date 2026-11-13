import { estimateShipping } from '../shipping/shipping.js';
import { Decimal } from 'decimal.js';
import type {
  Dataset,
  Order,
  OrderDetail,
  OrderSummary,
  DataIssue,
  CalculatedItem,
} from '@workbench/contracts';

const Money = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
const money = (value: Decimal) => value.toFixed(2);

export function calculateOrder(order: Order, data: Dataset): OrderDetail {
  const products = new Map(
    data.products.map((product) => [product.sku, product]),
  );
  const shipments = data.shipments.filter(
    (shipment) => shipment.orderId === order.id,
  );
  const issues: DataIssue[] = [];

  const items: CalculatedItem[] = order.items.map((item) => {
    const itemIssues: DataIssue[] = [];
    const addIssue = (code: DataIssue['code'], message: string) =>
      itemIssues.push({ itemId: item.id, code, message });

    const product = products.get(item.sku) ?? null;
    const quantity =
      typeof item.quantity === 'number' && Number.isFinite(item.quantity)
        ? item.quantity
        : null;

    if (quantity === null || !Number.isSafeInteger(quantity) || quantity <= 0) {
      addIssue('invalid_quantity', 'Quantity must be a positive safe integer.');
    }

    if (!product) {
      addIssue('missing_product', 'Product could not be matched.');
    } else if (
      !/^[0-9]+([.][0-9]{1,2})?$/.test(product.rrpAud) ||
      new Money(product.rrpAud).lte(0)
    ) {
      addIssue('invalid_price', 'Product price is invalid.');
    }

    if (!shipments.some((shipment) => shipment.id === item.shipmentId)) {
      addIssue(
        'invalid_shipment',
        'Shipment is missing or belongs to another order.',
      );
    }

    const line = {
      id: item.id,
      sku: item.sku,
      quantity,
      shipmentId: item.shipmentId,
      product,
    };

    issues.push(...itemIssues);

    if (itemIssues.length || !product || quantity === null) {
      return {
        ...line,
        status: 'invalid',
        unitExGstAud: null,
        subtotalExGstAud: null,
      };
    }

    const unit = new Money(product.rrpAud).div('1.10');

    return {
      ...line,
      status: 'valid',
      unitExGstAud: money(unit),
      subtotalExGstAud: money(unit.mul(quantity)),
    };
  });

  const complete = issues.length === 0;
  const subtotal = complete
    ? items.reduce((sum, item) => sum.add(item.subtotalExGstAud!), new Money(0))
    : null;
  const gst = subtotal ? subtotal.mul('0.10').toDecimalPlaces(2) : null;
  const shipping = estimateShipping(order, items, shipments);

  return {
    ...order,
    items,
    shipments,
    issues,
    totals: {
      status: complete ? 'complete' : 'incomplete',
      currency: 'AUD',
      subtotalExGstAud: subtotal ? money(subtotal) : null,
      gstAud: gst ? money(gst) : null,
      totalAud:
        subtotal && gst
          ? money(subtotal.add(gst).add(shipping.amountAud))
          : null,
      shipping,
    },
  };
}

export function summarizeOrder(detail: OrderDetail): OrderSummary {
  return {
    id: detail.id,
    orderedAt: detail.orderedAt,
    status: detail.status,
    company: detail.recipient.company,
    recipientName: detail.recipient.name,
    itemCount: detail.items.length,
    shipmentCount: detail.shipments.length,
    totals: detail.totals,
  };
}
