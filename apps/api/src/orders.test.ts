import { describe, expect, it } from 'vitest';
import type { Dataset, OrderDetail, OrderSummary } from '@workbench/contracts';
import { loadDataset, parseDataset } from './data.js';
import { calculateOrder } from './orders.js';
import { buildApp } from './app.js';

const sample = await loadDataset();

function fixture(): Dataset {
  const recipient = structuredClone(sample.orders[0]!.recipient);

  return {
    orders: [
      {
        id: 'order-a',
        orderedAt: '2025-11-30',
        status: 'completed',
        recipient,
        items: [
          {
            id: 'line-a',
            sku: 'product-a',
            quantity: 2,
            shipmentId: 'shipment-a',
          },
        ],
      },
    ],
    products: [{ sku: 'product-a', name: 'Example Product', rrpAud: '22.00' }],
    shipments: [
      {
        id: 'shipment-a',
        orderId: 'order-a',
        carrier: 'auspost-startrack',
        trackingNumber: 'EXAMPLE',
      },
    ],
  };
}

function detail(data: Dataset) {
  return calculateOrder(data.orders[0]!, data);
}

describe('订单金额与匹配', () => {
  it('含税价格不重复加税', () => {
    const result = detail(fixture());

    expect(result.items[0]?.unitExGstAud).toBe('20.00');
    expect(result.items[0]?.subtotalExGstAud).toBe('40.00');
    expect(result.totals).toMatchObject({
      subtotalExGstAud: '40.00',
      gstAud: '4.00',
      totalAud: '44.00',
    });
  });

  it('使用未舍入单价计算行小计', () => {
    const data = fixture();
    data.products[0]!.rrpAud = '1.00';
    data.orders[0]!.items[0]!.quantity = 3;

    const result = detail(data);

    expect(result.items[0]?.unitExGstAud).toBe('0.91');
    expect(result.items[0]?.subtotalExGstAud).toBe('2.73');
    expect(result.totals).toMatchObject({
      subtotalExGstAud: '2.73',
      gstAud: '0.27',
      totalAud: '3.00',
    });
  });

  it('对每行和 GST 使用四舍五入而非截断', () => {
    const data = fixture();
    data.products[0]!.rrpAud = '0.05';
    data.orders[0]!.items[0]!.quantity = 1;

    expect(detail(data).totals).toMatchObject({
      subtotalExGstAud: '0.05',
      gstAud: '0.01',
      totalAud: '0.06',
    });
  });

  it.each([
    0,
    -1,
    1.5,
    '2',
    null,
    undefined,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])('拒绝非法数量 %s', (quantity) => {
    const data = fixture();
    data.orders[0]!.items[0]!.quantity = quantity;

    const result = detail(data);

    expect(
      result.issues.some((issue) => issue.code === 'invalid_quantity'),
    ).toBe(true);
    expect(result.totals.totalAud).toBeNull();
  });

  it.each(['', 'NaN', 'Infinity', '-1.00', '0.00', '1e3', '1.234'])(
    '拒绝非法价格 %s',
    (price) => {
      const data = fixture();
      data.products[0]!.rrpAud = price;

      expect(detail(data).issues[0]?.code).toBe('invalid_price');
      expect(detail(data).totals.totalAud).toBeNull();
    },
  );

  it('缺失 SKU 不作为免费商品', () => {
    const data = fixture();
    data.products = [];

    expect(detail(data)).toMatchObject({
      issues: [{ code: 'missing_product' }],
      totals: { status: 'incomplete', totalAud: null },
    });
  });

  it('拒绝跨订单包裹引用', () => {
    const data = fixture();
    data.shipments[0]!.orderId = 'other';

    expect(detail(data).issues[0]?.code).toBe('invalid_shipment');
  });

  it('数据校验拒绝重复 SKU 和错误结构', () => {
    const data = fixture();
    data.products.push({ ...data.products[0]! });

    expect(() => parseDataset(data)).toThrow('Duplicate SKU');
    expect(() => parseDataset({ orders: [] })).toThrow();
  });

  it('订单彼此隔离且计算不修改输入', () => {
    const data = fixture();
    const second = structuredClone(data.orders[0]!);
    second.id = 'order-b';
    second.items = [
      { id: 'line-b', sku: 'product-a', quantity: 5, shipmentId: 'shipment-b' },
    ];
    data.orders.push(second);
    data.shipments.push({
      id: 'shipment-b',
      orderId: 'order-b',
      carrier: 'tnt',
      trackingNumber: 'OTHER',
    });

    const before = structuredClone(data);

    expect(detail(data).totals.totalAud).toBe('44.00');
    expect(calculateOrder(second, data).totals.totalAud).toBe('110.00');
    expect(data).toEqual(before);
  });
});

describe('订单接口', () => {
  it('真实数据匹配、汇总与包裹数正确', async () => {
    const app = buildApp(sample);

    try {
      const response = await app.inject('/api/orders');
      const list = response.json<{ orders: OrderSummary[] }>().orders;

      expect(response.statusCode).toBe(200);
      expect(list).toHaveLength(2);
      expect(list.map((order) => order.itemCount)).toEqual([5, 4]);
      expect(list.map((order) => order.shipmentCount)).toEqual([1, 2]);
      expect(list.map((order) => order.totals.totalAud)).toEqual([
        '2146.76',
        '1670.76',
      ]);

      const result = await app.inject('/api/orders/' + sample.orders[1]!.id);

      expect(result.json<OrderDetail>().issues).toEqual([]);
    } finally {
      await app.close();
    }
  });

  it('所有订单接口对未知 ID 返回 404', async () => {
    const app = buildApp(fixture());

    try {
      for (const suffix of ['', '/tracking']) {
        const response = await app.inject('/api/orders/missing' + suffix);

        expect(response.statusCode).toBe(404);
      }
    } finally {
      await app.close();
    }
  });

  it('物流仅返回明确的未实现状态，不产生事件或时间', async () => {
    const app = buildApp(fixture());

    try {
      const result = await app.inject('/api/orders/order-a/tracking');

      expect(result.statusCode).toBe(200);
      expect(result.json()).toMatchObject({
        shipments: [
          {
            queryStatus: 'unavailable',
            currentStatus: null,
            lastUpdatedAt: null,
          },
        ],
      });
    } finally {
      await app.close();
    }
  });

  it('金额错误仍可查看订单且没有总额', async () => {
    const data = fixture();
    data.orders[0]!.items[0]!.quantity = 'invalid';
    const app = buildApp(data);

    try {
      const result = await app.inject('/api/orders/order-a');

      expect(result.statusCode).toBe(200);
      expect(result.json()).toMatchObject({
        totals: { status: 'incomplete', totalAud: null },
      });
    } finally {
      await app.close();
    }
  });
});
