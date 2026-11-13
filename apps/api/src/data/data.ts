import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import type { Dataset } from '@workbench/contracts';

const address = z.object({
  line1: z.string().min(1),
  suburb: z.string().min(1),
  state: z.string().min(1),
  postcode: z.string().regex(/^[0-9]{4}$/),
  country: z.literal('AU'),
});

const order = z.object({
  id: z.string().min(1),
  orderedAt: z.iso.date(),
  status: z.string().min(1),
  recipient: z.object({
    company: z.string(),
    name: z.string().min(1),
    phone: z.string(),
    email: z.email(),
    address,
  }),
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        sku: z.string().min(1),
        quantity: z.unknown(),
        shipmentId: z.string().min(1),
      }),
    )
    .min(1),
});

const product = z.object({
  sku: z.string().min(1),
  name: z.string().min(1),
  rrpAud: z.string(),
  description: z.string().optional(),
  weightKg: z.number().positive().optional(),
  dimensionsCm: z
    .object({
      length: z.number().positive(),
      width: z.number().positive(),
      height: z.number().positive(),
    })
    .optional(),
  volumeCm3: z.number().positive().optional(),
  sourceVolumetricWeightKg: z.number().positive().optional(),
});

const shipment = z.object({
  id: z.string().min(1),
  orderId: z.string().min(1),
  carrier: z.enum(['auspost-startrack', 'tnt']),
  trackingNumber: z.string().min(1),
});

function unique(values: string[], label: string) {
  if (new Set(values).size !== values.length) {
    throw new Error('Duplicate ' + label);
  }
}

export function parseDataset(input: unknown): Dataset {
  const data = z
    .object({
      orders: z.array(order),
      products: z.array(product),
      shipments: z.array(shipment),
    })
    .parse(input);

  unique(
    data.orders.map((o) => o.id),
    'order ID',
  );

  unique(
    data.products.map((p) => p.sku),
    'SKU',
  );

  unique(
    data.shipments.map((s) => s.id),
    'shipment ID',
  );

  unique(
    data.orders.flatMap((o) => o.items.map((i) => i.id)),
    'item ID',
  );

  for (const s of data.shipments) {
    if (!data.orders.some((o) => o.id === s.orderId)) {
      throw new Error('Orphan shipment');
    }
  }
  // The schema validates every field before exposing the shared contract.

  return data as Dataset;
}

export async function loadDataset(): Promise<Dataset> {
  const root = new URL('../../../../data/', import.meta.url);
  const read = async (name: string): Promise<unknown> =>
    JSON.parse(await readFile(new URL(name, root), 'utf8'));
  const [orders, products, shipments] = await Promise.all(
    ['orders.json', 'products.json', 'shipments.json'].map(read),
  );

  return parseDataset({ orders, products, shipments });
}
