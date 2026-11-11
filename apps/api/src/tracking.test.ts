import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Shipment } from '@workbench/contracts';
import { createTrackingService, parseTracking } from './tracking.js';

const shipment: Shipment = {
  id: 'test',
  orderId: 'order',
  carrier: 'auspost-startrack',
  trackingNumber: 'TEST',
};
const config = {
  key: 'test-key',
  password: 'test-password',
  account: '00000000',
};
const event = {
  description: 'Delivered',
  date: '2025-02-13T11:49:59+11:00',
  location: 'Test location',
};
const body = {
  tracking_results: [
    {
      tracking_id: 'TEST',
      consignment: { status: 'Delivered in Full', events: [event] },
      trackable_items: [{ status: 'Delivered', events: [event] }],
    },
  ],
};

afterEach(() => vi.restoreAllMocks());

describe('物流响应', () => {
  it('解析 StarTrack 并合并重复事件', () => {
    const result = parseTracking(shipment, body);

    expect(result).toMatchObject({
      queryStatus: 'available',
      currentStatus: 'Delivered in Full',
      lastUpdatedAt: event.date,
      source: 'auspost-test',
    });
    expect(result.events).toHaveLength(1);
  });

  it('解析 Australia Post 嵌套 items 结构', () => {
    const result = parseTracking(shipment, {
      tracking_results: [
        {
          tracking_id: 'TEST',
          trackable_items: [
            { items: [{ status: 'Delivered', events: [event] }] },
          ],
        },
      ],
    });

    expect(result.queryStatus).toBe('available');
    expect(result.currentStatus).toBe('Delivered');
  });

  it.each([
    null,
    {},
    { tracking_results: [] },
    { tracking_results: [{ tracking_id: 'OTHER' }] },
    {
      tracking_results: [
        { tracking_id: 'TEST', errors: [{ code: 'ESB-10001' }] },
      ],
    },
    { tracking_results: [{ tracking_id: 'TEST', status: 'Delivered' }] },
    {
      tracking_results: [
        {
          tracking_id: 'TEST',
          consignment: {
            status: 'Delivered',
            events: [{ ...event, date: 'bad' }],
          },
        },
      ],
    },
  ])('无效或缺失数据不伪造状态 %j', (input) => {
    expect(parseTracking(shipment, input)).toMatchObject({
      queryStatus: 'unavailable',
      currentStatus: null,
      lastUpdatedAt: null,
      events: [],
    });
  });
});

describe('物流请求', () => {
  it('未配置凭据或 TNT 不发请求', async () => {
    const fetcher = vi.fn<typeof fetch>();
    const track = createTrackingService({ fetcher });

    expect((await track(shipment)).queryStatus).toBe('unavailable');
    expect((await track({ ...shipment, carrier: 'tnt' })).queryStatus).toBe(
      'unavailable',
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([401, 403, 429, 500])('HTTP %s 降级', async (status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status }));
    const result = await createTrackingService({ config, fetcher })(shipment);

    expect(result.queryStatus).toBe('unavailable');
    expect(result.message).not.toContain(config.password);
  });

  it.each(['TimeoutError', 'AbortError', 'TypeError'])(
    '请求错误 %s 降级',
    async (name) => {
      const error = new Error('test');
      error.name = name;
      const fetcher = vi.fn<typeof fetch>().mockRejectedValue(error);

      expect(
        (await createTrackingService({ config, fetcher })(shipment))
          .queryStatus,
      ).toBe('unavailable');
    },
  );

  it('缓存成功请求并在一分钟后过期', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(0);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockImplementation(async () => Response.json(body));
    const track = createTrackingService({ config, fetcher });

    await Promise.all([track(shipment), track(shipment)]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0].toString()).toContain(
      '/test/shipping/v1/track?tracking_ids=TEST',
    );
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);

    now.mockReturnValue(61000);
    await track(shipment);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('非 JSON 响应降级', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('<html>error</html>'));

    expect(
      (await createTrackingService({ config, fetcher })(shipment)).queryStatus,
    ).toBe('unavailable');
  });

  it('一个包裹失败不影响另一个包裹', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(Response.json(body));
    const track = createTrackingService({ config, fetcher });
    const results = await Promise.all([
      track({ ...shipment, id: 'first' }),
      track({ ...shipment, id: 'second' }),
    ]);

    expect(results.map((result) => result.queryStatus)).toEqual([
      'unavailable',
      'available',
    ]);
  });
});
