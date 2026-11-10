import { URL } from 'node:url';
import console from 'node:console';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const load = async (name) =>
  JSON.parse(
    await readFile(new URL('../data/' + name, import.meta.url), 'utf8'),
  );
const [orders, products, shipments, raw] = await Promise.all([
  load('orders.json'),
  load('products.json'),
  load('shipments.json'),
  load('raw/product-list-response.json'),
]);
function unique(values, label) {
  assert.equal(new Set(values).size, values.length, label + ' 存在重复值');
}
function unit(value, suffix) {
  assert.equal(typeof value, 'string');
  assert.ok(value.endsWith(suffix), '源单位错误：' + value);
  const number = Number(value.slice(0, -suffix.length));
  assert.ok(Number.isFinite(number) && number > 0, '无效数值：' + value);
  return number;
}
unique(
  orders.map((o) => o.id),
  '订单 ID',
);
unique(
  products.map((p) => p.sku),
  '标准 SKU',
);
unique(
  raw.rows.map((p) => p.SKU),
  '原始 SKU',
);
unique(
  shipments.map((s) => s.id),
  '包裹 ID',
);
unique(
  orders.flatMap((o) => o.items.map((i) => i.id)),
  '商品行 ID',
);
assert.equal(raw.rowCount, raw.rows.length);
assert.equal(raw.rows.length, products.length);
const productMap = new Map(products.map((p) => [p.sku, p]));
const shipmentMap = new Map(shipments.map((s) => [s.id, s]));
for (const row of raw.rows) {
  const p = productMap.get(row.SKU);
  assert.ok(p, '未标准化 SKU：' + row.SKU);
  assert.equal(p.name, row.ProductName.trim());
  assert.match(p.rrpAud, /^[0-9]+[.][0-9]{2}$/);
  assert.ok(Number(p.rrpAud) > 0);
  assert.equal(p.rrpAud, row.RRP);
  assert.equal(p.weightKg, unit(row.weight, 'g') / 1000);
  for (const dimension of ['length', 'width', 'height']) {
    assert.equal(p.dimensionsCm[dimension], unit(row[dimension], 'mm') / 10);
  }
  assert.equal(p.volumeCm3, unit(row.volume, 'mm³') / 1000);
  assert.equal(
    p.sourceVolumetricWeightKg,
    unit(row.Volumetric_GrossWeight, 'kg'),
  );
  const d = p.dimensionsCm;
  assert.ok(Math.abs(d.length * d.width * d.height - p.volumeCm3) < 0.000001);
  if (row.Description.trim() === '.') assert.equal(p.description, undefined);
  else assert.equal(p.description, row.Description.trim());
}
for (const order of orders) {
  assert.match(order.orderedAt, /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/);
  assert.equal(order.recipient.address.country, 'AU');
  assert.match(order.recipient.address.postcode, /^[0-9]{4}$/);
  for (const item of order.items) {
    assert.ok(productMap.has(item.sku), '缺失 SKU：' + item.sku);
    assert.ok(Number.isInteger(item.quantity) && item.quantity > 0);
    assert.equal(
      shipmentMap.get(item.shipmentId)?.orderId,
      order.id,
      '包裹不存在或跨订单',
    );
  }
}
for (const shipment of shipments) {
  assert.ok(orders.some((o) => o.id === shipment.orderId));
  assert.ok(['auspost-startrack', 'tnt'].includes(shipment.carrier));
  assert.ok(
    typeof shipment.trackingNumber === 'string' &&
      shipment.trackingNumber.length > 0,
  );
  assert.ok(
    orders.some((o) => o.items.some((i) => i.shipmentId === shipment.id)),
  );
}
console.log(
  JSON.stringify(
    {
      result: 'passed',
      orders: orders.length,
      items: orders.reduce((n, o) => n + o.items.length, 0),
      products: products.length,
      shipments: shipments.length,
      missingDescriptions: products.filter((p) => !p.description).length,
      invalidSourceEta: raw.rows.filter((r) => r.ETA === 'nullDays').length,
    },
    null,
    2,
  ),
);
