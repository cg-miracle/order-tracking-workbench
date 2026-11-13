import { describe, expect, it } from 'vitest';
import { loadDataset } from '../data/data.js';
import { calculateOrder } from '../orders/orders.js';

const sample = await loadDataset();

describe('shipping estimates', () => {
  it('aggregates quantity, packaging and volumetric weight and adds shipping once', () => {
    const data = structuredClone(sample);
    const order = data.orders[0]!;
    order.recipient.address.postcode = '2111';
    order.items = [order.items[0]!];
    order.items[0]!.quantity = 2;
    const product = data.products.find(
      (entry) => entry.sku === order.items[0]!.sku,
    )!;
    product.weightKg = 1;
    product.dimensionsCm = { length: 50, width: 20, height: 10 };
    const result = calculateOrder(order, data);
    expect(result.totals.shipping).toMatchObject({
      amountAud: '15.50',
      source: 'estimate',
      breakdown: [{ billableWeightKg: '5.00' }],
    });
    expect(Number(result.totals.totalAud)).toBeCloseTo(
      Number(result.totals.subtotalExGstAud) +
        Number(result.totals.gstAud) +
        15.5,
    );
    order.recipient.address.postcode = '3000';
    expect(calculateOrder(order, data).totals.shipping.amountAud).toBe('24.50');
  });

  it('keeps TNT at zero and does not charge a second base fee', () => {
    const data = structuredClone(sample);
    const order = data.orders[1]!;
    const result = calculateOrder(order, data);
    expect(
      result.totals.shipping.breakdown?.find(
        (entry) =>
          entry.shipmentId ===
          data.shipments.find((shipment) => shipment.carrier === 'tnt')?.id,
      )?.amountAud,
    ).toBe('0.00');
  });

  it('returns an explicit unavailable estimate for missing product measurements', () => {
    const data = structuredClone(sample);
    for (const product of data.products) {
      delete product.weightKg;
    }
    expect(calculateOrder(data.orders[0]!, data).totals.shipping).toMatchObject(
      { amountAud: '0.00', source: 'unavailable' },
    );
  });
});
