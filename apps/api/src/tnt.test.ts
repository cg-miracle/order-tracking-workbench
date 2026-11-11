import { describe, expect, it, vi } from 'vitest';
import type { Shipment } from '@workbench/contracts';
import { parseTntTracking, requestTntTracking } from './tnt.js';
import { createTrackingService } from './tracking.js';

const shipment: Shipment = {
  id: 'tnt-test',
  orderId: 'order',
  carrier: 'tnt',
  trackingNumber: '123456789',
};
const config = { username: 'test-user', password: 'test-password' };
const xml =
  '<TrackResponse><Consignment><ConsignmentNumber>123456789</ConsignmentNumber><SummaryCode>INT</SummaryCode><StatusData><StatusDescription><![CDATA[In transit & processing]]></StatusDescription><LocalEventDate>20261111</LocalEventDate><LocalEventTime>0830</LocalEventTime><Depot>SYD</Depot></StatusData></Consignment></TrackResponse>';

describe('TNT tracking', () => {
  it('maps matching XML and preserves carrier local time', () => {
    expect(parseTntTracking(shipment, xml)).toMatchObject({
      queryStatus: 'available',
      source: 'tnt',
      currentStatus: 'In transit & processing',
      lastUpdatedAt: '2026-11-11T08:30:00',
    });
  });

  it.each([
    xml.replace('123456789', '999'),
    '<html>error</html>',
    '<TrackResponse>',
    xml.replace('0830', '2530'),
    xml.replace('20261111', '20260230'),
    '<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><TrackResponse/>',
  ])('rejects invalid or unrelated responses', (input) => {
    expect(parseTntTracking(shipment, input).queryStatus).toBe('unavailable');
  });

  it('posts encoded XML with backend auth and shares concurrent requests', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(xml));
    const track = createTrackingService({ tntConfig: config, fetcher });
    const results = await Promise.all([track(shipment), track(shipment)]);
    expect(results[0]?.queryStatus).toBe('available');
    expect(fetcher).toHaveBeenCalledTimes(1);
    const options = fetcher.mock.calls[0]![1]!;
    expect(options.method).toBe('POST');
    expect(String(options.body)).toContain('xml_in=');
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it('degrades for missing credentials, denied access and timeout', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 401 }));
    expect(
      (await requestTntTracking(shipment, undefined, fetcher)).queryStatus,
    ).toBe('unavailable');
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      (await requestTntTracking(shipment, config, fetcher)).message,
    ).toContain('401');
    fetcher.mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
    expect(
      (await requestTntTracking(shipment, config, fetcher)).message,
    ).toContain('timed out');
  });
});
