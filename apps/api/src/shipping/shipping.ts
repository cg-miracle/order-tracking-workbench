import { Decimal } from 'decimal.js';
import type {
  CalculatedItem,
  Order,
  OrderTotals,
  Shipment,
} from '@workbench/contracts';

// Assessment assumptions, not carrier tariffs. TNT remains zero until its service is verified.
export function estimateShipping(
  order: Order,
  items: CalculatedItem[],
  shipments: Shipment[],
): OrderTotals['shipping'] {
  const unavailable = (message: string): OrderTotals['shipping'] => ({
    amountAud: '0.00',
    source: 'unavailable',
    message,
  });
  if (!/^\d{4}$/.test(order.recipient.address.postcode)) {
    return unavailable(
      'Shipping estimate unavailable: invalid destination postcode.',
    );
  }
  let amount = new Decimal(0);
  const breakdown: NonNullable<OrderTotals['shipping']['breakdown']> = [];
  for (const shipment of shipments) {
    if (shipment.carrier === 'tnt') {
      breakdown.push({
        shipmentId: shipment.id,
        amountAud: '0.00',
        billableWeightKg: null,
      });
      continue;
    }
    const lines = items.filter((item) => item.shipmentId === shipment.id);
    if (
      !lines.length ||
      lines.some(
        (item) =>
          item.status !== 'valid' ||
          !item.product?.weightKg ||
          (!item.product.volumeCm3 && !item.product.dimensionsCm),
      )
    ) {
      return unavailable(
        'Shipping estimate unavailable: valid quantities, weights and dimensions are required for every parcel.',
      );
    }
    let weight = new Decimal('0.25');
    let volume = new Decimal(0);
    for (const item of lines) {
      const product = item.product!;
      const dimensions = product.dimensionsCm;
      const unitVolume = dimensions
        ? new Decimal(dimensions.length)
            .mul(dimensions.width)
            .mul(dimensions.height)
        : new Decimal(product.volumeCm3!);
      weight = weight.add(new Decimal(product.weightKg!).mul(item.quantity!));
      volume = volume.add(unitVolume.mul(item.quantity!));
    }
    const billable = Decimal.max(weight, volume.mul('1.2').div(5000))
      .mul(2)
      .ceil()
      .div(2);
    const sameRegion = order.recipient.address.postcode[0] === '2';
    const fee = new Decimal(sameRegion ? 8 : 12)
      .add(billable.mul(sameRegion ? '1.5' : '2.5'))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    amount = amount.add(fee);
    breakdown.push({
      shipmentId: shipment.id,
      amountAud: fee.toFixed(2),
      billableWeightKg: billable.toFixed(2),
    });
  }

  return {
    amountAud: amount.toFixed(2),
    source: 'estimate',
    breakdown,
    message:
      'Formula estimate from postcode 2111; not a carrier quote. Includes packaging and assumed tax-inclusive rates. TNT parcels contribute A$0.00 pending service verification.',
  };
}
